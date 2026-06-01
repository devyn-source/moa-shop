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
