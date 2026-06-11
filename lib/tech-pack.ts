// The full VENDOR tech pack: Garment Passport (Layer 1, per-SKU locked spec) +
// the order's Decoration Sheet (Layer 2, per-order placement spec), merged by
// moa-pdf POST /api/catalog-tech-pack into one PDF.
//
// HARD GATE: returns null unless the SKU's passport isPassportLocked() — every
// field confirmed, zero open questions, explicitly approved. Nothing assumed
// ever reaches a vendor; an order without a tech pack simply ships no pack URL
// to MoaOS and the PO falls back to the existing display spec.
import type { ShopOrder } from "./types";
import { getProductById } from "./store";
import { getCatalogSpec } from "./garment-spec-store";
import { isPassportLocked } from "./garment-spec";
import { buildDecorationSheetData } from "./decoration-sheet";

const MOA_PDF_URL = process.env.MOA_PDF_URL || "https://moa-pdf-fawn.vercel.app";

export async function buildTechPackUrl(order: ShopOrder, mockupUrl: string | null): Promise<string | null> {
  const product = await getProductById(order.productId);
  if (!product) return null;

  const spec = await getCatalogSpec(product.slug).catch(() => null);
  if (!spec || !isPassportLocked(spec)) return null; // the gate — see header comment

  // Decoration layer is optional (e.g. a blank packaging line) — the passport
  // alone is still a valid factory document.
  const decoration = await buildDecorationSheetData(order, mockupUrl).catch(() => null);

  try {
    const res = await fetch(`${MOA_PDF_URL}/api/catalog-tech-pack`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.PDF_API_SECRET ? { authorization: `Bearer ${process.env.PDF_API_SECRET}` } : {}),
      },
      body: JSON.stringify({
        // audience:"vendor" renders ONLY the locked spec — no draft markers,
        // no review legend, no open-questions page.
        passport: { ...spec, audience: "vendor", dateCreated: new Date().toISOString().slice(0, 10) },
        ...(decoration ? { decoration } : {}),
      }),
    });
    if (!res.ok) return null;
    return (await res.json()).url ?? null;
  } catch {
    return null;
  }
}
