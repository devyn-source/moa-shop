// Photoreal plates: pre-rendered garment images whose every pixel knows its exact
// position on the pattern (millimetres), so artwork composites at real-inch
// placements that match the factory sheet. Format (the contract with the Blender
// pipeline in ~/projects/moa-express-render):
//   plates/<style>/<colour>/<view>/beauty.png   RGBA garment, photoreal
//   plates/<style>/<colour>/<view>/shading.png  grey, flat-white render (about 235 = flat lit)
//   plates/<style>/<colour>/<view>/uvmap.png    RGBA: u_mm, v_mm as 16-bit (mm + 1000) * 32, hi/lo bytes
//   plates/<style>/<colour>/<view>/pieces.png   8-bit piece id per pixel (0 none, 9 inner layer)
//   plates/<style>/manifest.json                hpsUv, cfU per view, pieces, pxSize, colours
import { decode } from "fast-png";

export type PlateView = "front" | "back";
// kind "2d": one photo per view (<base>/<view>.webp) + an affine calibration. The
// pattern position of a pixel is arithmetic: u = (x - cfX) / pxPerMm, v = (hpsY - y) / pxPerMm.
export type Plate2DView = { w: number; h: number; hpsY: number; cfX: number; pxPerIn: number };
export type PlateManifest = {
  kind?: "2d";
  v?: string; // content hash: cache-busting for long-lived CDN caching
  views?: Partial<Record<PlateView, Plate2DView>>;
  style: string;
  hpsUv?: Partial<Record<PlateView, { u: number; v: number }>>;
  cfU?: Partial<Record<PlateView, number>>;
  pieces?: Record<string, string>;
  pxSize?: [number, number];
  colours: Record<string, string>;
};

export type DecorationMethod = "screen_print" | "embroidery" | "rubber_applique";

// One artwork placement, in the same units the shop and the factory sheet use.
export type PlatePlacement = {
  id: string;
  artUrl: string;
  piece: number; // pattern piece it prints on (1 front body, 2 back body, ...)
  widthIn: number;
  belowHpsIn: number; // top edge of the art below HPS
  fromCfIn: number; // art centre from CF/CB, positive = wearer's left
  rotDeg?: number;
  method?: DecorationMethod;
};

// Pattern u runs toward the wearer's left on the front body and toward the
// wearer's right on the back body (panels are laid out as seen from outside).
export const WEARER_LEFT_SIGN: Record<PlateView, number> = { front: 1, back: -1 };
export const MM = 25.4;

export type DecodedMap = { width: number; height: number; data: Uint8Array; channels: number };

// Decode a data PNG without the browser touching it (no premultiplied alpha,
// no colour management), so the encoded millimetres survive exactly.
export async function loadDataPng(url: string): Promise<DecodedMap> {
  const buf = await (await fetch(url)).arrayBuffer();
  const img = decode(new Uint8Array(buf));
  const data = img.data instanceof Uint8Array ? img.data : new Uint8Array(img.data.buffer);
  return { width: img.width, height: img.height, data, channels: img.channels };
}

export const decodeMm = (hi: number, lo: number) => (hi * 256 + lo) / 32 - 1000;

// What is under a plate pixel: its pattern position (mm) and piece id.
export function sampleAt(uv: DecodedMap, pieces: DecodedMap, x: number, y: number): { u: number; v: number; piece: number } | null {
  const px = Math.max(0, Math.min(uv.width - 1, Math.round(x))), py = Math.max(0, Math.min(uv.height - 1, Math.round(y)));
  const i = (py * uv.width + px) * uv.channels;
  const d = uv.data;
  if (!d[i] && !d[i + 1] && !d[i + 2] && !d[i + 3]) return null;
  const piece = pieces.data[(py * pieces.width + px) * pieces.channels];
  return { u: decodeMm(d[i], d[i + 1]), v: decodeMm(d[i + 2], d[i + 3]), piece };
}

// Placement (inches) -> the art rectangle in pattern millimetres.
export function artRectMm(p: PlatePlacement, view: PlateView, m: PlateManifest, aspect: number) {
  const hps = m.hpsUv?.[view] ?? { u: 0, v: 0 };
  const cf = m.cfU?.[view] ?? hps.u;
  const w = p.widthIn * MM, h = w / aspect;
  const uc = cf + WEARER_LEFT_SIGN[view] * p.fromCfIn * MM;
  const vTop = hps.v - p.belowHpsIn * MM;
  return { u0: uc - w / 2, vTop, w, h };
}

