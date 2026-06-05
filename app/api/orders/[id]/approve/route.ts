// Customer proof approval — the link in the proof email. PUBLIC (customer isn't
// signed in); the token is the order id (unguessable UUID). Records the approval
// (the QA sign-off), then pushes the order into MoaOS, which releases the PO +
// tech pack to the (allow-listed) vendor. Returns a branded confirmation page.
import { NextResponse } from "next/server";
import { getOrderById, recordProofApproval } from "@/lib/store";
import { pushOrderToMoaOS } from "@/lib/catalog-fulfillment";
import { trackServer } from "@/lib/analytics-server";

export const runtime = "nodejs";

const ORIGIN = process.env.NEXT_PUBLIC_SITE_ORIGIN || "https://shop.magnumopus.agency";

function page(eyebrow: string, title: string, body: string): NextResponse {
  const html = `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title}</title>
  <style>
    @font-face{font-family:'Archivo Expanded';src:url('${ORIGIN}/brand/fonts/Archivo_Expanded-ExtraBold.ttf') format('truetype');font-weight:800;font-display:swap;}
    body{margin:0;background:#EEEAE3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1E1E1E;}
    .display{font-family:'Archivo Expanded','Arial Black',Arial,sans-serif;font-weight:800;}
  </style></head>
  <body>
    <div style="max-width:520px;margin:0 auto;padding:72px 24px;text-align:center;">
      <div style="height:4px;background:#B04731;border-radius:2px;margin-bottom:40px;"></div>
      <img src="${ORIGIN}/brand/logos/moa-logo.png" alt="MOA · Magnum Opus" height="40" style="height:40px;width:auto;display:inline-block;" />
      <p style="font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#B04731;margin:34px 0 8px;">${eyebrow}</p>
      <h1 class="display" style="font-size:32px;line-height:1.05;letter-spacing:0.5px;text-transform:uppercase;margin:0 0 14px;">${title}</h1>
      <p style="font-size:15px;line-height:1.6;color:#5C5954;">${body}</p>
    </div>
  </body></html>`;
  return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) return page("Not found", "Order not found", "This approval link is invalid or has expired.");

  if (order.proofApprovedAt) {
    return page("Already approved", "You're all set", `Order ${order.orderNumber} is approved and in motion. We'll email tracking the moment it ships.`);
  }

  const approved = await recordProofApproval(id);
  if (approved) await trackServer("proof_approved", { order_number: approved.orderNumber, order_id: id }, approved.orderNumber);
  // Push into MoaOS → releases the PO + tech pack to the vendor (allow-list gated).
  try {
    if (approved) await pushOrderToMoaOS(approved);
  } catch {
    /* reconcile cron self-heals the push */
  }

  return page(
    "Proof approved",
    "Into production",
    `Thank you — order ${order.orderNumber} is approved and routed to production. You'll get tracking the moment it ships. Need a change? Just reply to your confirmation email.`
  );
}
