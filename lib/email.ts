// Order-confirmation email via Resend. No-ops gracefully when RESEND_API_KEY
// is missing — orders never fail because email isn't configured yet. Sender
// defaults to the Resend sandbox; flip RESEND_FROM_EMAIL to your verified
// sender (e.g. orders@magnumopus.agency) once the domain is wired in Resend.
import { Resend } from "resend";
import type { ShopOrder } from "./types";
import { currency } from "./pricing";
import { getProductById, statusLabel } from "./store";

const FROM_DEFAULT = "MOA Catalog <onboarding@resend.dev>";

let client: Resend | null = null;
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!client) client = new Resend(key);
  return client;
}

function originFrom(req?: { headers?: { get(name: string): string | null } } | null): string {
  const fromReq = req?.headers?.get?.("origin") ?? null;
  return (
    fromReq ??
    process.env.NEXT_PUBLIC_SITE_ORIGIN ??
    process.env.SITE_ORIGIN ??
    "https://moa-shop-amber.vercel.app"
  );
}

function renderHtml(order: ShopOrder, productName: string, origin: string): string {
  const trackerUrl = `${origin}/orders/${order.id}`;
  const sizes = Object.entries(order["sizeQty" as keyof ShopOrder] as unknown as Record<string, number> | undefined ?? {})
    .filter(([, q]) => q > 0)
    .map(([s, q]) => `${s} × ${q}`)
    .join(" · ");
  // The shop's brand palette, inlined for max client compatibility.
  const cream = "#EEEAE3";
  const charcoal = "#1E1E1E";
  const terracotta = "#B04731";
  const neutral = "#8A8680";
  const border = "#E2DED6";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Order ${order.orderNumber} · MOA</title>
  </head>
  <body style="margin:0;padding:0;background:${cream};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${charcoal};">
    <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
      <div style="font-family:Arial Black,Helvetica,sans-serif;font-weight:800;font-size:24px;letter-spacing:0.5px;color:${terracotta};">MOA</div>
      <p style="margin:24px 0 4px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${terracotta};">Payment received</p>
      <h1 style="margin:0 0 14px;font-family:Arial Black,Helvetica,sans-serif;font-weight:800;font-size:34px;line-height:1;letter-spacing:0.5px;text-transform:uppercase;color:${charcoal};">We've got your order</h1>
      <p style="margin:0 0 22px;font-size:15px;line-height:1.5;color:${charcoal};">
        Order <strong>${order.orderNumber}</strong> is confirmed and routed to MOA artwork QA. You'll get tracking the moment it ships.
      </p>

      <div style="background:#fff;border:1px solid ${border};border-radius:12px;padding:18px 20px;margin-bottom:20px;">
        <p style="margin:0 0 8px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${neutral};">Order summary</p>
        <p style="margin:0 0 10px;font-family:Arial Black,Helvetica,sans-serif;font-weight:700;font-size:16px;letter-spacing:0.4px;text-transform:uppercase;color:${charcoal};">${productName}</p>
        <table style="width:100%;border-collapse:collapse;font-size:13px;color:${charcoal};">
          <tr><td style="padding:4px 0;color:${neutral};">Quantity</td><td style="padding:4px 0;text-align:right;">${order.quantity.toLocaleString()} units</td></tr>
          ${sizes ? `<tr><td style="padding:4px 0;color:${neutral};">Sizes</td><td style="padding:4px 0;text-align:right;">${sizes}</td></tr>` : ""}
          <tr><td style="padding:4px 0;color:${neutral};">Per unit</td><td style="padding:4px 0;text-align:right;">${currency(order.perUnitUsd + order.decorationAdderUsd)}</td></tr>
          ${order.artworkFileName ? `<tr><td style="padding:4px 0;color:${neutral};">Artwork</td><td style="padding:4px 0;text-align:right;">${order.artworkFileName}</td></tr>` : ""}
          <tr><td style="padding:10px 0 0;border-top:1px solid ${border};font-family:Arial Black,Helvetica,sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:0.3px;">Total paid</td><td style="padding:10px 0 0;border-top:1px solid ${border};text-align:right;font-family:Arial Black,Helvetica,sans-serif;font-weight:700;color:${terracotta};font-size:18px;">${currency(order.totalUsd)}</td></tr>
        </table>
      </div>

      <a href="${trackerUrl}" style="display:inline-block;padding:14px 22px;background:${charcoal};color:${cream};text-decoration:none;border-radius:10px;font-family:Arial Black,Helvetica,sans-serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Track your order →</a>

      <p style="margin:28px 0 8px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${terracotta};">What happens next</p>
      <ol style="margin:0 0 24px;padding:0 0 0 18px;font-size:14px;line-height:1.55;color:${charcoal};">
        <li><strong>Artwork QA</strong> (1–3 business days). MOA reviews your art, mockup, and production specs.</li>
        <li><strong>Production.</strong> Once approved, your run goes into production with MOA quality control.</li>
        <li><strong>Ship.</strong> Tracking lands in your inbox. The live tracker on this site keeps you posted in real time.</li>
      </ol>

      <p style="margin:28px 0 0;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${neutral};">Magnum Opus Agency · Made-to-order · MOA-managed quality control · Order ${order.orderNumber} · Status: ${statusLabel(order.status)}</p>
    </div>
  </body>
</html>`;
}

function renderText(order: ShopOrder, productName: string, origin: string): string {
  const trackerUrl = `${origin}/orders/${order.id}`;
  return [
    `MOA — We've got your order`,
    ``,
    `Order ${order.orderNumber} is confirmed and routed to MOA artwork QA.`,
    ``,
    `${productName}`,
    `${order.quantity.toLocaleString()} units · Total paid ${currency(order.totalUsd)}`,
    ``,
    `Track your order: ${trackerUrl}`,
    ``,
    `What happens next:`,
    `  1. Artwork QA (1–3 business days)`,
    `  2. Production with MOA quality control`,
    `  3. Ship — tracking lands in your inbox`,
    ``,
    `Magnum Opus Agency`
  ].join("\n");
}

