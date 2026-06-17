// PHASE 2 of the 3D-driven placement system: turn a captured mesh UV (from the
// 3D decal editor, lib/Garment3DDecorator) into a real-inch production spec on
// the DXF pattern — the numbers the tech pack prints.
//
// The chain: decal UV → pattern piece (real inches) → offsets from HPS/CF.
// This is exact ONLY when the model's UVs are pattern-aligned (the vendor spec,
// docs/3d-model-spec.md): the front piece's UV island matches the cut piece's
// proportions/orientation. Until a SKU has a VERIFIED aligned model, its
// registration stays `aligned: false` and the tech pack keeps using the 2D
// calibration fallback — so this never ships a wrong number on a generic model.
import { loadPatternDxfText } from "./pattern-files";
import { parsePatternFront } from "./pattern-geometry";

// Per-SKU map from the front-piece UV region to its real-inch pattern frame.
// Defaults assume a clean aligned export: the front body fills UV [0,1]², CF at
// u=0.5, HPS at the top (v=1), hem at the bottom (v=0). Override per SKU once a
// real aligned model is registered.
export type PatternRegistration = {
  slug: string;
  aligned: boolean; // gate — only trust UV→pattern math when an aligned model is verified
  frontWidthIn: number; // true flat front width (from the DXF)
  bodyLengthIn: number; // HPS → hem (from the DXF)
  uv: { u0: number; u1: number; v0: number; v1: number; cfU: number; hpsV: number }; // front-piece UV bounds + datums
  worldFitUnits: number; // the normalization target the viewer fits models to (Garment3D: 1.55)
};

export type PatternSpec = {
  fromCenterIn: number; // signed: + = wearer's L of CF (matches derivePlacement convention)
  belowHpsIn: number;
  widthIn: number;
  heightIn: number;
  horizontal: string;
};

const DEFAULT_UV = { u0: 0, u1: 1, v0: 0, v1: 1, cfU: 0.5, hpsV: 1 };

// Build a registration from the SKU's DXF (dims) + default UV mapping. `aligned`
// is false until a verified aligned model + UV bounds are persisted for the SKU.
export async function buildRegistration(slug: string): Promise<PatternRegistration | null> {
  const dxf = await loadPatternDxfText(slug);
  if (!dxf) return null;
  const front = parsePatternFront(dxf.text);
  if (!front) return null;
  return {
    slug,
    aligned: false, // flip to true per SKU once the aligned model is registered
    frontWidthIn: front.frontWidthIn,
    bodyLengthIn: front.bodyLengthIn,
    uv: DEFAULT_UV,
    worldFitUnits: 1.55,
  };
}

const quarter = (n: number) => Math.round(n * 4) / 4;

// Convert a captured 3D placement (UV + decal size) into a real-inch pattern
// spec. `artAspect` = art width/height (for the printed width). Returns null when
// the UV is missing or the registration isn't aligned (→ caller falls back).
export function uvToPatternSpec(
  reg: PatternRegistration,
  placement: { uv: [number, number] | null; sizeUv: number; rotationDeg: number },
  artAspect = 1
): PatternSpec | null {
  if (!reg.aligned || !placement.uv) return null;
  const [u, v] = placement.uv;
  const { u0, u1, v0, v1, cfU, hpsV } = reg.uv;

  // Position on the front piece → inches from CF (horizontal) and HPS (vertical).
  const cfFrac = (cfU - u0) / (u1 - u0 || 1);
  const localU = (u - u0) / (u1 - u0 || 1);
  const fromCenterIn = quarter((localU - cfFrac) * reg.frontWidthIn);

  // v runs hem(v0)→HPS(hpsV); distance below HPS scales by body length.
  const downFrac = (hpsV - v) / (hpsV - v0 || 1);
  const belowHpsIn = quarter(Math.max(0, downFrac * reg.bodyLengthIn));

  // Printed size: the decal half-height in world units → inches via the model's
  // fit normalization (worldFitUnits == bodyLengthIn at fit). size*2 = full height.
  const inchesPerWorld = reg.bodyLengthIn / (reg.worldFitUnits || 1);
  const heightIn = quarter(placement.sizeUv * 2 * inchesPerWorld);
  const widthIn = quarter(heightIn * artAspect);

  let horizontal: string;
  if (Math.abs(fromCenterIn) < 0.26) horizontal = "Centered";
  else horizontal = `${Math.abs(fromCenterIn).toFixed(2).replace(/\.?0+$/, "")}" ${fromCenterIn > 0 ? "wearer's L" : "wearer's R"} of CF`;

  return { fromCenterIn, belowHpsIn, widthIn, heightIn, horizontal };
}
