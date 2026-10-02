import { createHmac, timingSafeEqual } from "node:crypto";
import { getStripe } from "@/lib/stripe";
import { getCheckoutOrders, markOrderPaid, setOrderCheckout, setOrderFulfillment } from "@/lib/store";
import { pushExpressOrder, type ExpressPayment } from "@/lib/express-bridge";
import type { ShopOrder } from "@/lib/types";
import type Stripe from "stripe";

export const checkoutTotalCents = (orders: ShopOrder[]) => orders.reduce((sum, o) => sum + Math.round(o.totalUsd * 100), 0);

export function sandboxToken(checkoutId: string, expires = Date.now() + 60 * 60_000): string {
  const secret = process.env.EXPRESS_SECRET;
  if (!secret) throw new Error("Payment checkout is not configured");
  const value = `${checkoutId}.${expires}`;
  return `${value}.${createHmac("sha256", secret).update(value).digest("hex")}`;
}

export function validSandboxToken(checkoutId: string, token: string): boolean {
  if (process.env.EXPRESS_SANDBOX !== "1" || !process.env.EXPRESS_SECRET) return false;
  if (!/^[a-z0-9-]+\.\d+\.[a-f0-9]{64}$/.test(token)) return false;
  const [id, expiry] = token.split(".");
  if (id !== checkoutId || !Number.isFinite(Number(expiry)) || Number(expiry) <= Date.now()) return false;
  const expected = sandboxToken(checkoutId, Number(expiry));
  return token.length === expected.length && timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

export async function assertExpressPaymentReady(): Promise<void> {
  const base = process.env.MOAOS_EXPRESS_URL?.replace(/\/$/, "");
  if (!base || !process.env.EXPRESS_SECRET) throw new Error("Checkout is being prepared. Please try again shortly.");
  const sandbox = process.env.EXPRESS_SANDBOX === "1";
  const response = await fetch(`${base}/api/express/engine-order?sandbox=${sandbox ? "1" : "0"}`, {
    headers: { "x-express-secret": process.env.EXPRESS_SECRET, ...(process.env.MOAOS_BYPASS ? { "x-vercel-protection-bypass": process.env.MOAOS_BYPASS } : {}) },
    cache: "no-store", signal: AbortSignal.timeout(15_000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.payBeforeProof !== true) throw new Error("Payment checkout is being prepared. Your cart is saved. Please try again shortly.");
  if (data.mode !== (sandbox ? "sandbox" : "live")) throw new Error("Payment checkout is not ready for this order. Your cart is saved.");
  if (process.env.EXPRESS_SANDBOX !== "1") getStripe();
}

export async function beginExpressPayment(orders: ShopOrder[], origin: string): Promise<string> {
  const checkoutId = orders[0].id;
  const sandbox = process.env.EXPRESS_SANDBOX === "1";
  for (const o of orders) await setOrderCheckout(o.id, { checkoutId, checkoutMode: sandbox ? "express_sandbox" : "express_stripe" });
  if (sandbox) return `${origin}/checkout/payment?checkout=${checkoutId}&token=${sandboxToken(checkoutId)}`;
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment", payment_method_types: ["card"], customer_email: orders[0].contactEmail,
    line_items: orders.map((o) => ({ quantity: 1, price_data: { currency: "usd", unit_amount: Math.round(o.totalUsd * 100), product_data: { name: `${o.orderNumber} · ${o.quantity} units` } } })),
    metadata: { expressCheckoutId: checkoutId },
    success_url: `${origin}/checkout/success?checkout=${checkoutId}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/cart?payment=cancelled`,
  }, { idempotencyKey: `express-checkout-${checkoutId}` });
  if (!session.url) throw new Error("Payment could not start. Please try again.");
  try {
    for (const o of orders) await setOrderCheckout(o.id, { checkoutId, checkoutMode: "express_stripe", stripeSessionId: session.id });
  } catch (error) {
    await stripe.checkout.sessions.expire(session.id).catch(() => null);
    throw error;
  }
  return session.url;
}

export function validateExpressPayment(orders: ShopOrder[], payment: ExpressPayment): void {
  if (!orders.length || orders.some((o) => o.checkoutId !== orders[0].checkoutId || o.contactEmail !== orders[0].contactEmail)) throw new Error("Invalid checkout");
  if (checkoutTotalCents(orders) !== Math.round(payment.amountUsd * 100)) throw new Error("Payment total does not match the order");
  if (orders.some((o) => o.paymentStatus === "refunded")) throw new Error("Order has been refunded");
  if (payment.method === "sandbox") {
    if (process.env.EXPRESS_SANDBOX !== "1" || orders.some((o) => o.checkoutMode !== "express_sandbox")) throw new Error("Sandbox payment is not available");
  } else if (orders.some((o) => o.checkoutMode !== "express_stripe" || o.stripeSessionId !== payment.id)) throw new Error("Payment session does not match checkout");
}

// Only a verified Stripe webhook or the gated sandbox POST reaches this.
// Mark paid before attempting MoaOS, so a bridge outage never asks for a second
// charge. Stripe retries failures; MoaOS deduplicates on the payment reference.
export async function completeExpressPayment(checkoutId: string, payment: ExpressPayment): Promise<string> {
  const orders = await getCheckoutOrders(checkoutId);
  validateExpressPayment(orders, payment);
  for (const order of orders) await markOrderPaid(order.id, payment.id, payment.method === "sandbox");
  const existing = orders[0].fulfillment?.catalogOrderId;
  if (existing && orders.every((o) => o.fulfillment?.catalogOrderId === existing)) return existing;
  const first = orders[0];
  const result = await pushExpressOrder(orders, first, first.shipToName, first.shipToAddress, undefined, payment);
  if (!result.ok) throw new Error(result.error);
  for (const order of orders) await setOrderFulfillment(order.id, { mode: "express", catalogOrderId: result.orderNumber, pushedAt: new Date().toISOString() });
  return result.orderNumber;
}

export async function handleExpressStripeSession(session: Stripe.Checkout.Session): Promise<void> {
  if (session.payment_status !== "paid") return;
  if (session.currency !== "usd" || !session.metadata?.expressCheckoutId || session.amount_total == null) throw new Error("Invalid Express payment");
  if (process.env.EXPRESS_SANDBOX === "1") throw new Error("Live payment handoff is disabled in sandbox");
  await completeExpressPayment(session.metadata.expressCheckoutId, { method: "stripe", id: session.id, amountUsd: session.amount_total / 100, paidAt: new Date().toISOString() });
}
