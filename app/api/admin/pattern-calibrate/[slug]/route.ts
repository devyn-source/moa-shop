import { NextResponse } from "next/server";
import { apiError } from "@/lib/errors";
import { loadPatternDxfText } from "@/lib/pattern-files";
import { parsePatternFront, type PatternUnit } from "@/lib/pattern-geometry";
import { fetchViewAnalysis, viewCalFromAnalysis } from "@/lib/autocalibrate";
import { saveProductCalibration } from "@/lib/store";
import type { ProductCalibration } from "@/lib/zones";

// Admin-only (Basic Auth via proxy.ts). Reads the SKU's stored DXF pattern and
// extracts the front-shell's true dimensions, so placement calibration is driven
// by the cut geometry instead of a photo silhouette.
//   GET  → PREVIEW: extract + return the proposal (no save). Operator confirms.
//   POST → APPLY:   build + save the calibration from the confirmed values.
export const runtime = "nodejs";

function parseUnit(v: string | null): PatternUnit | undefined {
  return v === "mm" || v === "cm" || v === "in" ? v : undefined;
}

// PREVIEW — extract the front geometry, optionally with operator unit/fold
// overrides so they can correct the auto-resolution and re-preview live.
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const dxf = await loadPatternDxfText(slug);
    if (!dxf) return NextResponse.json({ error: "No DXF pattern file uploaded for this style." }, { status: 404 });

    const url = new URL(request.url);
    const unit = parseUnit(url.searchParams.get("unit"));
    const onFoldParam = url.searchParams.get("onFold");
    const onFold = onFoldParam === null ? undefined : onFoldParam === "true";

    const front = parsePatternFront(dxf.text, { unit, onFold });
    if (!front) {
      return NextResponse.json(
        { error: "Couldn't find a front shell piece in this DXF (looked for a 前 piece that isn't lining/fill/sleeve/etc.)." },
        { status: 422 }
      );
    }
    // Note whether a base mockup exists to anchor the calibration positions.
    const hasMockup = Boolean(await fetchViewAnalysis(slug, url.origin, "front"));
    return NextResponse.json({ ok: true, filename: dxf.filename, front, hasMockup });
  } catch (err) {
    return apiError(err, { fallback: "Couldn't read the pattern file." });
  }
}

// APPLY — compose the pattern-true chest with the mockup's positions and save.
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      unit?: PatternUnit;
      onFold?: boolean;
      frontWidthIn?: number; // confirmed full flat front width
    };

    const dxf = await loadPatternDxfText(slug);
    if (!dxf) return NextResponse.json({ error: "No DXF pattern file uploaded for this style." }, { status: 404 });

    const front = parsePatternFront(dxf.text, { unit: body.unit, onFold: body.onFold });
    if (!front) return NextResponse.json({ error: "Couldn't read a front piece from the DXF." }, { status: 422 });

    // Operator-confirmed full flat front width drives the ruler (realInches).
    const chestIn = typeof body.frontWidthIn === "number" && body.frontWidthIn > 0 ? body.frontWidthIn : front.frontWidthIn;

    const origin = new URL(request.url).origin;
    const fa = await fetchViewAnalysis(slug, origin, "front");
    if (!fa) {
      return NextResponse.json(
        { error: "No base-front.png mockup to anchor the calibration. Add the product shot first, then calibrate." },
        { status: 422 }
      );
    }
    const frontCal = viewCalFromAnalysis(fa, front.bodyLengthIn, chestIn);
    const cal: ProductCalibration = { front: frontCal };
    const ba = await fetchViewAnalysis(slug, origin, "back");
    // No back mockup → mirror the front calibration (same chest/HPS frame).
    cal.back = ba ? viewCalFromAnalysis(ba, front.bodyLengthIn, chestIn) : frontCal;

    await saveProductCalibration(slug, cal);
    return NextResponse.json({ ok: true, calibration: cal, appliedChestIn: chestIn, bodyLengthIn: front.bodyLengthIn });
  } catch (err) {
    return apiError(err, { fallback: "Couldn't apply the pattern calibration." });
  }
}
