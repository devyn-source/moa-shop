// Customer "Request changes" — the alternative to approving a proof. PUBLIC
// (token = order id). GET shows a short form; POST records the request, notifies
// MOA ops, and confirms. This keeps a not-approved order from silently stalling:
// the customer has a structured "no, change this" path and MOA is told.
import { NextResponse } from "next/server";
import { getOrderById, recordChangesRequested } from "@/lib/store";
import { notifyOps } from "@/lib/email";

export const runtime = "nodejs";

const ORIGIN = process.env.NEXT_PUBLIC_SITE_ORIGIN || "https://shop.magnumopus.agency";

function shell(eyebrow: string, title: string, inner: string): NextResponse {
  const html = `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title}</title>
  <style>
    @font-face{font-family:'Archivo Expanded';src:url('${ORIGIN}/brand/fonts/Archivo_Expanded-ExtraBold.ttf') format('truetype');font-weight:800;font-display:swap;}
    body{margin:0;background:#EEEAE3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1E1E1E;}
    .display{font-family:'Archivo Expanded','Arial Black',Arial,sans-serif;font-weight:800;}
    textarea{width:100%;box-sizing:border-box;min-height:120px;padding:12px;border:1px solid #D8D2C8;border-radius:10px;background:#fff;font-size:15px;color:#1E1E1E;resize:vertical;}
    textarea:focus{outline:none;border-color:#B04731;}
    button{margin-top:14px;width:100%;padding:15px;background:#B04731;border:none;border-radius:10px;color:#fff;font-family:'Archivo Expanded','Arial Black',Arial,sans-serif;font-weight:800;font-size:13px;letter-spacing:2px;text-transform:uppercase;cursor:pointer;}
  </style></head>
  <body>
    <div style="max-width:520px;margin:0 auto;padding:64px 24px;text-align:center;">
      <div style="height:4px;background:#B04731;border-radius:2px;margin-bottom:36px;"></div>
      <img src="${ORIGIN}/brand/logos/moa-logo.png" alt="MOA · Magnum Opus" height="38" style="height:38px;width:auto;display:inline-block;" />
      <p style="font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#B04731;margin:32px 0 8px;">${eyebrow}</p>
      <h1 class="display" style="font-size:30px;line-height:1.05;letter-spacing:0.5px;text-transform:uppercase;margin:0 0 16px;">${title}</h1>
      ${inner}
    </div>
  </body></html>`;
  return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) return shell("Not found", "Order not found", `<p style="color:#5C5954;">This link is invalid or has expired.</p>`);
  if (order.proofApprovedAt) return shell("Already approved", "Already in production", `<p style="color:#5C5954;">Order ${order.orderNumber} is already approved and in motion. To change it, reply to your confirmation email.</p>`);

  return shell(
    "Request changes",
    "What should we adjust?",
    `<p style="font-size:15px;line-height:1.6;color:#5C5954;margin:0 0 20px;">Tell us what to change on order <strong>${order.orderNumber}</strong> — placement, size, color, artwork, anything. We'll revise and send a fresh proof. Nothing is produced until you approve.</p>
     <form method="post" style="text-align:left;">
       <textarea name="note" placeholder="e.g. Move the logo 1 inch higher / use white ink instead / the artwork is the wrong file…" required></textarea>
       <button type="submit">Send change request &rarr;</button>
     </form>`
  );
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) return shell("Not found", "Order not found", `<p style="color:#5C5954;">This link is invalid or has expired.</p>`);
  if (order.proofApprovedAt) return shell("Already approved", "Already in production", `<p style="color:#5C5954;">Order ${order.orderNumber} is already approved.</p>`);

  let note = "";
  try {
    const form = await request.formData();
    note = String(form.get("note") || "").slice(0, 2000);
  } catch {
    /* no body */
  }

  await recordChangesRequested(id, note);
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  await notifyOps(
    `[Changes requested] Order ${order.orderNumber}`,
    `<p style="font-family:sans-serif;font-size:14px;line-height:1.6">Customer <strong>${esc(order.contactName || order.contactEmail || "")}</strong> requested changes on order <strong>${esc(order.orderNumber)}</strong> before approving the proof.</p>
     <p style="font-family:sans-serif;font-size:14px;line-height:1.6;background:#F5EFE6;padding:12px;border-radius:8px;"><strong>What to change:</strong><br/>${esc(note) || "(no detail provided)"}</p>
     <p style="font-family:sans-serif;font-size:13px;color:#8A8680">Revise the artwork/placement and re-send a proof. The order is paid and waiting at artwork QA.</p>`
  );

  return shell(
    "Got it",
    "We're on it",
    `<p style="font-size:15px;line-height:1.6;color:#5C5954;">Thanks — your change request for order <strong>${order.orderNumber}</strong> is in. We'll revise and email you a new proof to approve. Nothing is produced until you're happy with it.</p>`
  );
}
