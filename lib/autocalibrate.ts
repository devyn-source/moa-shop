// Spec-driven auto-calibration. Detects a SKU's garment silhouette in its base
// mockup and anchors it to the real spec measurements (body length + chest) so
// the calibration "ruler" is filled automatically instead of dragged by hand.
//
// Scale basis = BODY LENGTH (vertical silhouette extent) — robust, arms rarely
// extend past the hem. CHEST width is used only as a confidence cross-check
// (and to auto-resolve flat-vs-circumference specs). Always returns a confidence
// so the operator knows which SKUs are trustworthy vs need a nudge in Studio.
import sharp from "sharp";
import { getProductMeasurements } from "./store";
import { normaliseMeasurements, type ProductCalibration } from "./zones";

type Analysis = { W: number; H: number; bbox: { l: number; t: number; r: number; b: number }; chestFrac: number };

const round3 = (n: number) => Math.round(n * 1000) / 1000;
const quarter = (n: number) => Math.round(n * 4) / 4;

// Silhouette bbox + chest-line width, as fractions of the image. Uses the alpha
// channel when the mockup is a cutout; falls back to a non-white mask otherwise.
async function analyze(buf: Buffer): Promise<Analysis | null> {
  const { data, info } = await sharp(buf).resize({ width: 420 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, ch = info.channels;
  const A = (x: number, y: number) => data[(y * W + x) * ch + (ch - 1)];
  const isWhite = (x: number, y: number) => {
    const i = (y * W + x) * ch;
    return data[i] > 245 && data[i + 1] > 245 && data[i + 2] > 245;
  };

  // Decide mask source: if alpha is ~all opaque, use non-white instead.
  let opaque = 0;
  for (let y = 0; y < H; y += 3) for (let x = 0; x < W; x += 3) if (A(x, y) > 20) opaque++;
  const samples = Math.ceil(H / 3) * Math.ceil(W / 3);
  const useAlpha = opaque / samples < 0.97;
  const on = (x: number, y: number) => (useAlpha ? A(x, y) > 20 : !isWhite(x, y));

  let minX = W, minY = H, maxX = -1, maxY = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (on(x, y)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;

  // chest line ≈ 28% down from the top of the silhouette
  const cy = Math.round(minY + 0.28 * (maxY - minY));
  let cl = W, cr = -1;
  for (let x = 0; x < W; x++) if (on(x, cy)) { if (x < cl) cl = x; if (x > cr) cr = x; }
  const chestFrac = cr >= 0 ? (cr - cl) / W : 0;

  return { W, H, bbox: { l: minX / W, t: minY / H, r: maxX / W, b: maxY / H }, chestFrac };
}

export type AutoCalResult =
  | { ok: false; error: string }
  | { ok: true; calibration: ProductCalibration; confidence: "high" | "medium" | "low" | "unknown"; ratio: number; bodyLen: number; chest: number | null; sample: string };

export async function autoCalibrate(slug: string, origin: string): Promise<AutoCalResult> {
  const meas = normaliseMeasurements(await getProductMeasurements(slug));
  if (!meas) return { ok: false, error: "No spec measurements stored for this SKU — load a grading spec first." };
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
  const bodyLen = find(["FRONT BODY LENGTH", "FRONT LENGTH", "BODY LENGTH", "CENTER BACK LENGTH"]);
  const chest = find(["CHEST"]);
  if (!bodyLen) return { ok: false, error: "Spec has no body-length point of measure to scale from." };

  const cal: ProductCalibration = {};
  let frontA: Analysis | null = null;
  for (const view of ["front", "back"] as const) {
    let buf: Buffer | null = null;
    try {
      const res = await fetch(`${origin}/products/${slug}/base-${view}.png`);
      if (res.ok) buf = Buffer.from(await res.arrayBuffer());
    } catch {
      /* ignore */
    }
    if (!buf) {
      if (view === "back" && cal.front) cal.back = { ...cal.front };
      continue;
    }
    const a = await analyze(buf);
    if (!a) {
      if (view === "back" && cal.front) cal.back = { ...cal.front };
      continue;
    }
    if (view === "front") frontA = a;
    const ippLen = bodyLen / ((a.bbox.b - a.bbox.t) * a.H); // inches per pixel
    const widthPx = (a.bbox.r - a.bbox.l) * a.W;
    cal[view] = {
      hpsY: round3(a.bbox.t),
      cfX: round3((a.bbox.l + a.bbox.r) / 2),
      scaleAx: round3(a.bbox.l),
      scaleBx: round3(a.bbox.r),
      realInches: quarter(widthPx * ippLen),
    };
  }
  if (!cal.front) return { ok: false, error: `No base mockup at /products/${slug}/base-front.png to detect the garment.` };
  if (!cal.back) cal.back = { ...cal.front };

  // Confidence: chest-derived scale vs length-derived scale, auto-picking the
  // flat-vs-circumference reading of the chest spec that best agrees.
  let confidence: "high" | "medium" | "low" | "unknown" = "unknown";
  let ratio = 0;
  if (chest && frontA && frontA.chestFrac > 0) {
    const ippLen = bodyLen / ((frontA.bbox.b - frontA.bbox.t) * frontA.H);
    const chestPx = frontA.chestFrac * frontA.W;
    let bestErr = Infinity;
    for (const c of [chest, chest / 2]) {
      const rr = c / chestPx / ippLen;
      const e = Math.abs(Math.log(rr));
      if (e < bestErr) { bestErr = e; ratio = rr; }
    }
    confidence = ratio > 0.82 && ratio < 1.22 ? "high" : ratio > 0.65 && ratio < 1.5 ? "medium" : "low";
  }
  return { ok: true, calibration: cal, confidence, ratio: Math.round(ratio * 100) / 100, bodyLen, chest, sample };
}
