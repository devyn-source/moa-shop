// Cancel + refund a catalog order. Called by MoaOS (the Catalog board "Cancel
// & refund" action) with the shared internal secret. Issues a Stripe refund on
// the original payment, then marks the storefront order cancelled/refunded.
import { NextResponse } from "next/server";
import { getOrderById, markOrderCancelledRefunded } from "@/lib/store";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

function authorized(req: Request): boolean {
  const expected = process.env.MOAOS_INTAKE_SECRET;
  if (!expected) return false;
  return (req.headers.get("x-moa-internal-secret") || "") === expected;
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const shopOrderId = body?.shopOrderId as string | undefined;
  if (!shopOrderId) return NextResponse.json({ error: "Missing shopOrderId" }, { status: 400 });

  const order = await getOrderById(shopOrderId);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.status === "cancelled") return NextResponse.json({ ok: true, alreadyCancelled: true, refundId: order.refundId ?? null });

  // Issue the Stripe refund if there's a real payment to refund.
  let refundId: string | null = null;
  let refundReason: string | null = null;
  if (order.stripeSessionId && order.paymentStatus === "paid") {
    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.retrieve(order.stripeSessionId);
      const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
      if (pi) {
        const refund = await stripe.refunds.create({ payment_intent: pi });
        refundId = refund.id;
      } else {
        refundReason = "no payment_intent on session";
      }
    } catch (e) {
      refundReason = e instanceof Error ? e.message : "refund failed";
    }
  } else {
    refundReason = "no paid Stripe payment to refund";
  }

  await markOrderCancelledRefunded(order.id, refundId);
  return NextResponse.json({ ok: true, refundId, refundReason });
}
