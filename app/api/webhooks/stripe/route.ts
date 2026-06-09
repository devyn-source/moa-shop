import { NextResponse } from "next/server";
import { getOrderById, markOrderPaid, setOrderProof, updateOrderStatus } from "@/lib/store";
import { getStripe } from "@/lib/stripe";
import { sendOrderConfirmation, sendProofApproval, sendPaymentIncomplete } from "@/lib/email";
import { generateProof } from "@/lib/proof";
import { pushOrderToMoaOS } from "@/lib/catalog-fulfillment";
import { trackServer } from "@/lib/analytics-server";

export const runtime = "nodejs";

const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_ORIGIN || "https://shop.magnumopus.agency";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig = request.headers.get("stripe-signature");
  if (!secret || !sig) {
    return NextResponse.json({ error: "Missing webhook secret or signature" }, { status: 400 });
  }

  const raw = await request.text();
  const stripe = getStripe();

  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (error) {
    return NextResponse.json({ error: `Signature verification failed: ${error instanceof Error ? error.message : ""}` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as { id: string; metadata?: { orderIds?: string } };
    const ids = (session.metadata?.orderIds ?? "").split(",").filter(Boolean);
    for (const id of ids) {
      await markOrderPaid(id, session.id);
      // Send a confirmation email per order. No-ops cleanly if RESEND_API_KEY
      // isn't set, so missing email config never blocks payment processing.
      const order = await getOrderById(id);
      if (order) {
        // Purchase conversion event (server-side, authoritative).
        await trackServer("purchase", { order_number: order.orderNumber, value: order.totalUsd, order_id: id, currency: "USD" }, order.orderNumber);
        // Generate the proof, then email the customer to approve it. The MoaOS
        // push + vendor send happen ONLY after the customer approves their proof
        // (see /api/orders/[id]/approve) — the approval IS the QA.
        let proofUrl: string | null = null;
        try {
          proofUrl = await generateProof(order, SITE_ORIGIN);
          if (proofUrl) await setOrderProof(id, proofUrl);
        } catch (err) {
          console.warn(`[stripe-webhook] proof generation failed for ${id}: ${err instanceof Error ? err.message : err}`);
        }
        const fresh = (await getOrderById(id)) ?? order;
        const result = proofUrl
          ? await sendProofApproval(fresh, proofUrl, request)
          : await sendOrderConfirmation(fresh, request); // fallback: no placement → plain confirmation
        if (!result.sent && result.reason && result.reason !== "RESEND_API_KEY not configured") {
          console.warn(`[stripe-webhook] email send failed for ${id}: ${result.reason}`);
        }
        // Surface the paid order on the MoaOS board immediately as
        // awaiting_approval (money-in is never invisible). No PO / no vendor
        // send happens until the customer approves their proof.
        try {
          await pushOrderToMoaOS(fresh);
        } catch (err) {
          console.warn(`[stripe-webhook] MoaOS pre-push failed for ${id}: ${err instanceof Error ? err.message : err}`);
        }
      }
    }
  }

  // Payment never completed — the Checkout session expired (24h) or an async
  // payment method failed. Close out the orphaned awaiting_payment orders and
  // send the customer one retry nudge (their cart is still intact client-side).
  // Without this, failed checkouts sit in awaiting_payment forever and retries
  // pile up duplicate orders.
  if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
    const session = event.data.object as { metadata?: { orderIds?: string } };
    const ids = (session.metadata?.orderIds ?? "").split(",").filter(Boolean);
    const reason = event.type === "checkout.session.expired" ? "Checkout session expired" : "Payment failed";
    let nudged = false;
    for (const id of ids) {
      const order = await getOrderById(id);
      // Idempotent + safe: only ever close orders still waiting on this payment.
      if (!order || order.paymentStatus === "paid" || order.status !== "awaiting_payment") continue;
      await updateOrderStatus(id, "cancelled", `${reason} — no charge was made.`);
      // One email per checkout (the bundle shares a contact), not per line.
      if (!nudged) {
        const result = await sendPaymentIncomplete(order, request);
        if (!result.sent && result.reason && result.reason !== "RESEND_API_KEY not configured") {
          console.warn(`[stripe-webhook] payment-incomplete email failed for ${id}: ${result.reason}`);
        }
        nudged = true;
      }
    }
  }

  return NextResponse.json({ received: true });
}
