import { NextResponse } from "next/server";
import { getOrderById, markOrderPaid, setOrderProof } from "@/lib/store";
import { getStripe } from "@/lib/stripe";
import { sendOrderConfirmation, sendProofApproval } from "@/lib/email";
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

  return NextResponse.json({ received: true });
}
