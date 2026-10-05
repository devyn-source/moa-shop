import { getSupabase } from "./supabase";
import { getCheckoutOrders } from "./store";
import { getStripe } from "./stripe";
import { ownsOrder } from "./order-access";
import { checkoutTotalCents } from "./express-payment";
import type { ShopOrder } from "./types";
import type Stripe from "stripe";

export type RefundState = NonNullable<ShopOrder["refundStatus"]>;
export type RefundTicket = { checkout_id: string; order_number: string; payment_id: string; mode: "express_sandbox" | "express_stripe"; amount_cents: number; status: RefundState; refund_id: string | null; backend_synced_at?: string | null };
export class RefundError extends Error { constructor(message: string, public status = 503) { super(message); } }

async function bridge(path: string, body: unknown) {
  const base = process.env.MOAOS_EXPRESS_URL?.replace(/\/$/, "");
  if (!base || !process.env.EXPRESS_SECRET) throw new RefundError("Order service is unavailable. Please retry.");
  const response = await fetch(`${base}/api/express/customer/${path}`, { method: "POST", headers: {
    "Content-Type": "application/json", "x-express-secret": process.env.EXPRESS_SECRET,
    ...(process.env.MOAOS_BYPASS ? { "x-vercel-protection-bypass": process.env.MOAOS_BYPASS } : {}),
  }, body: JSON.stringify(body), signal: AbortSignal.timeout(15_000) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new RefundError(result.error || "Could not update cancellation. Please retry.", response.status >= 400 ? response.status : 503);
}

async function save(ticket: RefundTicket, status: RefundState, refundId: string | null) {
  const { data, error } = await getSupabase().rpc("save_express_checkout_refund", {
    p_checkout_id: ticket.checkout_id, p_order_number: ticket.order_number, p_payment_id: ticket.payment_id,
    p_mode: ticket.mode, p_amount_cents: ticket.amount_cents, p_status: status, p_refund_id: refundId,
  });
  if (error || !data) throw new RefundError("Could not save the refund record. Please retry.");
  return data as RefundTicket;
}

async function sync(ticket: RefundTicket) {
  await bridge("refund", { number: ticket.order_number, paymentId: ticket.payment_id, refundId: ticket.refund_id, status: ticket.status, amountUsd: ticket.amount_cents / 100 });
  const { error } = await getSupabase().from("express_checkout_refunds").update({ backend_synced_at: new Date().toISOString() }).eq("checkout_id", ticket.checkout_id).eq("status", ticket.status).eq("refund_id", ticket.refund_id);
  if (error) throw new RefundError("Refund recorded; order reconciliation needs retry.");
}

function verifyRefund(ticket: RefundTicket, refund: Stripe.Refund, paymentIntent: string) {
  const pi = typeof refund.payment_intent === "string" ? refund.payment_intent : refund.payment_intent?.id;
  if (refund.currency !== "usd" || refund.amount !== Number(ticket.amount_cents) || pi !== paymentIntent || refund.metadata?.expressCheckoutId !== ticket.checkout_id) throw new RefundError("Refund reference does not match checkout. Contact support.", 409);
}

export async function processExpressRefund(ticket: RefundTicket): Promise<RefundTicket> {
  if (ticket.mode === "express_sandbox") {
    if (process.env.EXPRESS_SANDBOX !== "1") throw new RefundError("Sandbox refunds are unavailable", 409);
    const result = await save(ticket, "succeeded", `sandbox_refund_${ticket.checkout_id}`);
    await sync(result); return result;
  }
  if (process.env.EXPRESS_SANDBOX === "1") throw new RefundError("Real refunds are disabled in sandbox", 409);
  const stripe = getStripe();
  const requestOptions = { timeout: 8000, maxNetworkRetries: 0 };
  const session = await stripe.checkout.sessions.retrieve(ticket.payment_id, {}, requestOptions);
  const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  if (!pi || session.metadata?.expressCheckoutId !== ticket.checkout_id || session.payment_status !== "paid" || session.currency !== "usd" || session.amount_total !== Number(ticket.amount_cents)) throw new RefundError("Payment does not match cancellation. Contact support.", 409);
  let refund: Stripe.Refund;
  if (ticket.refund_id) refund = await stripe.refunds.retrieve(ticket.refund_id, {}, requestOptions);
  else {
    // Recover a lost Stripe response even after the idempotency cache expires.
    // Never create another refund when any refund exists against this payment.
    const previous = await stripe.refunds.list({ payment_intent: pi, limit: 100 }, requestOptions);
    if (previous.has_more) throw new RefundError("Refund history needs manual review", 409);
    const match = previous.data.find((r) => r.metadata?.expressCheckoutId === ticket.checkout_id);
    if (match) refund = match;
    else {
      if (previous.data.length) throw new RefundError("This payment already has another refund. Contact support.", 409);
      refund = await stripe.refunds.create({ payment_intent: pi, amount: Number(ticket.amount_cents), reason: "requested_by_customer", metadata: { expressCheckoutId: ticket.checkout_id } }, { ...requestOptions, idempotencyKey: `express-refund-${ticket.checkout_id}` });
    }
  }
  verifyRefund(ticket, refund, pi);
  const status = refund.status ?? "pending";
  if (!["pending","succeeded","failed","requires_action","canceled"].includes(status)) throw new RefundError("Unknown processor refund state; contact support", 409);
  const result = await save(ticket, status as RefundState, refund.id);
  await sync(result); return result;
}

export async function cancelExpressCheckout(number: string, email: string): Promise<RefundTicket> {
  const { data, error } = await getSupabase().from("orders").select("data").eq("data->fulfillment->>catalogOrderId", number).eq("data->fulfillment->>mode", "express").limit(1);
  if (error) throw new RefundError("Could not load your order. Please retry.");
  const first = data?.[0]?.data as ShopOrder | undefined;
  if (!first || !ownsOrder(first, email) || !first.checkoutId) throw new RefundError("Order not found", 404);
  const orders = await getCheckoutOrders(first.checkoutId);
  if (!orders.length || !first.stripeSessionId || !first.checkoutMode || orders.some((o) => !ownsOrder(o, email) || o.fulfillment?.catalogOrderId !== number || o.stripeSessionId !== first.stripeSessionId || o.checkoutMode !== first.checkoutMode || !["paid","simulated_paid","refunded"].includes(o.paymentStatus))) throw new RefundError("Checkout cannot be cancelled. Contact support.", 409);
  const ticket: RefundTicket = { checkout_id: first.checkoutId, order_number: number, payment_id: first.stripeSessionId, mode: first.checkoutMode, amount_cents: checkoutTotalCents(orders), status: "requested", refund_id: first.refundId ?? null };
  // The backend reservation is the production cutoff. No Stripe call happens
  // until it atomically prevents all further customer proof approvals.
  await bridge("cancel", { number, email, paymentId: ticket.payment_id });
  const saved = await save(ticket, "requested", ticket.refund_id);
  return processExpressRefund(saved);
}

export type RefundRecoveryResult = { attempted: number; recovered: number; pending: number; failed: number; hasMore: boolean };

export async function reconcileExpressRefunds(): Promise<RefundRecoveryResult> {
  const mode = process.env.EXPRESS_SANDBOX === "1" ? "express_sandbox" : "express_stripe";
  // Oldest attempts first prevents a repeatedly failing batch from starving
  // newer cancellations. Never process the other environment's refund queue.
  const { data, error } = await getSupabase().from("express_checkout_refunds").select("*")
    .eq("mode", mode).or("status.in.(requested,pending,requires_action),backend_synced_at.is.null")
    .order("updated_at", { ascending: true }).order("checkout_id", { ascending: true }).limit(51);
  if (error) throw new RefundError("Could not load refund recovery queue");
  const result: RefundRecoveryResult = { attempted: 0, recovered: 0, pending: 0, failed: 0, hasMore: (data?.length ?? 0) > 50 };
  const deadline = Date.now() + 40_000;
  for (const ticket of ((data ?? []) as RefundTicket[]).slice(0, 50)) {
    if (Date.now() >= deadline) { result.hasMore = true; break; }
    result.attempted++;
    try {
      const saved = await processExpressRefund(ticket);
      if (saved.status === "succeeded") result.recovered++;
      else if (["failed", "canceled", "requires_action"].includes(saved.status)) result.failed++;
      else result.pending++;
    } catch {
      result.failed++;
      const saved = await getSupabase().from("express_checkout_refunds").update({ last_error: "Refund processing or order reconciliation needs operator review", updated_at: new Date().toISOString() }).eq("checkout_id", ticket.checkout_id);
      if (saved.error) throw new RefundError("Could not record refund recovery failure");
    }
  }
  return result;
}

export async function handleExpressRefundUpdate(refund: Stripe.Refund) {
  const checkout = refund.metadata?.expressCheckoutId;
  if (!checkout) return false;
  const { data, error } = await getSupabase().from("express_checkout_refunds").select("*").eq("checkout_id", checkout).maybeSingle();
  if (error || !data) throw new RefundError("Refund record not found; retry webhook");
  if (data.mode !== "express_stripe") throw new RefundError("Refund mode mismatch", 409);
  await processExpressRefund(data as RefundTicket); // re-read canonical Stripe status
  return true;
}
