// Curated screen-print spot-color palette. A LIMITED, standardized set — only
// inks MOA reliably produces — so the customer's pick is always printable and
// the factory gets an exact PMS spec (no contact-us). Hex is for on-screen
// preview only; the `code` is the production spec. Edit this list to refine.
export type PmsColor = { code: string; name: string; hex: string };

export const PMS_PALETTE: PmsColor[] = [
  // neutrals
  { code: "Black C", name: "Black", hex: "#2D2926" },
  { code: "PANTONE 425 C", name: "Charcoal", hex: "#54585A" },
  { code: "PANTONE 429 C", name: "Stone Grey", hex: "#A2AAAD" },
  { code: "PANTONE 7527 C", name: "Natural", hex: "#D6D2C4" },
  { code: "White", name: "White", hex: "#FFFFFF" },
  { code: "PANTONE 7502 C", name: "Sand", hex: "#CEB888" },
  { code: "PANTONE 4625 C", name: "Chocolate", hex: "#4F2C1D" },
  { code: "PANTONE 5753 C", name: "Olive", hex: "#5E6738" },
  // colour
  { code: "PANTONE 7522 C", name: "MOA Terracotta", hex: "#B04731" },
  { code: "PANTONE 159 C", name: "Burnt Orange", hex: "#CB6015" },
  { code: "PANTONE 7555 C", name: "Gold", hex: "#C19A2B" },
  { code: "PANTONE 186 C", name: "Red", hex: "#C8102E" },
  { code: "PANTONE 188 C", name: "Oxblood", hex: "#76232F" },
  { code: "PANTONE 357 C", name: "Forest", hex: "#215732" },
  { code: "PANTONE 533 C", name: "Navy", hex: "#1F2A44" },
  { code: "PANTONE 543 C", name: "Powder Blue", hex: "#9BCBEB" },
];

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
