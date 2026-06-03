// Decoration placement bounding boxes per SKU.
//
// Coordinates are FRACTIONS of the rendered canvas (0..1). The PDP renders
// the garment on a fixed 4:5 canvas with the cutout centred, so these
// fractions are stable across viewport sizes.
//
// Resolution order on the PDP:
//   1. Custom zones authored via /studio and stored in Supabase `product_zones`.
//   2. SKU-specific defaults below (`SKU_OVERRIDES`).
//   3. Category defaults below (`CATEGORY_DEFAULTS`).
//
// To refine a SKU's zones in production, open /studio for that slug, drag the
// boxes, save — the Supabase value will then override these defaults.

import type { CatalogProduct, ProductCategory } from "./types";

export type Box = { x: number; y: number; w: number; h: number; r?: number };
export type Zone = { id: string; label: string; box: Box };
export type View = "front" | "back";
export type ProductZones = Record<View, Zone[]>;

// ---------- Calibration (per SKU, per view) ----------
// The one-time "ruler" that converts canvas fractions into real garment inches.
// Set visually in /admin/zones: drag the collar/HPS line, the center-front line,
// and a chest-width ruler whose real width (in) you type. Everything downstream
// (decoration spec sheet inch callouts) derives from this — no per-order typing.

export type ViewCalibration = {
  hpsY: number; // collar / high-point-shoulder line — fraction of canvas HEIGHT
  cfX: number; // center-front line — fraction of canvas WIDTH
  scaleAx: number; // chest-width ruler endpoint A — fraction of canvas WIDTH
  scaleBx: number; // chest-width ruler endpoint B — fraction of canvas WIDTH
  scaleY?: number; // ruler's vertical position — fraction of canvas HEIGHT (place it on the chest line, 1" below armhole). Display-only; not used in derivation.
  realInches: number; // the real garment width the A→B span represents
};
export type ProductCalibration = Partial<Record<View, ViewCalibration>>;

// The PDP canvas is 4:5 (width:height), so one unit of HEIGHT spans 1.25× the
// real distance of one unit of WIDTH. Vertical inch conversion scales by this.
export const CANVAS_H_OVER_W = 5 / 4;

export function defaultCalibration(): ViewCalibration {
  return { hpsY: 0.13, cfX: 0.5, scaleAx: 0.3, scaleBx: 0.7, scaleY: 0.5, realInches: 20 };
}

export function normaliseCalibration(raw: unknown): ProductCalibration | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const one = (v: unknown): ViewCalibration | null => {
    if (!v || typeof v !== "object") return null;
    const o = v as Record<string, unknown>;
    const num = (k: string, d: number) => (typeof o[k] === "number" && Number.isFinite(o[k]) ? (o[k] as number) : d);
    const def = defaultCalibration();
    return {
      hpsY: num("hpsY", def.hpsY),
      cfX: num("cfX", def.cfX),
      scaleAx: num("scaleAx", def.scaleAx),
      scaleBx: num("scaleBx", def.scaleBx),
      scaleY: num("scaleY", def.scaleY ?? 0.5),
      realInches: num("realInches", def.realInches),
    };
  };
  const out: ProductCalibration = {};
  const f = one(r.front);
  const b = one(r.back);
  if (f) out.front = f;
  if (b) out.back = b;
  return f || b ? out : null;
}

const quarter = (n: number) => Math.round(n * 4) / 4; // nearest 1/4" — factory-friendly

export type DerivedPlacement = {
  widthIn: number;
  heightIn: number;
  topBelowCollarIn: number;
  fromCenterIn: number;
  horizontal: string;
  hpsY: number; // passed through for drawing the collar reference on the sheet
  printBox: Box; // the TRUE printed-art box in canvas fractions (frames callouts)
};

