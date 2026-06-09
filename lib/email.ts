// Order-confirmation email. Two send paths:
//   1. Resend (if RESEND_API_KEY is set) — sends HTML + plain-text.
//   2. N8N Gmail relay (fallback) — POSTs the rendered HTML to
//      N8N_ORDER_EMAIL_WEBHOOK_URL (workflow "Shop Order Confirmation (Gmail)").
// No-ops cleanly if neither is configured, so orders never fail on email.
//
// The HTML is hand-built table layout with fully-inlined styles: bulletproof
// across Gmail / Apple Mail / Outlook, and designed to still read as MOA even
// with images disabled (wordmark is text, colorway swatch is a bgcolor cell).
import { Resend } from "resend";
import type { ShopOrder, CatalogProduct } from "./types";
import { currency } from "./pricing";
import { getProductById, statusLabel } from "./store";
import { buildDecorationSheetUrl } from "./decoration-sheet";

// All customer-facing catalog email sends from the MOA accounting address —
// never a personal inbox. (Resend honors this From once the domain is verified;
// the N8N Gmail fallback's From is dictated by its OAuth account.)
const FROM_DEFAULT = "Magnum Opus Agency <accounting@magnumopus.agency>";

// --- Brand tokens (mirrors app/globals.css / CLAUDE.md) --------------------
const C = {
  cream: "#EEEAE3",
  creamDark: "#E2DED6",
  charcoal: "#1E1E1E",
  terracotta: "#B04731",
  terracottaLight: "#C45A42",
  neutral: "#8A8680",
  success: "#3D7A4A",
  white: "#FFFFFF"
};
// Heavy display stack approximates Archivo Expanded where web fonts can't load.
const DISPLAY = `'Archivo Expanded','Archivo','Arial Black','Helvetica Neue',Arial,sans-serif`;
const BODY = `-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif`;

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
    "https://shop.magnumopus.agency"
  );
}

// Escape user-controlled strings so they can't break layout or inject markup.
function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Tiny uppercase eyebrow label.
function label(text: string, color = C.neutral): string {
  return `<span style="font-family:${BODY};font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:${color};">${esc(text)}</span>`;
}

function row(k: string, v: string, opts: { strong?: boolean; top?: boolean } = {}): string {
  const topBorder = opts.top ? `border-top:1px solid ${C.creamDark};` : "";
  const labelStyle = `padding:7px 0;${topBorder}font-family:${BODY};font-size:13px;color:${C.neutral};vertical-align:top;`;
  const valWeight = opts.strong ? `font-family:${DISPLAY};font-weight:700;text-transform:uppercase;letter-spacing:0.4px;color:${C.charcoal};` : `font-family:${BODY};color:${C.charcoal};`;
  const valStyle = `padding:7px 0;${topBorder}font-size:13px;text-align:right;${valWeight}`;
  return `<tr><td style="${labelStyle}">${esc(k)}</td><td style="${valStyle}">${v}</td></tr>`;
}

// Numbered timeline step as a 2-cell table row.
function step(n: number, title: string, body: string): string {
  return `<tr>
    <td width="34" valign="top" style="padding:0 14px 18px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="28" height="28" align="center" valign="middle" bgcolor="${C.terracotta}" style="width:28px;height:28px;border-radius:14px;font-family:${DISPLAY};font-weight:800;font-size:13px;color:${C.white};">${n}</td></tr></table>
    </td>
    <td valign="top" style="padding:0 0 18px 0;">
      <div style="font-family:${DISPLAY};font-weight:700;font-size:13px;letter-spacing:0.6px;text-transform:uppercase;color:${C.charcoal};margin:4px 0 3px;">${esc(title)}</div>
      <div style="font-family:${BODY};font-size:13px;line-height:1.5;color:${C.neutral};">${body}</div>
    </td>
  </tr>`;
}

