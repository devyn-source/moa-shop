import type { DecorationMethod } from "./types";

// Macro detail imagery for each decoration method — the "Porsche wheel close-up"
// shown in the configurator's Decoration step. Real MOA logo renders (terracotta
// on black) per method: flat screen print, satin-stitch embroidery, raised rubber.
export const METHOD_MEDIA: Partial<Record<DecorationMethod, { image: string; note: string }>> = {
  screen_print: { image: "/methods/screen-print.webp", note: "Crisp plastisol edges, high opacity" },
  embroidery: { image: "/methods/embroidery.webp", note: "Dense satin stitch, dimensional" },
  rubber_applique: { image: "/methods/rubber-applique.webp", note: "Raised rubber badge, soft tactile finish" },
};
