// Cancel + refund a catalog order. Called by MoaOS (the Catalog board "Cancel
// & refund" action) with the shared internal secret. Issues a Stripe refund on
// the original payment, then marks the storefront order cancelled/refunded.
import { NextResponse } from "next/server";
import { getOrderById, markOrderCancelledRefunded } from "@/lib/store";
import { getStripe } from "@/lib/stripe";
import { getSupabase } from "@/lib/supabase";

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
  if (order.checkoutMode || order.fulfillment?.mode === "express") return NextResponse.json({ error: "Use the Express whole-order cancellation flow" }, { status: 409 });
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
        const { data, error } = await getSupabase().from("orders").select("id").eq("data->>stripeSessionId", order.stripeSessionId);
        if (error || data?.length !== 1 || session.amount_total !== Math.round(order.totalUsd * 100)) return NextResponse.json({ error: "Shared payment needs a coordinated refund" }, { status: 409 });
        const refund = await stripe.refunds.create({ payment_intent: pi, amount: Math.round(order.totalUsd * 100) }, { idempotencyKey: `catalog-refund-${order.id}` });
        if (refund.status !== "succeeded") return NextResponse.json({ error: "Refund is not complete; review its processor status", refundId: refund.id }, { status: 502 });
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

  if (order.paymentStatus === "paid" && !refundId) return NextResponse.json({ error: "Refund failed; order has not been marked refunded" }, { status: 502 });

  await markOrderCancelledRefunded(order.id, refundId);
  return NextResponse.json({ ok: true, refundId, refundReason });
}