export function renderHtml(order: ShopOrder, product: CatalogProduct | null, origin: string): string {
  const trackerUrl = `${origin}/orders`;
  const productName = product?.displayName ?? "Catalog product";
  const variant = product?.variants.find((v) => v.id === order.variantId) ?? null;
  const decos = (product?.decorations ?? []).filter((d) => order.decorationIds.includes(d.id));
  const colorHex = variant?.colorHex || C.charcoal;
  const colorLabel = variant?.colorLabel || "—";
  const fabric = variant?.fabric || "";
  const methodLine = decos.length ? decos.map((d) => d.label).join("  +  ") : "Blank / no decoration";
  const placement = Array.from(new Set(decos.flatMap((d) => d.placementZones))).join(", ");
  const perUnitAll = order.perUnitUsd + order.decorationAdderUsd;
  const leadDays = product?.leadTimeDays ?? null;
  const greeting = order.contactName ? order.contactName.split(" ")[0] : null;

  // Optional product shot (enhancement; layout holds without it).
  const shot = variant?.frontImage || product?.greyFront || null;
  const shotUrl = shot ? `${origin}${shot}` : null;

  const addr = order.shipToAddress;
  const shipLines = [
    order.shipToName || order.contactName,
    order.companyName && order.companyName !== order.shipToName ? order.companyName : "",
    addr?.line1,
    addr?.line2,
    [addr?.city, addr?.state, addr?.postalCode].filter(Boolean).join(", "),
    addr?.country
  ].filter(Boolean).map(esc).join("<br/>");

  const colorSwatch = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-block;vertical-align:middle;"><tr><td width="16" height="16" bgcolor="${esc(colorHex)}" style="width:16px;height:16px;border-radius:4px;border:1px solid rgba(0,0,0,0.12);"></td></tr></table>`;

  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light only" />
  <title>Order ${esc(order.orderNumber)} · MOA</title>
  <!--[if mso]><style>* { font-family: Arial, sans-serif !important; }</style><![endif]-->
  <style>
    @media only screen and (max-width:600px){
      .container{width:100% !important;}
      .px{padding-left:22px !important;padding-right:22px !important;}
      .stack{display:block !important;width:100% !important;}
    }
    a{color:${C.terracotta};}
  </style>
</head>
<body style="margin:0;padding:0;background:${C.cream};">
  <!-- preheader (hidden) -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.cream};font-size:1px;line-height:1px;">Order ${esc(order.orderNumber)} confirmed — ${esc(productName)}, ${order.quantity.toLocaleString()} units. Into MOA artwork QA now.</div>

  <!-- terracotta signature bar -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.cream}">
    <tr><td align="center" style="background:${C.cream};">
      <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
        <tr><td height="4" bgcolor="${C.terracotta}" style="height:4px;line-height:4px;font-size:4px;">&nbsp;</td></tr>

        <!-- masthead -->
        <tr><td class="px" style="padding:26px 40px 8px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td align="left"><img src="${origin}/brand/logos/moa-logo.png" alt="MOA · Magnum Opus" height="32" style="display:block;border:0;height:32px;width:auto;" /></td>
            <td align="right">${label("Catalog")}</td>
          </tr></table>
        </td></tr>

        <!-- hero -->
        <tr><td class="px" style="padding:26px 40px 8px;">
          ${label("Payment received", C.terracotta)}
          <h1 style="margin:10px 0 0;font-family:${DISPLAY};font-weight:800;font-size:38px;line-height:1.02;letter-spacing:0.5px;text-transform:uppercase;color:${C.charcoal};">Order<br/>confirmed</h1>
          <p style="margin:16px 0 0;font-family:${BODY};font-size:15px;line-height:1.55;color:${C.charcoal};">
            ${greeting ? `${esc(greeting)} — your` : "Your"} order <strong style="color:${C.charcoal};">${esc(order.orderNumber)}</strong> is paid and routed straight into MOA artwork QA. No back-and-forth — we take it from here and you'll have tracking the moment it ships.
          </p>
        </td></tr>

        <!-- order card -->
        <tr><td class="px" style="padding:24px 40px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.white}" style="background:${C.white};border:1px solid ${C.creamDark};border-radius:14px;">
            ${shotUrl ? `<tr><td align="center" style="padding:20px 20px 4px;">
              <img src="${esc(shotUrl)}" width="240" alt="${esc(productName)}" style="display:block;width:240px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;" />
            </td></tr>` : ""}
            <tr><td style="padding:20px 24px 8px;">
              ${label(product?.skuCode ? `${product.skuCode} · ${product.category ?? ""}` : "Your build")}
              <div style="margin:7px 0 0;font-family:${DISPLAY};font-weight:800;font-size:20px;letter-spacing:0.4px;text-transform:uppercase;color:${C.charcoal};">${esc(productName)}</div>
            </td></tr>
            <tr><td style="padding:6px 24px 18px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                ${row("Colorway", `${colorSwatch}&nbsp;&nbsp;<span style="vertical-align:middle;">${esc(colorLabel)}</span>`)}
                ${fabric ? row("Fabric", esc(fabric)) : ""}
                ${row("Decoration", esc(methodLine))}
                ${placement ? row("Placement", esc(placement)) : ""}
                ${row("Quantity", `${order.quantity.toLocaleString()} units`)}
                ${order.artworkFileName ? row("Artwork", esc(order.artworkFileName)) : ""}
                ${row("Per unit", currency(perUnitAll))}
                ${order.taxUsd ? row("Subtotal", currency(order.subtotalUsd), { top: true }) : ""}
                ${order.taxUsd ? row("Tax", currency(order.taxUsd)) : ""}
                ${row("Total paid", `<span style="color:${C.terracotta};font-size:17px;">${currency(order.totalUsd)}</span>`, { strong: true, top: true })}
              </table>
            </td></tr>
          </table>
        </td></tr>

        <!-- CTA -->
        <tr><td class="px" align="center" style="padding:24px 40px 4px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td align="center" bgcolor="${C.charcoal}" style="border-radius:10px;">
              <a href="${esc(trackerUrl)}" style="display:inline-block;padding:15px 30px;font-family:${DISPLAY};font-weight:800;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${C.cream};text-decoration:none;border-radius:10px;">Track your order &rarr;</a>
            </td>
          </tr></table>
          <div style="margin:10px 0 0;font-family:${BODY};font-size:11px;color:${C.neutral};">Live status, anytime — ${esc(statusLabel(order.status))} now.</div>
        </td></tr>

        <!-- what happens next -->
        <tr><td class="px" style="padding:30px 40px 6px;">${label("What happens next", C.terracotta)}</td></tr>
        <tr><td class="px" style="padding:14px 40px 6px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            ${step(1, "Artwork QA", "1–3 business days. MOA reviews your art, builds the production mockup, and locks specs — no charge, no chasing.")}
            ${step(2, "Production", `Your run goes to the floor with MOA-managed quality control${leadDays ? ` — about <strong style="color:${C.charcoal};">${leadDays} days</strong> for this style.` : "."}`)}
            ${step(3, "Ship", "DDP by default. Tracking lands in your inbox and the live tracker updates in real time.")}
          </table>
        </td></tr>

        <!-- ship to -->
        ${shipLines ? `<tr><td class="px" style="padding:18px 40px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${C.creamDark};"><tr><td style="padding:18px 0 0;">
            ${label("Shipping to")}
            <div style="margin:8px 0 0;font-family:${BODY};font-size:13px;line-height:1.6;color:${C.charcoal};">${shipLines}</div>
          </td></tr></table>
        </td></tr>` : ""}

        <!-- footer -->
        <tr><td class="px" style="padding:34px 40px 40px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid ${C.creamDark};"><tr><td style="padding:22px 0 0;">
            <img src="${origin}/brand/logos/moa-logo.png" alt="MOA" height="22" style="display:block;border:0;height:22px;width:auto;" />
            <p style="margin:10px 0 0;font-family:${BODY};font-size:12px;line-height:1.6;color:${C.neutral};">
              Made-to-order merch, managed end to end — fixed MOQs, fixed price ladders, MOA-managed quality control, DDP shipping default.
            </p>
            <p style="margin:14px 0 0;font-family:${BODY};font-size:11px;line-height:1.6;color:${C.neutral};">
              Questions on this order? Reply to this email.<br/>
              Magnum Opus Agency · Order ${esc(order.orderNumber)} · <a href="${esc(origin)}" style="color:${C.terracotta};text-decoration:none;">shop.magnumopus.agency</a>
            </p>
          </td></tr></table>
        </td></tr>

        <tr><td height="4" bgcolor="${C.creamDark}" style="height:4px;line-height:4px;font-size:4px;">&nbsp;</td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function renderText(order: ShopOrder, product: CatalogProduct | null, origin: string): string {
  const trackerUrl = `${origin}/orders`;
  const productName = product?.displayName ?? "Catalog product";
  const variant = product?.variants.find((v) => v.id === order.variantId) ?? null;
  const decos = (product?.decorations ?? []).filter((d) => order.decorationIds.includes(d.id));
  return [
    `MOA CATALOG — ORDER CONFIRMED`,
    ``,
    `${order.contactName ? order.contactName.split(" ")[0] + " — your" : "Your"} order ${order.orderNumber} is paid and routed into MOA artwork QA.`,
    ``,
    `${productName}`,
    variant ? `Colorway: ${variant.colorLabel}` : "",
    decos.length ? `Decoration: ${decos.map((d) => d.label).join(" + ")}` : "",
    `Quantity: ${order.quantity.toLocaleString()} units`,
    `Total paid: ${currency(order.totalUsd)}`,
    ``,
    `Track your order: ${trackerUrl}`,
    ``,
    `WHAT HAPPENS NEXT`,
    `  1. Artwork QA (1–3 business days)`,
    product?.leadTimeDays ? `  2. Production with MOA QC (~${product.leadTimeDays} days)` : `  2. Production with MOA quality control`,
    `  3. Ship — DDP, tracking to your inbox`,
    ``,
    `Magnum Opus Agency · shop.magnumopus.agency`
  ].filter((l) => l !== "").join("\n");
}