// Derive real-inch print specs from a calibrated view + the customer's placement.
// `box` is the zone box; `art` positions/sizes the art WITHIN the box (fractions
// of the box), so the true printed extent = box scaled by the art transform.
export function derivePlacement(
  cal: ViewCalibration,
  box: Box,
  art: { ox: number; oy: number; sx: number; sy: number; r?: number },
  view: View = "front"
): DerivedPlacement {
  const span = Math.abs(cal.scaleBx - cal.scaleAx) || 0.0001;
  const inPerWFrac = cal.realInches / span;
  const inPerHFrac = inPerWFrac * CANVAS_H_OVER_W;

  const printBox: Box = {
    x: box.x + art.ox * box.w,
    y: box.y + art.oy * box.h,
    w: box.w * art.sx,
    h: box.h * art.sy,
    r: box.r,
  };

  const widthIn = quarter(printBox.w * inPerWFrac);
  const heightIn = quarter(printBox.h * inPerHFrac);
  const topBelowCollarIn = quarter(Math.max(0, (printBox.y - cal.hpsY) * inPerHFrac));
  const centerX = printBox.x + printBox.w / 2;
  const fromCenterIn = quarter((centerX - cal.cfX) * inPerWFrac);

  // Horizontal datum: CF on the front, CB on the back. Left/right is reported
  // WEARER-relative (garment convention), not viewer-relative. On a front view
  // the wearer's left is screen-right; on a back view it's screen-left.
  const datum = view === "back" ? "CB" : "CF";
  let horizontal: string;
  if (Math.abs(fromCenterIn) < 0.26) {
    horizontal = "Centered";
  } else {
    const screenRight = fromCenterIn > 0;
    const wearerLeft = view === "back" ? !screenRight : screenRight;
    const abs = Math.abs(fromCenterIn).toFixed(2).replace(/\.?0+$/, "");
    horizontal = `${abs}" ${wearerLeft ? "wearer's L" : "wearer's R"} of ${datum}`;
  }

  return { widthIn, heightIn, topBelowCollarIn, fromCenterIn, horizontal, hpsY: cal.hpsY, printBox };
}

// ---------- Garment measurements (points of measure × sizes) ----------
// Per-SKU spec-sheet data. Documents the calibration source and seeds the full
// garment tech pack (size chart / grading) later. NOT used by the decoration
// sheet yet — just captured. Filled in /admin/zones → Measure.

export type PointOfMeasure = { id: string; pom: string; values: Record<string, number | null> };
export type ProductMeasurements = { unit: "in" | "cm"; sampleSize?: string; rows: PointOfMeasure[] };

const POM_TOPS = [
  'Body Length (HPS)',
  'Chest Width (1" below armhole)',
  "Bottom Hem Width",
  "Shoulder Width",
  "Sleeve Length (from shoulder)",
  "Sleeve Opening",
  "Armhole (straight)",
  "Neck Width (seam to seam)",
  "Front Neck Drop",
];
const POM_BOTTOMS = [
  "Waist (relaxed)",
  "Waist (extended)",
  "Hip (seat)",
  "Front Rise",
  "Back Rise",
  "Inseam",
  "Outseam",
  "Thigh",
  "Knee",
  "Leg Opening",
];
const POM_HEADWEAR = ["Crown Height", "Brim Length", "Brim Width", "Circumference (relaxed)"];
const POM_BAG = ["Width", "Height", "Depth / Gusset", "Handle Length", "Handle Drop"];
const POM_ACCESSORY = ["Width", "Height"];

const POM_BY_CATEGORY: Record<ProductCategory, string[]> = {
  hoodie: [...POM_TOPS, "Pocket Width", "Pocket Height", "Hood Height", "Hood Width"],
  tee: POM_TOPS,
  knitwear: POM_TOPS,
  outerwear: [...POM_TOPS, "Placket Length"],
  bottoms: POM_BOTTOMS,
  headwear: POM_HEADWEAR,
  bag: POM_BAG,
  accessory: POM_ACCESSORY,
};

export function defaultMeasurements(category: ProductCategory, sizes: string[]): ProductMeasurements {
  const list = POM_BY_CATEGORY[category] ?? POM_TOPS;
  const cols = sizes.length ? sizes : ["OS"];
  return {
    unit: "in",
    sampleSize: cols[Math.floor(cols.length / 2)],
    rows: list.map((pom, i) => ({
      id: `pom-${i}`,
      pom,
      values: Object.fromEntries(cols.map((s) => [s, null])),
    })),
  };
}

