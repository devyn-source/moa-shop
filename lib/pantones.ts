// Curated screen-print spot-color palette. A LIMITED, standardized set — only
// inks MOA reliably produces — so the customer's pick is always printable and
// the factory gets an exact PMS spec (no contact-us). Hex is for on-screen
// preview only; the `code` is the production spec. Edit this list to refine.
export type PmsColor = { code: string; name: string; hex: string };

export const PMS_PALETTE: PmsColor[] = [
  { code: "Black C", name: "Black", hex: "#1A1A1A" },
  { code: "White", name: "White", hex: "#FFFFFF" },
  { code: "PANTONE 7522 C", name: "MOA Terracotta", hex: "#B04731" },
  { code: "PANTONE 533 C", name: "Navy", hex: "#1F2B42" },
  { code: "PANTONE 186 C", name: "Red", hex: "#C8102E" },
  { code: "PANTONE 286 C", name: "Royal Blue", hex: "#0033A0" },
  { code: "PANTONE 357 C", name: "Forest Green", hex: "#215732" },
  { code: "PANTONE 7555 C", name: "Athletic Gold", hex: "#C19A2B" },
  { code: "PANTONE 188 C", name: "Maroon", hex: "#76232F" },
  { code: "PANTONE 425 C", name: "Charcoal", hex: "#54585A" },
  { code: "PANTONE 7527 C", name: "Natural", hex: "#D6D2C4" },
  { code: "PANTONE 165 C", name: "Orange", hex: "#FF6720" },
  { code: "PANTONE 2685 C", name: "Purple", hex: "#56068C" },
  { code: "PANTONE 211 C", name: "Pink", hex: "#F57EB6" },
  { code: "PANTONE 429 C", name: "Light Grey", hex: "#A2AAAD" },
  { code: "PANTONE 348 C", name: "Kelly Green", hex: "#00843D" },
];

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