// Fallback send path: POST the rendered email to an N8N webhook that relays it
// through MOA's existing Gmail (workflow "Shop Order Confirmation (Gmail)").
// From-address is whatever the N8N Gmail OAuth account is — OAuth dictates From.
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
  const origin = originFrom(req);
  const subject = `Order ${order.orderNumber} confirmed · MOA`;
  const html = renderHtml(order, product, origin);

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
        text: renderText(order, product, origin)
      });
      return { sent: true };
    } catch (err) {
      return { sent: false, reason: err instanceof Error ? err.message : "send failed" };
    }
  }

  return sendViaN8n(order.contactEmail, subject, html);
}

// Shared channel: prefer Resend, else relay through N8N Gmail.
async function deliver(
  to: string,
  subject: string,
  html: string
): Promise<{ sent: boolean; reason?: string }> {
  const resend = getResend();
  if (resend) {
    const from = process.env.RESEND_FROM_EMAIL || FROM_DEFAULT;
    try {
      await resend.emails.send({ from, to, subject, html });
      return { sent: true };
    } catch (err) {
      return { sent: false, reason: err instanceof Error ? err.message : "send failed" };
    }
  }
  return sendViaN8n(to, subject, html);
}

// Payment didn't complete (Stripe Checkout session expired / async payment
// failed). One polite nudge with a retry path — the customer's cart is still
// intact client-side, so the CTA points back at /cart.
export async function sendPaymentIncomplete(
  order: ShopOrder,
  req?: { headers?: { get(name: string): string | null } } | null
): Promise<{ sent: boolean; reason?: string }> {
  if (!order.contactEmail) return { sent: false, reason: "Order has no contact email" };
  const product = await getProductById(order.productId);
  const origin = originFrom(req);
  const cartUrl = `${origin}/cart`;
  const productName = product?.displayName ?? "your MOA Catalog order";
  const greeting = order.contactName ? order.contactName.split(" ")[0] : null;
  const subject = `Your order wasn't completed · MOA`;
  const html = `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${esc(subject)}</title></head>
  <body style="margin:0;padding:0;background:${C.cream};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.cream}"><tr><td align="center" style="background:${C.cream};">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
      <tr><td height="4" bgcolor="${C.terracotta}" style="height:4px;line-height:4px;font-size:4px;">&nbsp;</td></tr>
      <tr><td style="padding:26px 40px 8px;"><table role="presentation" width="100%"><tr>
        <td align="left"><img src="${origin}/brand/logos/moa-logo.png" alt="MOA · Magnum Opus" height="32" style="display:block;border:0;height:32px;width:auto;" /></td>
        <td align="right">${label("Catalog")}</td>
      </tr></table></td></tr>
      <tr><td style="padding:24px 40px 8px;">
        ${label("Payment not completed", C.terracotta)}
        <h1 style="margin:10px 0 0;font-family:${DISPLAY};font-weight:800;font-size:34px;line-height:1.05;letter-spacing:0.5px;text-transform:uppercase;color:${C.charcoal};">Pick up where<br/>you left off</h1>
        <p style="margin:16px 0 0;font-family:${BODY};font-size:15px;line-height:1.55;color:${C.charcoal};">
          ${greeting ? `${esc(greeting)} — the` : "The"} payment for <strong>${esc(productName)}</strong> (${esc(order.orderNumber)}) didn't go through, so nothing was charged and nothing went to production. Your configuration is saved in your cart — checkout again whenever you're ready.
        </p>
      </td></tr>
      <tr><td align="center" style="padding:26px 40px 4px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="${C.terracotta}" style="border-radius:10px;">
          <a href="${esc(cartUrl)}" style="display:inline-block;padding:16px 34px;font-family:${DISPLAY};font-weight:800;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:${C.white};text-decoration:none;border-radius:10px;">Return to your cart &rarr;</a>
        </td></tr></table>
        <div style="margin:14px 0 0;font-family:${BODY};font-size:12px;line-height:1.5;color:${C.neutral};">Hit a snag or have a question? Just reply to this email — a real person reads it.</div>
      </td></tr>
      <tr><td style="padding:30px 40px 40px;"><table role="presentation" width="100%" style="border-top:1px solid ${C.creamDark};"><tr><td style="padding:22px 0 0;">
        <img src="${origin}/brand/logos/moa-logo.png" alt="MOA" height="22" style="display:block;border:0;height:22px;width:auto;" />
        <p style="margin:10px 0 0;font-family:${BODY};font-size:11px;line-height:1.6;color:${C.neutral};">Magnum Opus Agency · ${esc(order.orderNumber)} · No payment was taken.</p>
      </td></tr></table></td></tr>
      <tr><td height="4" bgcolor="${C.creamDark}" style="height:4px;line-height:4px;font-size:4px;">&nbsp;</td></tr>
    </table>
  </td></tr></table></body></html>`;
  return deliver(order.contactEmail, subject, html);
}

