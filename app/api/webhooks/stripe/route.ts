import { NextResponse } from "next/server";
import { getOrderById, markOrderPaid } from "@/lib/store";
import { getStripe } from "@/lib/stripe";
import { sendOrderConfirmation } from "@/lib/email";
import { pushOrderToMoaOS } from "@/lib/catalog-fulfillment";

export const runtime = "nodejs";

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
        const result = await sendOrderConfirmation(order, request);
        if (!result.sent && result.reason && result.reason !== "RESEND_API_KEY not configured") {
          console.warn(`[stripe-webhook] email send failed for ${id}: ${result.reason}`);
        }
        // Push into MoaOS catalog pipeline (mode-gated; creates a DRAFT PO only,
        // never sends to a vendor). Failures self-heal via the reconcile cron.
        try {
          const pushed = await pushOrderToMoaOS(order);
          if (!pushed.pushed && pushed.reason && pushed.reason !== "mode=off") {
            console.warn(`[stripe-webhook] MoaOS push for ${id}: ${pushed.reason}`);
          }
        } catch (err) {
          console.warn(`[stripe-webhook] MoaOS push threw for ${id}: ${err instanceof Error ? err.message : err}`);
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