export function normaliseMeasurements(raw: unknown): ProductMeasurements | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.rows)) return null;
  const rows: PointOfMeasure[] = [];
  for (const row of r.rows) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const pom = typeof o.pom === "string" ? o.pom : null;
    if (!pom) continue;
    const id = typeof o.id === "string" ? o.id : `pom-${rows.length}`;
    const values: Record<string, number | null> = {};
    if (o.values && typeof o.values === "object") {
      for (const [k, v] of Object.entries(o.values as Record<string, unknown>)) {
        values[k] = typeof v === "number" && Number.isFinite(v) ? v : null;
      }
    }
    rows.push({ id, pom, values });
  }
  if (!rows.length) return null;
  return {
    unit: r.unit === "cm" ? "cm" : "in",
    sampleSize: typeof r.sampleSize === "string" ? r.sampleSize : undefined,
    rows,
  };
}

// ---------- Category defaults ----------

const APPAREL_FRONT: Zone[] = [
  { id: "left-chest", label: "Left chest", box: { x: 0.55, y: 0.30, w: 0.09, h: 0.08 } },
  { id: "center-chest", label: "Center chest", box: { x: 0.455, y: 0.30, w: 0.09, h: 0.08 } },
  { id: "right-chest", label: "Right chest", box: { x: 0.36, y: 0.30, w: 0.09, h: 0.08 } },
  { id: "full-front", label: "Full front", box: { x: 0.30, y: 0.36, w: 0.40, h: 0.32 } },
  { id: "left-sleeve", label: "Left sleeve", box: { x: 0.78, y: 0.40, w: 0.06, h: 0.10 } },
  { id: "right-sleeve", label: "Right sleeve", box: { x: 0.16, y: 0.40, w: 0.06, h: 0.10 } }
];

const APPAREL_BACK: Zone[] = [
  { id: "yoke", label: "Upper back (yoke)", box: { x: 0.40, y: 0.22, w: 0.20, h: 0.08 } },
  { id: "center-back", label: "Center back", box: { x: 0.30, y: 0.30, w: 0.40, h: 0.34 } },
  { id: "lower-back", label: "Lower back", box: { x: 0.40, y: 0.64, w: 0.20, h: 0.08 } },
  { id: "left-sleeve-back", label: "Left sleeve (back)", box: { x: 0.78, y: 0.40, w: 0.06, h: 0.10 } },
  { id: "right-sleeve-back", label: "Right sleeve (back)", box: { x: 0.16, y: 0.40, w: 0.06, h: 0.10 } }
];

const BOTTOMS_FRONT: Zone[] = [
  { id: "hip-left", label: "Left hip", box: { x: 0.60, y: 0.18, w: 0.10, h: 0.06 } },
  { id: "hip-right", label: "Right hip", box: { x: 0.30, y: 0.18, w: 0.10, h: 0.06 } },
  { id: "thigh-left", label: "Left thigh", box: { x: 0.56, y: 0.34, w: 0.14, h: 0.18 } },
  { id: "thigh-right", label: "Right thigh", box: { x: 0.30, y: 0.34, w: 0.14, h: 0.18 } }
];

const BOTTOMS_BACK: Zone[] = [
  { id: "back-pocket", label: "Back patch pocket", box: { x: 0.55, y: 0.22, w: 0.14, h: 0.10 } },
  { id: "left-leg-back", label: "Left leg (back)", box: { x: 0.56, y: 0.40, w: 0.14, h: 0.18 } },
  { id: "right-leg-back", label: "Right leg (back)", box: { x: 0.30, y: 0.40, w: 0.14, h: 0.18 } }
];

const HEADWEAR_FRONT: Zone[] = [
  { id: "front-panel", label: "Front panel", box: { x: 0.34, y: 0.30, w: 0.32, h: 0.20 } },
  { id: "front-panel-left", label: "Front panel · left side", box: { x: 0.22, y: 0.34, w: 0.14, h: 0.14 } },
  { id: "front-panel-right", label: "Front panel · right side", box: { x: 0.64, y: 0.34, w: 0.14, h: 0.14 } }
];

const HEADWEAR_BACK: Zone[] = [
  { id: "back-panel", label: "Back panel", box: { x: 0.34, y: 0.34, w: 0.32, h: 0.18 } }
];

