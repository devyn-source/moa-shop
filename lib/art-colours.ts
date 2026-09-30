// Reads the ink colours out of uploaded artwork in the browser, so the configurator
// can suggest a decoration method and pre-pick the nearest Pantone inks. Raster and
// SVG only (PDF/AI can't be drawn to a canvas); returns null when it can't read it.
import { PMS_PALETTE, hexToRgb, type PmsColor } from "./pantones";

export type ArtColours = { colours: string[]; photo: boolean };

const toHex = (r: number, g: number, b: number) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();

// Rough perceptual distance (weighted RGB), good enough to merge anti-aliasing.
function dist(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) {
  const rm = (a.r + b.r) / 2, dr = a.r - b.r, dg = a.g - b.g, db = a.b - b.b;
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}

export async function readArtColours(url: string): Promise<ArtColours | null> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  try { await img.decode(); } catch { return null; }
  const S = 160, k = Math.min(1, S / Math.max(img.naturalWidth || S, img.naturalHeight || S));
  const w = Math.max(1, Math.round((img.naturalWidth || S) * k)), h = Math.max(1, Math.round((img.naturalHeight || S) * k));
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  const ctx = cv.getContext("2d", { willReadFrequently: true }); if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  let data: Uint8ClampedArray;
  try { data = ctx.getImageData(0, 0, w, h).data; } catch { return null; }
  // Bucket opaque pixels at 4 bits per channel.
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  let opaque = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 200) continue;
    opaque++;
    const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++; e.r += data[i]; e.g += data[i + 1]; e.b += data[i + 2]; buckets.set(key, e);
  }
  if (!opaque) return null;
  const sorted = [...buckets.values()].sort((a, b) => b.n - a.n).map((e) => ({ n: e.n, r: e.r / e.n, g: e.g / e.n, b: e.b / e.n }));
  // Merge near-identical buckets (edges, compression noise), keep the ones that matter.
  const kept: { n: number; r: number; g: number; b: number }[] = [];
  for (const c of sorted) {
    const near = kept.find((k2) => dist(k2, c) < 70);
    if (near) near.n += c.n; else kept.push({ ...c });
  }
  const significant = kept.filter((c) => c.n / opaque >= 0.02);
  // A photo or gradient spreads across many buckets with no dominant few.
  const photo = significant.length > 8 || kept.length > 40;
  return { colours: significant.slice(0, 12).map((c) => toHex(Math.round(c.r), Math.round(c.g), Math.round(c.b))), photo };
}

export function nearestPms(hex: string): PmsColor {
  const c = hexToRgb(hex);
  return PMS_PALETTE.reduce((best, p) => (dist(hexToRgb(p.hex), c) < dist(hexToRgb(best.hex), c) ? p : best), PMS_PALETTE[0]);
}
