import type { DecorationMethod } from "./types";

// Macro detail imagery for each decoration method — the "Porsche wheel close-up"
// shown in the configurator's Decoration step. Placeholders (procedurally
// generated); swap the files in public/methods/ for real macro photography.
export const METHOD_MEDIA: Partial<Record<DecorationMethod, { image: string; note: string }>> = {
  screen_print: { image: "/methods/screen-print.jpg", note: "Crisp plastisol edges, high opacity" },
  embroidery: { image: "/methods/embroidery.jpg", note: "Dense satin stitch, dimensional" },
  rubber_applique: { image: "/methods/rubber-applique.jpg", note: "Raised rubber badge, soft tactile finish" },
};
