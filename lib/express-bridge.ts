// MOA Express bridge. With EXPRESS_CHECKOUT=1 the storefront stops taking card
// payment: checkout prices every line exactly as before (upsells, fabric
// tiers, PR Box discounts), renders the proof mockups, then hands the priced
// order to MoaOS (/api/express/engine-order). MoaOS creates one Express
// project on the /design board at 100% deposit; the team builds the tech pack
// by hand and sends the proof with a single invoice.
//
// Env: EXPRESS_CHECKOUT=1, MOAOS_EXPRESS_URL (e.g. https://os.magnumopus.agency),
// EXPRESS_SECRET (shared with MoaOS), EXPRESS_SANDBOX=1 for test runs,
// MOAOS_BYPASS (optional Vercel protection bypass for preview deploys).

import { getProductById } from "./store";
import type { ShopOrder } from "./types";

export const expressCheckoutEnabled = () => process.env.EXPRESS_CHECKOUT === "1";

type Contact = { contactName: string; contactEmail: string; contactPhone?: string; companyName: string };
type Ship = { line1: string; line2: string; city: string; state: string; postalCode: string; country: string };

export async function pushExpressOrder(orders: ShopOrder[], contact: Contact, shipToName: string, shipTo: Ship, notes?: string): Promise<{ ok: true; orderNumber: string } | { ok: false; error: string }> {
  const base = (process.env.MOAOS_EXPRESS_URL || "").replace(/\/$/, "");
  const secret = process.env.EXPRESS_SECRET || "";
  if (!base || !secret) return { ok: false, error: "Express bridge is not configured" };

  const lines = [];
  for (const o of orders) {
    const product = await getProductById(o.productId);
    const variant = product?.variants.find((v) => v.id === o.variantId);
    const placements = (o.artworkPlacements?.length ? o.artworkPlacements : o.artworkPlacement ? [o.artworkPlacement] : []).map((p) => ({
      // Never let a partial placement block the whole order: the team confirms
      // every placement on the proof anyway.
      view: p.view || "front",
      zoneLabel: p.zoneLabel || p.zoneId || "Placement",
      method: p.method,
      widthIn: p.spec3d?.widthIn ?? p.widthIn,
      heightIn: p.spec3d?.heightIn ?? p.heightIn,
      belowHpsIn: p.spec3d?.belowHpsIn,
      fromCenterIn: p.spec3d?.fromCenterIn,
      horizontal: p.spec3d?.horizontal,
      pantones: p.pantones?.map((x) => ({ code: x.code, name: x.name })),
      artworkFileName: p.artworkFileName,
      artworkFileUrl: p.artworkFileUrl && /^https?:\/\//.test(p.artworkFileUrl) ? p.artworkFileUrl : undefined,
    }));
    lines.push({
      shopOrderId: o.id,
      orderNumber: o.orderNumber,
      productSlug: product?.slug || o.productId,
      productName: product?.displayName || "Custom piece",
      garmentType: product?.category,
      colour: variant?.colorLabel,
      fabric: o.fabricLabel,
      decorations: o.decorationIds,
      qty: o.quantity,
      sizeBreakdown: o.sizeBreakdown,
      perUnitUsd: o.perUnitUsd,
      totalUsd: o.totalUsd,
      bundleLabel: o.bundleLabel,
      bundleRole: o.bundleRole,
      wovenLabel: o.wovenLabel,
      proofUrl: o.proofUrl && /^https?:\/\//.test(o.proofUrl) ? o.proofUrl : undefined,
      artworkFileName: o.artworkFileName,
      artworkFileUrl: o.artworkFileUrl && /^https?:\/\//.test(o.artworkFileUrl) ? o.artworkFileUrl : undefined,
      artworkNotes: o.artworkNotes || undefined,
      placements,
    });
  }

  const res = await fetch(`${base}/api/express/engine-order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-express-secret": secret,
      ...(process.env.MOAOS_BYPASS ? { "x-vercel-protection-bypass": process.env.MOAOS_BYPASS } : {}),
    },
    body: JSON.stringify({
      sandbox: process.env.EXPRESS_SANDBOX === "1",
      ipAttested: true,
      contact: { contactName: contact.contactName, contactEmail: contact.contactEmail, contactPhone: contact.contactPhone || undefined, companyName: contact.companyName },
      shipTo: { name: shipToName || undefined, line1: shipTo.line1 || undefined, line2: shipTo.line2 || undefined, city: shipTo.city || "Unknown", state: shipTo.state || undefined, postalCode: shipTo.postalCode || undefined, country: shipTo.country || "US" },
      notes,
      lines,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; orderNumber?: string; error?: string; errors?: Record<string, string> };
  if (!res.ok || !data.ok || !data.orderNumber) return { ok: false, error: data.error || JSON.stringify(data.errors || {}).slice(0, 300) || `MoaOS ${res.status}` };
  return { ok: true, orderNumber: data.orderNumber };
}
