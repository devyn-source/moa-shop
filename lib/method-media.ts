import type { DecorationMethod } from "./types";

// Macro detail imagery for each decoration method — the "Porsche wheel close-up"
// shown in the configurator's Decoration step. Placeholders (procedurally
// generated); swap the files in public/methods/ for real macro photography.
export const METHOD_MEDIA: Partial<Record<DecorationMethod, { image: string; note: string }>> = {
  screen_print: { image: "/methods/screen-print.jpg", note: "Crisp plastisol edges, high opacity" },
  embroidery: { image: "/methods/embroidery.jpg", note: "Dense satin stitch, dimensional" },
  patch: { image: "/methods/patch.jpg", note: "Woven patch, merrowed border" },
  puff_print: { image: "/methods/puff-print.jpg", note: "Raised foam, tactile hand-feel" },
  woven_label: { image: "/methods/woven-label.jpg", note: "Woven detail, premium finish" },
};
