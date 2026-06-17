import { NextResponse } from "next/server";
import { apiError } from "@/lib/errors";
import { getModelUrl, loadPatternDxfText } from "@/lib/pattern-files";
import { parsePatternFront } from "@/lib/pattern-geometry";
import { fetchGlbBBox } from "@/lib/glb-bbox";
import { getProductMeasurements, getProductCalibration, saveProductCalibration } from "@/lib/store";
import { normaliseMeasurements, normaliseCalibration, STUDIO_FIT_UNITS, type Model3DCalibration, type ProductCalibration } from "@/lib/zones";

// Admin-only (Basic Auth via proxy.ts). THE 3D-anchored calibration automation.
// Anchors the SKU's 3D model to its real dimensions so placement is derived off
// the actual mesh surface (lib/zones model3dPlacement), not a 2D silhouette.
//
//   GET  → PREVIEW: compute + return the proposed calibration (no save).
//   POST → APPLY:   compute + merge into product_zones.calibration (keeps the
//                   2D front/back ruler as a fallback for non-3D contexts).
//
// Source of truth for SCALE: the DXF body length (HPS→hem) when a pattern exists,
// else the graded BODY LENGTH point of measure at the sample size. The model's
// raw GLB bbox + the viewer normalization give world units; one division yields
// inches-per-world. Chest is a cross-check, surfaced as a confidence.
export const runtime = "nodejs";

const round = (n: number, p = 4) => Math.round(n * 10 ** p) / 10 ** p;

type Computed =
  | { ok: false; error: string; status: number }
  | {
      ok: true;
      model3d: Model3DCalibration;
      report: {
        modelUrl: string;
        rawSize: { x: number; y: number; z: number };
        worldHeight: number;
        bodyLengthIn: number;
        chestWidthIn: number | null;
        impliedModelWidthIn: number;
        chestRatio: number | null;
        source: string;
        confidence: string;
      };
    };

// Pull a body-length + chest from the graded spec (sample size), used when there's
// no DXF (or to corroborate it).
function fromSpec(meas: ReturnType<typeof normaliseMeasurements>): { bodyLen: number | null; chest: number | null } {
  if (!meas) return { bodyLen: null, chest: null };
  const sample = meas.sampleSize || "M";
  const find = (kws: string[]): number | null => {
    for (const r of meas.rows) {
      const p = r.pom.toUpperCase();
      if (kws.some((k) => p.includes(k))) {
        const v = r.values[sample];
        if (typeof v === "number" && Number.isFinite(v)) return v;
      }
    }
    return null;
  };
  return {
    // tops anchor on body length; bottoms have none → fall back to OUTSEAM, the
    // garment's vertical extent (waist→hem along the side).
    bodyLen: find(["FRONT BODY LENGTH", "FRONT LENGTH", "BODY LENGTH", "CENTER BACK LENGTH", "OUTSEAM", "OUTER LENGTH", "OUTER"]),
    chest: find(["CHEST", "WAIST EXTEND", "WAIST CIRC", "WAIST"]),
  };
}

async function compute(slug: string): Promise<Computed> {
  const modelUrl = await getModelUrl(slug);
  if (!modelUrl) return { ok: false, error: "No 3D model (GLB) uploaded for this SKU — add the model first.", status: 404 };
  const bbox = await fetchGlbBBox(modelUrl);
  if (!bbox) return { ok: false, error: "Couldn't read the GLB bounding box (no positioned geometry / unreadable file).", status: 422 };

  // Real dimensions: prefer the DXF pattern, fall back to the graded spec.
  const dxf = await loadPatternDxfText(slug).catch(() => null);
  const front = dxf ? parsePatternFront(dxf.text) : null;
  const meas = normaliseMeasurements(await getProductMeasurements(slug).catch(() => null));
  const spec = fromSpec(meas);

  const bodyLengthIn = front?.bodyLengthIn ?? spec.bodyLen;
  if (!bodyLengthIn || bodyLengthIn <= 0) {
    return { ok: false, error: "No body-length to anchor scale — need a DXF front piece or a BODY LENGTH point of measure.", status: 422 };
  }
  // Chest: DXF flat front width is exact; spec chest is full circumference-ish,
  // so try the flat reading (c/2) that best matches the model's implied width.
  const chestWidthIn = front?.frontWidthIn ?? (spec.chest != null ? spec.chest : null);

  const [rx, ry, rz] = bbox.size;
  const maxRaw = Math.max(rx, ry, rz) || 1;
  const worldHeight = (ry / maxRaw) * STUDIO_FIT_UNITS; // vertical extent after the viewer normalizes
  const inchesPerWorld = bodyLengthIn / (worldHeight || 1);
  const hpsWorldY = worldHeight / 2; // centered model → top edge is +H/2

  // Cross-check: what real flat width does the model imply, vs the spec chest?
  const impliedModelWidthIn = round((rx / maxRaw) * STUDIO_FIT_UNITS * inchesPerWorld, 2);
  let chestRatio: number | null = null;
  let confidence: Model3DCalibration["confidence"] = front ? "medium" : "low";
  if (chestWidthIn && chestWidthIn > 0) {
    // pick the flat-vs-circumference reading of chest that best matches the model
    const candidates = front ? [chestWidthIn] : [chestWidthIn, chestWidthIn / 2];
    let best = Infinity;
    let bestChest = chestWidthIn;
    for (const c of candidates) {
      const e = Math.abs(Math.log(impliedModelWidthIn / c));
      if (e < best) { best = e; bestChest = c; chestRatio = round(impliedModelWidthIn / c, 2); }
    }
    confidence = best < 0.2 ? "high" : best < 0.45 ? "medium" : "low";
    void bestChest;
  } else if (front) {
    confidence = "high"; // DXF body length is trustworthy even without a chest check
  }

  const source: Model3DCalibration["source"] = front && spec.bodyLen ? "dxf+spec" : front ? "dxf" : "spec";

  const model3d: Model3DCalibration = {
    fitUnits: STUDIO_FIT_UNITS,
    inchesPerWorld: round(inchesPerWorld),
    hpsWorldY: round(hpsWorldY),
    cfWorldX: 0,
    bodyLengthIn: round(bodyLengthIn, 2),
    chestWidthIn: chestWidthIn != null ? round(chestWidthIn, 2) : null,
    confidence,
    source,
  };

  return {
    ok: true,
    model3d,
    report: {
      modelUrl,
      rawSize: { x: round(rx, 3), y: round(ry, 3), z: round(rz, 3) },
      worldHeight: round(worldHeight),
      bodyLengthIn: round(bodyLengthIn, 2),
      chestWidthIn: chestWidthIn != null ? round(chestWidthIn, 2) : null,
      impliedModelWidthIn,
      chestRatio,
      source,
      confidence,
    },
  };
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const r = await compute(slug);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, slug, model3d: r.model3d, report: r.report });
  } catch (err) {
    return apiError(err, { fallback: "Couldn't compute the 3D calibration." });
  }
}

export async function POST(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const r = await compute(slug);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    // Merge model3d into the existing calibration so the 2D ruler stays as a fallback.
    const existing = (normaliseCalibration(await getProductCalibration(slug).catch(() => null)) ?? {}) as ProductCalibration;
    const merged: ProductCalibration = { ...existing, model3d: r.model3d };
    await saveProductCalibration(slug, merged);
    return NextResponse.json({ ok: true, slug, model3d: r.model3d, report: r.report });
  } catch (err) {
    return apiError(err, { fallback: "Couldn't apply the 3D calibration." });
  }
}
