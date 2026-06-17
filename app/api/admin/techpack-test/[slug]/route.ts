import { NextResponse } from "next/server";
import { getProductBySlug, getProductCalibration } from "@/lib/store";
import { buildDecorationSheetData, buildDecorationSheetUrl } from "@/lib/decoration-sheet";
import { buildTechPackUrl } from "@/lib/tech-pack";
import { getCatalogSpec } from "@/lib/garment-spec-store";
import { isPassportLocked } from "@/lib/garment-spec";
import { getDefaultZones } from "@/lib/zones";
import { apiError } from "@/lib/errors";
import type { ShopOrder, ArtworkPlacement } from "@/lib/types";

// Admin QA tool (Basic Auth via proxy): exercises the REAL pattern → placement →
// tech-pack chain for a SKU with a sample left-chest placement. Surfaces the
// derived real-inch spec, the decoration-sheet PDF (Layer 2), the merged tech
// pack (Layer 1+2), and every gate state — so we can verify production-readiness.
export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const product = await getProductBySlug(slug);
    if (!product) return NextResponse.json({ error: "no product" }, { status: 404 });
    const variant = product.variants[0];
    const zone = getDefaultZones(product).front.find((z) => z.id === "left-chest") ?? getDefaultZones(product).front[0];
    const origin = new URL(request.url).origin;

    const placement: ArtworkPlacement = {
      view: "front",
      zoneId: zone.id,
      zoneLabel: zone.label,
      box: zone.box,
      art: { ox: 0, oy: 0, sx: 1, sy: 1 },
      method: "Screen print",
      colors: 1,
      pantones: [{ code: "18-1561 TCX", name: "Terracotta", hex: "#B04731" }],
      maxColors: 4,
      artworkFileUrl: `${origin}/work/bigface-tee.png`,
      artworkFileName: "logo.png",
    };

    const order = {
      id: "techpack-test",
      orderNumber: "MOA-S-TEST",
      contactName: "QA", contactEmail: "qa@magnumopus.agency", contactPhone: "", companyName: "MOA QA",
      productId: product.id, variantId: variant.id,
      decorationIds: ["screen_print"], quantity: 50,
      perUnitUsd: 100, decorationAdderUsd: 4, subtotalUsd: 5000, taxUsd: 0, totalUsd: 5200,
      artworkFileName: "logo.png", artworkFileUrl: placement.artworkFileUrl, artworkNotes: "",
      artworkPlacement: placement, artworkPlacements: [placement],
      sizeBreakdown: { S: 10, M: 20, L: 15, XL: 5 }, paymentStatus: "simulated_paid",
    } as unknown as ShopOrder;

    // ?mockup= lets QA pass a PUBLIC image (e.g. the 3D thumbnail) so the sheet's
    // garment image renders (moa-pdf can't reach a localhost mockup URL).
    const mockup = new URL(request.url).searchParams.get("mockup") || `${origin}/products/${slug}/base-front.png`;
    const data = await buildDecorationSheetData(order, mockup).catch((e) => ({ error: String(e) }));
    const decorationSheetUrl = await buildDecorationSheetUrl(order, mockup).catch(() => null);
    const techPackUrl = await buildTechPackUrl(order, mockup).catch(() => null);

    const spec = await getCatalogSpec(slug).catch(() => null);
    const calibration = await getProductCalibration(slug).catch(() => null);
    const view = (data as { views?: unknown[] })?.views?.[0] ?? null;

    // ?forcePassport=1 — render the MERGED tech pack with the current draft
    // passport force-completed IN MEMORY (no DB write), to verify the moa-pdf
    // catalog-tech-pack template renders. NOT a real lock.
    let forcedTechPackUrl: string | null = null;
    if (new URL(request.url).searchParams.get("forcePassport") === "1" && spec) {
      const complete = {
        ...spec,
        audience: "vendor",
        dateCreated: new Date().toISOString().slice(0, 10),
        bom: spec.bom.map((r) => ({ ...r, _assumed: false })),
        construction: spec.construction.map((r) => ({ ...r, _assumed: false })),
        sizeChart: { ...spec.sizeChart, poms: spec.sizeChart.poms.map((r) => ({ ...r, _assumed: false })) },
        labelsPackaging: { ...spec.labelsPackaging, _assumed: false },
        openQuestions: [],
        _status: "approved" as const,
      };
      try {
        const r = await fetch(`${process.env.MOA_PDF_URL || "https://moa-pdf-fawn.vercel.app"}/api/catalog-tech-pack`, {
          method: "POST",
          headers: { "content-type": "application/json", ...(process.env.PDF_API_SECRET ? { authorization: `Bearer ${process.env.PDF_API_SECRET}` } : {}) },
          body: JSON.stringify({ passport: complete, ...(data && !(data as { error?: string }).error ? { decoration: data } : {}) }),
        });
        forcedTechPackUrl = r.ok ? (await r.json()).url ?? null : `moa-pdf ${r.status}`;
      } catch (e) {
        forcedTechPackUrl = `error: ${String(e)}`;
      }
    }

    return NextResponse.json({
      slug,
      gates: {
        calibrated: Boolean(calibration),
        hasPassport: Boolean(spec),
        passportLocked: spec ? isPassportLocked(spec) : false,
      },
      derivedSpec: view, // the real-inch placement callouts (width/height, below-collar, from-CF)
      decorationSheetUrl, // Layer 2 — the per-order placement spec PDF
      techPackUrl, // Layer 1+2 merged — null until a locked passport exists
      forcedTechPackUrl, // ?forcePassport=1 — merged render with an in-memory complete passport (QA only)
    });
  } catch (err) {
    return apiError(err, { fallback: "techpack test failed" });
  }
}