// The inverse, for dragging: an art centre in mm -> inches from CF and below HPS.
export function inchesFromCentreMm(uc: number, vTop: number, view: PlateView, m: PlateManifest) {
  const hps = m.hpsUv?.[view] ?? { u: 0, v: 0 };
  const cf = m.cfU?.[view] ?? hps.u;
  return { fromCfIn: ((uc - cf) * WEARER_LEFT_SIGN[view]) / MM, belowHpsIn: (hps.v - vTop) / MM };
}

export const plateUrl = (base: string, colour: string, view: PlateView, file: "beauty" | "shading" | "uvmap" | "pieces") =>
  `${base}/${colour}/${view}/${file}.png`;

// ---------- Printable areas (seam aware) ----------
// Rasterise where each pattern piece is VISIBLE on the plate into a millimetre
// grid, then keep only cells at least `clearanceMm` from the piece's edge (side
// seams, collar, hem, armholes). Art must sit fully inside that area and must not
// cross onto another piece. The same grid maps millimetres back to plate pixels
// for the landmark guides.
export type Coverage = {
  piece: number; cell: number; u0: number; v0: number; cols: number; rows: number;
  inside: Uint8Array; // 1 = printable cell
  px: Float32Array; // per cell: mean plate x, y (NaN when unseen)
};

export function buildCoverage(uv: DecodedMap, pieces: DecodedMap, piece: number, clearanceMm = 19, cell = 2): Coverage {
  let umin = Infinity, umax = -Infinity, vmin = Infinity, vmax = -Infinity;
  const W = uv.width, H = uv.height, step = W < 1200 ? 1 : 2; // small helper maps: sample every pixel
  for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) {
    if (pieces.data[(y * W + x) * pieces.channels] !== piece) continue;
    const i = (y * W + x) * uv.channels, u = decodeMm(uv.data[i], uv.data[i + 1]), v = decodeMm(uv.data[i + 2], uv.data[i + 3]);
    if (u < umin) umin = u; if (u > umax) umax = u; if (v < vmin) vmin = v; if (v > vmax) vmax = v;
  }
  if (!isFinite(umin)) return { piece, cell, u0: 0, v0: 0, cols: 0, rows: 0, inside: new Uint8Array(), px: new Float32Array() };
  const cols = Math.ceil((umax - umin) / cell) + 1, rows = Math.ceil((vmax - vmin) / cell) + 1;
  const seen = new Uint8Array(cols * rows), sx = new Float32Array(cols * rows), sy = new Float32Array(cols * rows), n = new Uint16Array(cols * rows);
  for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) {
    if (pieces.data[(y * W + x) * pieces.channels] !== piece) continue;
    const i = (y * W + x) * uv.channels, u = decodeMm(uv.data[i], uv.data[i + 1]), v = decodeMm(uv.data[i + 2], uv.data[i + 3]);
    const c = Math.floor((u - umin) / cell), r = Math.floor((vmax - v) / cell), k = r * cols + c;
    seen[k] = 1; sx[k] += x; sy[k] += y; n[k]++;
  }
  // close pinholes (a cell with seen neighbours on both sides is visible fabric)
  const filled = seen.slice();
  for (let r = 1; r < rows - 1; r++) for (let c = 1; c < cols - 1; c++) {
    const k = r * cols + c; if (seen[k]) continue;
    if ((seen[k - 1] && seen[k + 1]) || (seen[k - cols] && seen[k + cols])) filled[k] = 1;
  }
  // distance from the edge in cells (two-pass chamfer), then threshold
  const INF = 1e6, dist = new Float32Array(cols * rows);
  for (let k = 0; k < dist.length; k++) dist[k] = filled[k] ? INF : 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const k = r * cols + c; if (!dist[k]) continue;
    const up = r ? dist[k - cols] : 0, lf = c ? dist[k - 1] : 0;
    dist[k] = Math.min(dist[k], up + 1, lf + 1);
  }
  for (let r = rows - 1; r >= 0; r--) for (let c = cols - 1; c >= 0; c--) {
    const k = r * cols + c; if (!dist[k]) continue;
    const dn = r < rows - 1 ? dist[k + cols] : 0, rt = c < cols - 1 ? dist[k + 1] : 0;
    dist[k] = Math.min(dist[k], dn + 1, rt + 1);
  }
  const need = clearanceMm / cell, inside = new Uint8Array(cols * rows), px = new Float32Array(cols * rows * 2).fill(NaN);
  for (let k = 0; k < inside.length; k++) {
    inside[k] = dist[k] >= need ? 1 : 0;
    if (n[k]) { px[k * 2] = sx[k] / n[k]; px[k * 2 + 1] = sy[k] / n[k]; }
  }
  return { piece, cell, u0: umin, v0: vmax, cols, rows, inside, px };
}