const BAG_FRONT: Zone[] = [
  { id: "panel-upper", label: "Upper panel", box: { x: 0.30, y: 0.30, w: 0.40, h: 0.10 } },
  { id: "panel-center", label: "Panel · center", box: { x: 0.30, y: 0.40, w: 0.40, h: 0.24 } },
  { id: "panel-lower", label: "Lower panel", box: { x: 0.30, y: 0.64, w: 0.40, h: 0.10 } }
];

const BAG_BACK: Zone[] = [
  { id: "panel-center-back", label: "Panel · center (back)", box: { x: 0.30, y: 0.40, w: 0.40, h: 0.24 } }
];

const ACCESSORY_FRONT: Zone[] = [
  { id: "panel-center", label: "Panel · center", box: { x: 0.30, y: 0.40, w: 0.40, h: 0.24 } }
];

const ACCESSORY_BACK: Zone[] = [
  { id: "panel-center-back", label: "Panel · center (back)", box: { x: 0.30, y: 0.40, w: 0.40, h: 0.24 } }
];

const CATEGORY_DEFAULTS: Record<ProductCategory, ProductZones> = {
  hoodie: { front: APPAREL_FRONT, back: APPAREL_BACK },
  tee: { front: APPAREL_FRONT, back: APPAREL_BACK },
  knitwear: { front: APPAREL_FRONT, back: APPAREL_BACK },
  outerwear: { front: APPAREL_FRONT, back: APPAREL_BACK },
  bottoms: { front: BOTTOMS_FRONT, back: BOTTOMS_BACK },
  headwear: { front: HEADWEAR_FRONT, back: HEADWEAR_BACK },
  bag: { front: BAG_FRONT, back: BAG_BACK },
  accessory: { front: ACCESSORY_FRONT, back: ACCESSORY_BACK }
};

// ---------- SKU-specific overrides ----------
// Lean — only encode where the SKU's geometry meaningfully diverges from its
// category. Everything else inherits the category default and can be refined
// later via /studio.

const SKU_OVERRIDES: Record<string, Partial<ProductZones>> = {
  // Trucker — foam front panel is bigger than a structured cap's, no back
  // authoring (the trucker SKU is front-only).
  "trucker-hat": {
    front: [
      { id: "foam-front", label: "Foam front panel", box: { x: 0.30, y: 0.28, w: 0.40, h: 0.22 } },
      { id: "left-mesh", label: "Left mesh side", box: { x: 0.16, y: 0.32, w: 0.12, h: 0.16 } },
      { id: "right-mesh", label: "Right mesh side", box: { x: 0.72, y: 0.32, w: 0.12, h: 0.16 } }
    ]
  },

  // Beanie — single cuff face, no rear graphic.
  "rib-knit-beanie": {
    front: [
      { id: "cuff", label: "Cuff face", box: { x: 0.32, y: 0.46, w: 0.36, h: 0.10 } },
      { id: "crown", label: "Crown panel", box: { x: 0.34, y: 0.30, w: 0.32, h: 0.14 } }
    ]
  },

  // Five panel — a different crown geometry from a six-panel dad hat.
  "five-panel": {
    front: [
      { id: "front-panel", label: "Front panel", box: { x: 0.34, y: 0.28, w: 0.32, h: 0.22 } },
      { id: "left-panel", label: "Left side panel", box: { x: 0.20, y: 0.32, w: 0.14, h: 0.16 } },
      { id: "right-panel", label: "Right side panel", box: { x: 0.66, y: 0.32, w: 0.14, h: 0.16 } }
    ]
  },

  // Standard tote — single big rectangular print zone is the norm.
  "standard-tote": {
    front: [
      { id: "panel-center", label: "Panel · center", box: { x: 0.30, y: 0.40, w: 0.40, h: 0.28 } },
      { id: "panel-upper", label: "Panel · upper", box: { x: 0.32, y: 0.30, w: 0.36, h: 0.10 } },
      { id: "panel-lower", label: "Panel · lower", box: { x: 0.32, y: 0.66, w: 0.36, h: 0.10 } }
    ]
  },

  // Outerwear with a centered zipper — left/right chest move slightly off
  // centre so artwork doesn't sit ON the zipper.
  "work-jacket": {
    front: [
      { id: "left-chest", label: "Left chest", box: { x: 0.56, y: 0.30, w: 0.10, h: 0.08 } },
      { id: "right-chest", label: "Right chest", box: { x: 0.34, y: 0.30, w: 0.10, h: 0.08 } },
      { id: "left-sleeve", label: "Left sleeve", box: { x: 0.80, y: 0.42, w: 0.06, h: 0.10 } },
      { id: "right-sleeve", label: "Right sleeve", box: { x: 0.14, y: 0.42, w: 0.06, h: 0.10 } }
    ]
  },

  "down-puffer": {
    front: [
      { id: "left-chest", label: "Left chest", box: { x: 0.56, y: 0.32, w: 0.10, h: 0.08 } },
      { id: "right-chest", label: "Right chest", box: { x: 0.34, y: 0.32, w: 0.10, h: 0.08 } },
      { id: "left-sleeve", label: "Left sleeve", box: { x: 0.80, y: 0.42, w: 0.06, h: 0.10 } },
      { id: "right-sleeve", label: "Right sleeve", box: { x: 0.14, y: 0.42, w: 0.06, h: 0.10 } }
    ]
  }
};

