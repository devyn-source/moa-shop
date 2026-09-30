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
export type PlateManifest = {
  style: string;
  hpsUv: Partial<Record<PlateView, { u: number; v: number }>>;
  cfU: Partial<Record<PlateView, number>>;
  pieces: Record<string, string>;
  pxSize: [number, number];
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
  const hps = m.hpsUv[view] ?? { u: 0, v: 0 };
  const cf = m.cfU[view] ?? hps.u;
  const w = p.widthIn * MM, h = w / aspect;
  const uc = cf + WEARER_LEFT_SIGN[view] * p.fromCfIn * MM;
  const vTop = hps.v - p.belowHpsIn * MM;
  return { u0: uc - w / 2, vTop, w, h };
}

// The inverse, for dragging: an art centre in mm -> inches from CF and below HPS.
export function inchesFromCentreMm(uc: number, vTop: number, view: PlateView, m: PlateManifest) {
  const hps = m.hpsUv[view] ?? { u: 0, v: 0 };
  const cf = m.cfU[view] ?? hps.u;
  return { fromCfIn: ((uc - cf) * WEARER_LEFT_SIGN[view]) / MM, belowHpsIn: (hps.v - vTop) / MM };
}

export const plateUrl = (base: string, colour: string, view: PlateView, file: "beauty" | "shading" | "uvmap" | "pieces") =>
  `${base}/${colour}/${view}/${file}.png`;