const cellOf = (cv: Coverage, u: number, v: number) => {
  const c = Math.floor((u - cv.u0) / cv.cell), r = Math.floor((cv.v0 - v) / cv.cell);
  return c < 0 || r < 0 || c >= cv.cols || r >= cv.rows ? -1 : r * cv.cols + c;
};

// Plate pixel for a pattern position (nearest seen cell), for drawing guides.
export function mmToPx(cv: Coverage, u: number, v: number): [number, number] | null {
  const k0 = cellOf(cv, u, v);
  if (k0 >= 0 && !isNaN(cv.px[k0 * 2])) return [cv.px[k0 * 2], cv.px[k0 * 2 + 1]];
  for (let rad = 1; rad < 12; rad++) for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) {
    const k = cellOf(cv, u + dc * cv.cell, v - dr * cv.cell);
    if (k >= 0 && !isNaN(cv.px[k * 2])) return [cv.px[k * 2], cv.px[k * 2 + 1]];
  }
  return null;
}

export type PrintCheck = { ok: boolean; reason?: string };

// Is the whole art rectangle inside the printable area? If not, say which way and how far.
export function checkPrintable(cv: Coverage, r: { u0: number; vTop: number; w: number; h: number }, clearanceIn: number): PrintCheck {
  if (!cv.cols) return { ok: true };
  let bad = 0, worst = { dl: 0, dr: 0, dt: 0, db: 0 };
  const N = 24;
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const u = r.u0 + (r.w * i) / N, v = r.vTop - (r.h * j) / N, k = cellOf(cv, u, v);
    if (k >= 0 && cv.inside[k]) continue;
    bad++;
    if (i === 0) worst.dl++; if (i === N) worst.dr++; if (j === 0) worst.dt++; if (j === N) worst.db++;
  }
  if (!bad) return { ok: true };
  const clr = `${clearanceIn} in`;
  if (worst.dt >= Math.max(worst.dl, worst.dr, worst.db)) return { ok: false, reason: `Too close to the top edge or seam. Keep ${clr} clear.` };
  if (worst.db >= Math.max(worst.dl, worst.dr)) return { ok: false, reason: `Too close to the bottom edge, hem or pocket. Keep ${clr} clear.` };
  return { ok: false, reason: `Too close to the side edge or seam. Keep ${clr} clear.` };
}

// For a 2D plate: build small helper maps (uv + piece) from the photo's alpha and the
// affine calibration, so dragging, guides and seam checks work without any data files.
export function helperMaps2D(alpha: Uint8ClampedArray, w: number, h: number, scale: number, cal: Plate2DView, view: PlateView): { uv: DecodedMap; pieces: DecodedMap } {
  const uv = new Uint8Array(w * h * 4), pieces = new Uint8Array(w * h);
  const ppmm = (cal.pxPerIn / MM) * scale, cf = cal.cfX * scale, hps = cal.hpsY * scale;
  const enc = (mm: number) => Math.max(0, Math.min(65535, Math.round((mm + 1000) * 32)));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = y * w + x;
    if (alpha[k * 4 + 3] < 128) continue;
    pieces[k] = view === "front" ? 1 : 2;
    const U = enc((x - cf) / ppmm), V = enc((hps - y) / ppmm);
    uv[k * 4] = U >> 8; uv[k * 4 + 1] = U & 255; uv[k * 4 + 2] = V >> 8; uv[k * 4 + 3] = V & 255;
  }
  return { uv: { width: w, height: h, data: uv, channels: 4 }, pieces: { width: w, height: h, data: pieces, channels: 1 } };
}
