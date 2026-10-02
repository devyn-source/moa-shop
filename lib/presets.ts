// MOA standard placements, in real inches. A preset puts the artwork exactly where
// the factory would: `widthIn` wide, its top edge `belowHpsIn` below the high point
// shoulder, its centre `fromCfIn` from centre front/back (positive = wearer's left).
// The 3D Studio converts these into the on-garment position through the SKU's 3D
// calibration, so the preview, the inches readout and the decoration sheet agree.
// Styles without a 3D calibration (caps, beanies, totes) use the zone only.
import type { ProductCategory } from "./types";

export type PlacementPreset = {
  id: string;
  label: string;
  view: "front" | "back";
  zoneId: string; // the print area this preset lives in (matches product_zones ids)
  widthIn: number;
  belowHpsIn: number;
  fromCfIn: number;
};

const TOP: PlacementPreset[] = [
  { id: "left-chest", label: "Left chest", view: "front", zoneId: "left-chest", widthIn: 3.5, belowHpsIn: 7, fromCfIn: 4 },
  { id: "center-chest", label: "Centre chest", view: "front", zoneId: "center-chest", widthIn: 10, belowHpsIn: 7.5, fromCfIn: 0 },
  { id: "full-front", label: "Full front", view: "front", zoneId: "full-front", widthIn: 12, belowHpsIn: 7.5, fromCfIn: 0 },
  { id: "nape", label: "Back neck", view: "back", zoneId: "yoke", widthIn: 3, belowHpsIn: 3.75, fromCfIn: 0 }, // starts below the back neck seam and rib
  { id: "full-back", label: "Full back", view: "back", zoneId: "center-back", widthIn: 12, belowHpsIn: 4, fromCfIn: 0 },
];

const HOODIE: PlacementPreset[] = [
  { id: "left-chest", label: "Left chest", view: "front", zoneId: "left-chest", widthIn: 3.5, belowHpsIn: 8.5, fromCfIn: 4 },
  { id: "center-chest", label: "Centre chest", view: "front", zoneId: "center-chest", widthIn: 10, belowHpsIn: 9, fromCfIn: 0 },
  { id: "upper-back", label: "Upper back", view: "back", zoneId: "upper-back", widthIn: 10, belowHpsIn: 6, fromCfIn: 0 },
  { id: "full-back", label: "Full back", view: "back", zoneId: "center-back", widthIn: 12, belowHpsIn: 8, fromCfIn: 0 },
];

const JACKET: PlacementPreset[] = [
  { id: "left-chest", label: "Left chest", view: "front", zoneId: "left-chest", widthIn: 3.5, belowHpsIn: 8, fromCfIn: 4.5 },
  { id: "yoke", label: "Upper back", view: "back", zoneId: "yoke", widthIn: 10, belowHpsIn: 5, fromCfIn: 0 },
  { id: "full-back", label: "Full back", view: "back", zoneId: "center-back", widthIn: 11, belowHpsIn: 7, fromCfIn: 0 },
];

// Track jacket: centre-front zip, so chest prints sit off the zip; stand collar above HPS.
const TRACK: PlacementPreset[] = [
  { id: "left-chest", label: "Left chest", view: "front", zoneId: "left-chest", widthIn: 3.5, belowHpsIn: 7.5, fromCfIn: 4.5 },
  { id: "upper-back", label: "Upper back", view: "back", zoneId: "upper-back", widthIn: 10, belowHpsIn: 5, fromCfIn: 0 },
  { id: "full-back", label: "Full back", view: "back", zoneId: "center-back", widthIn: 11, belowHpsIn: 6, fromCfIn: 0 },
];

// Accessories: "HPS" is the top of the item (crown, top of the beanie, top of the bag body).
const CAP: PlacementPreset[] = [
  { id: "front-centre", label: "Front centre", view: "front", zoneId: "front-panel", widthIn: 3.5, belowHpsIn: 1.75, fromCfIn: 0 },
  { id: "front-small", label: "Front, small", view: "front", zoneId: "front-panel", widthIn: 2.25, belowHpsIn: 2.0, fromCfIn: 0 },
];
const BEANIE: PlacementPreset[] = [
  { id: "cuff", label: "Cuff", view: "front", zoneId: "cuff", widthIn: 2.5, belowHpsIn: 6.75, fromCfIn: 0 },
];
const TOTE: PlacementPreset[] = [
  { id: "front-centre", label: "Front centre", view: "front", zoneId: "panel-lower", widthIn: 10, belowHpsIn: 3, fromCfIn: 0 },
  { id: "back-centre", label: "Back centre", view: "back", zoneId: "panel-center-back", widthIn: 10, belowHpsIn: 3, fromCfIn: 0 },
];

const BY_SLUG: Record<string, PlacementPreset[]> = {
  "dad-hat": CAP,
  "rib-knit-beanie": BEANIE,
  "standard-tote": TOTE,
  "heavyweight-tee": TOP,
  "vintage-cut-tee": TOP,
  "heavyweight-hoodie": HOODIE,
  "work-jacket": JACKET,
  "track-jacket": TRACK,
};

export function presetsFor(slug: string, category: ProductCategory): PlacementPreset[] {
  return BY_SLUG[slug] ?? (category === "tee" ? TOP : category === "hoodie" ? HOODIE : []);
}

// Plain-words spec line, e.g. "3.5 in wide, 7 in below HPS, 4 in wearer's left of CF".
export function presetSpec(p: Pick<PlacementPreset, "widthIn" | "belowHpsIn" | "fromCfIn" | "view">): string {
  const datum = p.view === "back" ? "CB" : "CF";
  const side = Math.abs(p.fromCfIn) < 0.26 ? `centred on ${datum}` : `${Math.abs(p.fromCfIn)} in wearer's ${p.fromCfIn > 0 ? "left" : "right"} of ${datum}`;
  return `${p.widthIn} in wide, ${p.belowHpsIn} in below HPS, ${side}`;
}