// ---------- Placement certainty gating ----------
// A placement is only offered when we can spec it to ~95% — i.e. its reference
// frame is supported AND the SKU is calibrated for that view. Front/back body
// (HPS + CF/CB datum) are supported today; sleeves/hats/bottoms/bags need their
// own reference frames (planned) and stay hidden until built.

export type ZoneFamily = "front-body" | "back-body" | "sleeve" | "hat" | "bottom" | "bag";

export function zoneFamily(zoneId: string, view: View, category: ProductCategory): ZoneFamily {
  if (category === "headwear") return "hat";
  if (category === "bag" || category === "accessory") return "bag";
  if (category === "bottoms") return "bottom";
  if (zoneId.toLowerCase().includes("sleeve")) return "sleeve"; // apparel sleeves
  return view === "back" ? "back-body" : "front-body";
}

const SUPPORTED_FAMILIES: ZoneFamily[] = ["front-body", "back-body"];

export function isZoneSpecable(
  zoneId: string,
  view: View,
  category: ProductCategory,
  calibration: ProductCalibration | null
): boolean {
  if (!SUPPORTED_FAMILIES.includes(zoneFamily(zoneId, view, category))) return false;
  return Boolean(calibration && calibration[view]);
}

// ---------- Resolution ----------

export function getDefaultZones(product: Pick<CatalogProduct, "category" | "slug">): ProductZones {
  const cat = CATEGORY_DEFAULTS[product.category];
  const ov = SKU_OVERRIDES[product.slug] ?? {};
  return {
    front: ov.front ?? cat.front,
    back: ov.back ?? cat.back
  };
}

// Accepts either a `{x, y, w, h}` fraction payload or the Studio's
// `{x0, x1, y0, y1}` percentage payload, and normalises to ProductZones.
export function normaliseZonesPayload(raw: unknown): ProductZones | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const norm = (arr: unknown): Zone[] | null => {
    if (!Array.isArray(arr)) return null;
    const out: Zone[] = [];
    for (const z of arr) {
      if (!z || typeof z !== "object") continue;
      const o = z as Record<string, unknown>;
      const id = typeof o.id === "string" ? o.id : null;
      const label = typeof o.label === "string" ? o.label : id;
      const b = o.box as Record<string, unknown> | undefined;
      if (!id || !label || !b) continue;
      const r = typeof b.r === "number" ? b.r : typeof b.rot === "number" ? b.rot : undefined;
      if (typeof b.x === "number" && typeof b.y === "number" && typeof b.w === "number" && typeof b.h === "number") {
        out.push({ id, label, box: { x: b.x, y: b.y, w: b.w, h: b.h, r } });
      } else if (typeof b.x0 === "number" && typeof b.x1 === "number" && typeof b.y0 === "number" && typeof b.y1 === "number") {
        out.push({
          id,
          label,
          box: {
            x: b.x0 / 100,
            y: b.y0 / 100,
            w: (b.x1 - b.x0) / 100,
            h: (b.y1 - b.y0) / 100,
            r
          }
        });
      }
    }
    return out.length ? out : null;
  };
  const front = norm(r.front);
  const back = norm(r.back);
  if (!front && !back) return null;
  return { front: front ?? [], back: back ?? [] };
}