// Internal ops notification (e.g. a customer requested changes) — to the MOA
// catalog ops inbox, via the same accounting/production sender + channel.
const OPS_EMAIL = process.env.CATALOG_OPS_EMAIL || "production@magnumopus.agency";
export async function notifyOps(subject: string, html: string): Promise<void> {
  try {
    await deliver(OPS_EMAIL, subject, html);
  } catch {
    /* best-effort */
  }
}

function renderProofHtml(order: ShopOrder, product: CatalogProduct | null, origin: string, proofUrl: string, sheetUrl?: string | null, reminder?: boolean): string {
  const approveUrl = `${origin}/api/orders/${order.id}/approve`;
  const adjustUrl = `${origin}/adjust/${order.id}`;
  const productName = product?.displayName ?? "Catalog product";
  const p = order.artworkPlacement;
  const greeting = order.contactName ? order.contactName.split(" ")[0] : null;
  const specLine = p ? [p.zoneLabel, p.method, p.colors ? `${p.colors}-color` : null].filter(Boolean).join(" · ") : null;
  const pms = p?.pantones ?? [];
  const pmsRow = pms.length
    ? `<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr>${pms
        .map(
          (c) =>
            `<td style="padding:0 8px;text-align:center;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;"><tr><td width="22" height="22" bgcolor="${esc(c.hex)}" style="width:22px;height:22px;border-radius:5px;border:1px solid rgba(0,0,0,0.15);"></td></tr></table><div style="font-family:${BODY};font-size:9px;color:${C.neutral};margin-top:5px;white-space:nowrap;">${esc(c.code)}</div></td>`
        )
        .join("")}</tr></table>`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="x-apple-disable-message-reformatting"/><title>Approve your proof · ${esc(order.orderNumber)}</title></head>
  <body style="margin:0;padding:0;background:${C.cream};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.cream}"><tr><td align="center" style="background:${C.cream};">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
      <tr><td height="4" bgcolor="${C.terracotta}" style="height:4px;line-height:4px;font-size:4px;">&nbsp;</td></tr>
      <tr><td style="padding:26px 40px 8px;"><table role="presentation" width="100%"><tr>
        <td align="left"><img src="${origin}/brand/logos/moa-logo.png" alt="MOA · Magnum Opus" height="32" style="display:block;border:0;height:32px;width:auto;" /></td>
        <td align="right">${label("Catalog")}</td>
      </tr></table></td></tr>
      <tr><td style="padding:24px 40px 8px;">
        ${label(reminder ? "Friendly reminder · still awaiting your approval" : "Payment received · One quick step", C.terracotta)}
        <h1 style="margin:10px 0 0;font-family:${DISPLAY};font-weight:800;font-size:36px;line-height:1.02;letter-spacing:0.5px;text-transform:uppercase;color:${C.charcoal};">Approve<br/>your proof</h1>
        <p style="margin:16px 0 0;font-family:${BODY};font-size:15px;line-height:1.55;color:${C.charcoal};">
          ${greeting ? `${esc(greeting)} — your` : "Your"} order <strong>${esc(order.orderNumber)}</strong> is paid. Here's exactly how <strong>${esc(productName)}</strong> will be produced. Give it a look and approve — that's the only thing between you and production. Nothing goes to the factory until you do.
        </p>
      </td></tr>
      <tr><td style="padding:22px 40px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.white}" style="background:${C.white};border:1px solid ${C.creamDark};border-radius:14px;">
          <tr><td align="center" style="padding:18px;"><img src="${esc(proofUrl)}" width="380" alt="Your proof" style="display:block;width:100%;max-width:380px;height:auto;border:0;border-radius:8px;" /></td></tr>
          ${specLine ? `<tr><td align="center" style="padding:0 18px 6px;"><span style="font-family:${BODY};font-size:12px;letter-spacing:1px;text-transform:uppercase;color:${C.neutral};">${esc(specLine)}</span></td></tr>` : ""}
          ${pmsRow ? `<tr><td align="center" style="padding:6px 18px 18px;">${pmsRow}</td></tr>` : ""}
        </table>
      </td></tr>
      <tr><td align="center" style="padding:26px 40px 4px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="${C.terracotta}" style="border-radius:10px;">
          <a href="${esc(approveUrl)}" style="display:inline-block;padding:16px 34px;font-family:${DISPLAY};font-weight:800;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:${C.white};text-decoration:none;border-radius:10px;">Approve &amp; send to production &rarr;</a>
        </td></tr></table>
        ${sheetUrl ? `<div style="margin:16px 0 0;"><a href="${esc(sheetUrl)}" style="font-family:${DISPLAY};font-weight:700;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:${C.terracotta};text-decoration:none;">View full spec sheet (PDF) &rarr;</a><div style="font-family:${BODY};font-size:11px;color:${C.neutral};margin-top:4px;">Exact print size, placement (inches from HPS &amp; center), colors and method.</div></div>` : ""}
        <div style="margin:14px 0 0;font-family:${BODY};font-size:12px;line-height:1.5;color:${C.neutral};">Not quite right? <a href="${esc(adjustUrl)}" style="color:${C.terracotta};font-weight:700;text-decoration:none;">Redo it yourself &rarr;</a> — change placement, color, ink, artwork or sizes and your proof updates instantly. As many times as you like, until it's perfect.</div>
      </td></tr>
      <tr><td style="padding:30px 40px 40px;"><table role="presentation" width="100%" style="border-top:1px solid ${C.creamDark};"><tr><td style="padding:22px 0 0;">
        <img src="${origin}/brand/logos/moa-logo.png" alt="MOA" height="22" style="display:block;border:0;height:22px;width:auto;" />
        <p style="margin:10px 0 0;font-family:${BODY};font-size:11px;line-height:1.6;color:${C.neutral};">Magnum Opus Agency · Order ${esc(order.orderNumber)} · Your approval is the final QA — we produce exactly what you approve.</p>
      </td></tr></table></td></tr>
      <tr><td height="4" bgcolor="${C.creamDark}" style="height:4px;line-height:4px;font-size:4px;">&nbsp;</td></tr>
    </table>
  </td></tr></table></body></html>`;
}

export async function sendProofApproval(
  order: ShopOrder,
  proofUrl: string,
  req?: { headers?: { get(name: string): string | null } } | null,
  opts?: { reminder?: boolean }
): Promise<{ sent: boolean; reason?: string }> {
  if (!order.contactEmail) return { sent: false, reason: "Order has no contact email" };
  const product = await getProductById(order.productId);
  const origin = originFrom(req);
  const subject = opts?.reminder
    ? `Reminder · approve your proof · Order ${order.orderNumber}`
    : `Approve your proof · Order ${order.orderNumber} · MOA`;
  // Attach the decoration spec sheet (real inch placement) so the client's
  // approval covers the spec, not just the image. Null if not calibrated.
  const sheetUrl = await buildDecorationSheetUrl(order, proofUrl).catch(() => null);
  return deliver(order.contactEmail, subject, renderProofHtml(order, product, origin, proofUrl, sheetUrl, opts?.reminder));
}

function renderShippingHtml(order: ShopOrder, origin: string, tracking: { carrier: string; number: string }): string {
  const trackerUrl = `${origin}/orders`;
  const greeting = order.contactName ? order.contactName.split(" ")[0] : null;
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="x-apple-disable-message-reformatting"/><title>Your order shipped · ${esc(order.orderNumber)}</title></head>
  <body style="margin:0;padding:0;background:${C.cream};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.cream}"><tr><td align="center" style="background:${C.cream};">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
      <tr><td height="4" bgcolor="${C.terracotta}" style="height:4px;line-height:4px;font-size:4px;">&nbsp;</td></tr>
      <tr><td style="padding:26px 40px 8px;"><table role="presentation" width="100%"><tr>
        <td align="left"><img src="${origin}/brand/logos/moa-logo.png" alt="MOA · Magnum Opus" height="32" style="display:block;border:0;height:32px;width:auto;" /></td>
        <td align="right">${label("Catalog")}</td>
      </tr></table></td></tr>
      <tr><td style="padding:24px 40px 8px;">
        ${label("Shipped", C.terracotta)}
        <h1 style="margin:10px 0 0;font-family:${DISPLAY};font-weight:800;font-size:38px;line-height:1.02;letter-spacing:0.5px;text-transform:uppercase;color:${C.charcoal};">On its way</h1>
        <p style="margin:16px 0 0;font-family:${BODY};font-size:15px;line-height:1.55;color:${C.charcoal};">
          ${greeting ? `${esc(greeting)} — your` : "Your"} order <strong>${esc(order.orderNumber)}</strong> is on the way.
        </p>
      </td></tr>
      <tr><td style="padding:22px 40px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.white}" style="background:${C.white};border:1px solid ${C.creamDark};border-radius:14px;">
          <tr><td style="padding:20px 24px;">
            <table role="presentation" width="100%"><tr><td style="padding:6px 0;font-family:${BODY};font-size:13px;color:${C.neutral};">Carrier</td><td style="padding:6px 0;text-align:right;font-family:${BODY};font-size:13px;color:${C.charcoal};">${esc(tracking.carrier)}</td></tr>
            <tr><td style="padding:6px 0;border-top:1px solid ${C.creamDark};font-family:${BODY};font-size:13px;color:${C.neutral};">Tracking</td><td style="padding:6px 0;border-top:1px solid ${C.creamDark};text-align:right;font-family:${DISPLAY};font-weight:700;font-size:14px;color:${C.charcoal};">${esc(tracking.number)}</td></tr></table>
          </td></tr>
        </table>
      </td></tr>
      <tr><td align="center" style="padding:26px 40px 4px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="${C.charcoal}" style="border-radius:10px;">
          <a href="${esc(trackerUrl)}" style="display:inline-block;padding:15px 30px;font-family:${DISPLAY};font-weight:800;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${C.cream};text-decoration:none;border-radius:10px;">Track your order &rarr;</a>
        </td></tr></table>
      </td></tr>
      <tr><td style="padding:30px 40px 40px;"><table role="presentation" width="100%" style="border-top:1px solid ${C.creamDark};"><tr><td style="padding:22px 0 0;">
        <img src="${origin}/brand/logos/moa-logo.png" alt="MOA" height="22" style="display:block;border:0;height:22px;width:auto;" />
        <p style="margin:10px 0 0;font-family:${BODY};font-size:11px;line-height:1.6;color:${C.neutral};">Magnum Opus Agency · Order ${esc(order.orderNumber)} · Questions? Reply to this email.</p>
      </td></tr></table></td></tr>
      <tr><td height="4" bgcolor="${C.creamDark}" style="height:4px;line-height:4px;font-size:4px;">&nbsp;</td></tr>
    </table>
  </td></tr></table></body></html>`;
}

export async function sendShippingNotification(
  order: ShopOrder,
  tracking: { carrier: string; number: string },
  req?: { headers?: { get(name: string): string | null } } | null
): Promise<{ sent: boolean; reason?: string }> {
  if (!order.contactEmail) return { sent: false, reason: "Order has no contact email" };
  const origin = originFrom(req);
  const subject = `Your order ${order.orderNumber} shipped · MOA`;
  return deliver(order.contactEmail, subject, renderShippingHtml(order, origin, tracking));
}