// Fallback send path: POST the rendered email to an N8N webhook that relays it
// through MOA's existing Gmail (workflow "Shop Order Confirmation (Gmail)").
// Used when Resend isn't configured. From-address is whatever the N8N Gmail
// OAuth account is (MOA Accounting / info@) — OAuth dictates From, see memory.
async function sendViaN8n(
  to: string,
  subject: string,
  html: string
): Promise<{ sent: boolean; reason?: string }> {
  const url = process.env.N8N_ORDER_EMAIL_WEBHOOK_URL;
  if (!url) return { sent: false, reason: "N8N_ORDER_EMAIL_WEBHOOK_URL not configured" };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ to, subject, html })
    });
    if (!res.ok) return { sent: false, reason: `N8N webhook ${res.status}` };
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: err instanceof Error ? err.message : "N8N send failed" };
  }
}

export async function sendOrderConfirmation(
  order: ShopOrder,
  req?: { headers?: { get(name: string): string | null } } | null
): Promise<{ sent: boolean; reason?: string }> {
  if (!order.contactEmail) return { sent: false, reason: "Order has no contact email" };

  const product = await getProductById(order.productId);
  const productName = product?.displayName ?? "Catalog product";
  const origin = originFrom(req);
  const subject = `Order ${order.orderNumber} confirmed · MOA`;
  const html = renderHtml(order, productName, origin);

  // Prefer Resend when configured; otherwise relay through N8N Gmail.
  const resend = getResend();
  if (resend) {
    const from = process.env.RESEND_FROM_EMAIL || FROM_DEFAULT;
    try {
      await resend.emails.send({
        from,
        to: order.contactEmail,
        subject,
        html,
        text: renderText(order, productName, origin)
      });
      return { sent: true };
    } catch (err) {
      return { sent: false, reason: err instanceof Error ? err.message : "send failed" };
    }
  }

  return sendViaN8n(order.contactEmail, subject, html);
}
