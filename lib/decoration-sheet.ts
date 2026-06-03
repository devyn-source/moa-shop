// Builds the per-order Decoration Spec Sheet (via moa-pdf) for the CLIENT's
// art-confirmation email — so the customer approves the exact placement spec,
// not just the picture. Same renderer the vendor copy uses; here we feed it the
// approved proof + the SKU's calibration so the inch callouts are real.
import type { ShopOrder } from "./types";
import { getProductById, getProductCalibration } from "./store";
import { derivePlacement, normaliseCalibration } from "./zones";

const MOA_PDF_URL = process.env.MOA_PDF_URL || "https://moa-pdf-fawn.vercel.app";

function lum(hex?: string | null): number | null {
  if (!hex) return null;
  const m = hex.replace("#", "");
  if (m.length < 6) return null;
  const r = parseInt(m.slice(0, 2), 16) / 255, g = parseInt(m.slice(2, 4), 16) / 255, b = parseInt(m.slice(4, 6), 16) / 255;
  if ([r, g, b].some((v) => Number.isNaN(v))) return null;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function needsUnderbase(garmentHex?: string | null, inks?: { hex: string }[] | null): boolean {
  const l = lum(garmentHex);
  if (l === null || l > 0.4) return false;
  const list = inks ?? [];
  if (!list.length) return true;
  return list.some((i) => { const li = lum(i.hex); return li === null || li < 0.92; });
}

// Returns a public PDF URL for the order's decoration sheet, or null if it can't
// be built (no placement / no calibration / render failed).
export async function buildDecorationSheetUrl(order: ShopOrder, mockupUrl: string | null): Promise<string | null> {
  const placement = order.artworkPlacement;
  if (!placement) return null;
  const product = await getProductById(order.productId);
  if (!product) return null;
  const variant = product.variants.find((v) => v.id === order.variantId) ?? null;

  const vcal = normaliseCalibration(await getProductCalibration(product.slug).catch(() => null))?.[placement.view];
  if (!vcal) return null; // not calibrated → can't spec to inches
  const d = derivePlacement(vcal, placement.box, placement.art, placement.view);

  const sizes = product.sizes ?? [];
  const inks = (placement.pantones ?? []).map((p) => ({ code: p.code, hex: p.hex }));
  const origin = process.env.NEXT_PUBLIC_SITE_ORIGIN || "https://shop.magnumopus.agency";
  const shot = variant?.frontImage || product.greyFront || null;

  const data = {
    styleNumber: product.skuCode,
    sizeRange: sizes.length ? `${sizes[0]} – ${sizes[sizes.length - 1]}` : "—",
    dateCreated: new Date().toISOString().slice(0, 10),
    factory: "MOA Catalog",
    sampleSize: sizes.length ? sizes[Math.floor(sizes.length / 2)] : "—",
    projectNumber: order.orderNumber,
    garmentName: product.displayName,
    garmentColor: { name: variant?.colorLabel || "", tcx: variant?.colorTcx || "", hex: variant?.colorHex || "#1E1E1E" },
    inks,
    underbase: needsUnderbase(variant?.colorHex, placement.pantones),
    views: [
      {
        view: placement.view === "back" ? "Back" : "Front",
        mockupUrl: mockupUrl || (shot ? `${origin}${shot}` : ""),
        box: d.printBox,
        hpsY: d.hpsY,
        widthIn: d.widthIn,
        topBelowCollarIn: d.topBelowCollarIn,
        horizontal: d.horizontal,
        cfX: vcal.cfX,
        fromOffsetIn: Math.abs(d.fromCenterIn),
      },
    ],
  };

  try {
    const res = await fetch(`${MOA_PDF_URL}/api/decoration-sheet`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(process.env.PDF_API_SECRET ? { authorization: `Bearer ${process.env.PDF_API_SECRET}` } : {}) },
      body: JSON.stringify(data),
    });
    if (!res.ok) return null;
    return (await res.json()).url ?? null;
  } catch {
    return null;
  }
}
