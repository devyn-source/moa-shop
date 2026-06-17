import { NextResponse } from "next/server";
import { getProductBySlug } from "@/lib/store";
import { getProductSpec, reviewBurden, type GarmentPassport, type SizeChartPom, type BomRow, type ConstructionRow } from "@/lib/garment-spec";
import { getCatalogSpec, saveCatalogSpec } from "@/lib/garment-spec-store";
import { loadPatternDxfText } from "@/lib/pattern-files";
import { parsePatternFront } from "@/lib/pattern-geometry";
import { defaultMeasurements } from "@/lib/zones";
import { apiError } from "@/lib/errors";

// Admin (Basic Auth): create a DRAFT garment passport so /admin/specs/[slug] opens
// for review + lock. Seeds from the generated file spec where it exists, else from
// the catalog + the DXF size measurements. Everything seeded is _assumed:true (the
// review gate) — an operator confirms the real BOM/grading/construction, then locks.
export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const product = await getProductBySlug(slug);
    if (!product) return NextResponse.json({ error: "no product" }, { status: 404 });

    const existing = await getCatalogSpec(slug).catch(() => null);
    if (existing?._status === "approved") {
      return NextResponse.json({ error: "passport already approved — won't overwrite a locked spec" }, { status: 409 });
    }

    const now = new Date().toISOString();
    const fileSpec = getProductSpec(slug);
    let draft: GarmentPassport;
    let source: string;

    if (fileSpec) {
      draft = { ...fileSpec, _generatedAt: now, _status: "draft" };
      source = "generated-file";
    } else {
      const dxf = await loadPatternDxfText(slug).catch(() => null);
      const front = dxf ? parsePatternFront(dxf.text) : null;
      const variant = product.variants[0];
      const sizes = product.sizes.length ? product.sizes : ["S", "M", "L", "XL"];
      const baseSize = sizes[Math.floor(sizes.length / 2)];

      // DXF-derived base-size measurements keyed by POM-name fragment.
      const seed: { match: string; val: number | undefined }[] = [
        { match: "body length", val: front?.bodyLengthIn },
        { match: "chest width", val: front?.frontWidthIn },
        { match: "hem width", val: front?.hemWidthIn },
        { match: "shoulder width", val: front?.shoulderWidthIn },
      ];
      const poms: SizeChartPom[] = defaultMeasurements(product.category, sizes).rows.map((r) => {
        const hit = seed.find((s) => r.pom.toLowerCase().includes(s.match) && s.val != null);
        return {
          code: r.id.toUpperCase(),
          name: r.pom,
          tolerance: 0.5,
          bySize: hit ? { [baseSize]: hit.val as number } : {},
          _assumed: true, // grading + finished values await confirmation
        };
      });

      const bom: BomRow[] = [
        { component: "Shell fabric", spec: variant?.fabric ?? "—", composition: "", weightGsm: null, color: variant?.colorLabel ?? "", pantoneTcx: variant?.colorTcx ?? "", supplier: "", _assumed: true },
        { component: "Zipper / closure", spec: "Closure per style", composition: "", weightGsm: null, color: "Tonal", pantoneTcx: "", supplier: "", _assumed: true },
        { component: "Thread", spec: "Sewing thread", composition: "100% polyester", weightGsm: null, color: "Tonal", pantoneTcx: "", supplier: "", _assumed: true },
      ];
      const construction: ConstructionRow[] = [
        { area: "Body seams", detail: "Standard assembly", stitch: "Lockstitch", spi: null, seamClass: "SSa", _assumed: true },
        { area: "Hem / openings", detail: "Finished edge", stitch: "Coverstitch", spi: null, seamClass: "EFb", _assumed: true },
      ];

      draft = {
        styleNumber: product.skuCode,
        styleName: product.displayName,
        category: product.category,
        bom,
        sizeChart: { baseSize, poms },
        construction,
        labelsPackaging: { mainLabel: "", careLabel: "", sizeLabel: "", hangTag: "", fold: "", polybag: "", _assumed: true },
        flatsNeeded: ["Front", "Back"],
        openQuestions: [
          "Confirm shell fabric composition + weight (GSM).",
          "Confirm the full graded size chart — DXF seeded the base size only; add all sizes.",
          "Confirm construction (stitch type, SPI, seam class).",
          "Confirm labels + packaging.",
        ],
        _generatedAt: now,
        _status: "draft",
      };
      source = front ? "dxf+catalog" : "catalog";
    }

    await saveCatalogSpec(slug, draft, "draft");
    const burden = reviewBurden(draft);
    return NextResponse.json({
      ok: true,
      slug,
      source,
      reviewBurden: burden,
      sizeChartSeededFromDxf: draft.sizeChart.poms.filter((p) => Object.keys(p.bySize).length).map((p) => p.name),
      editorUrl: `/admin/specs/${slug}`,
    });
  } catch (err) {
    return apiError(err, { fallback: "Couldn't scaffold the passport." });
  }
}
