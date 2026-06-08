import type { ProductCategory } from "./types";

// Completed-work showcase: real styles MOA has produced for clients, shown as
// proof of each style we make. On a PDP we filter to the viewed product's
// `category` ("this style, in the wild"); the landing shows the full grid.
// Real entries are fed in over time (photo + style); brand/logo optional.
export type CaseStudy = {
  id: string;
  category: ProductCategory; // the garment style this project was
  product: string; // the style/product name shown on the card
  line: string;
  image: string;
  logo?: string; // slug in /public/brand/clients/<logo>.png (optional)
  fit?: "cover" | "contain"; // "contain" for transparent product cutouts
};

export const CASE_STUDIES: CaseStudy[] = [
  // --- Real (cutouts from the 2026 catalog / fed in) ---
  { id: "sunday-puffer", logo: "sunday", category: "outerwear", product: "Sunday Puffer Jacket", line: "Down puffer · nylon shell, rubber appliqué", image: "/work/sunday-puffer.png", fit: "contain" },
  { id: "backbone-jacket", category: "outerwear", product: "Backbone Work Jacket", line: "Cotton canvas · corduroy collar, woven patch", image: "/work/backbone-jacket.png", fit: "contain" }, // TODO: add backbone logo
  { id: "pudgy-hoodie", logo: "pudgy-penguins", category: "hoodie", product: "Pudgy Penguins Hoodie", line: "Heavyweight fleece · screen-print graphic", image: "/work/pudgy-hoodie.png", fit: "contain" },
  { id: "bigface-tee", logo: "bigface", category: "tee", product: "Bigface Tee", line: "Heavyweight tee · screen-print graphics", image: "/work/bigface-tee.png", fit: "contain" },
  { id: "shapes-sweater", logo: "shapes", category: "knitwear", product: "Shapes Knit Sweater", line: "Cotton knit · embroidered logo", image: "/work/shapes-sweater.png", fit: "contain" },

  // --- Placeholders (to be replaced as real styles are fed in) ---
  { id: "cherry", logo: "cherry", category: "headwear", product: "Embroidered Caps", line: "Seasonal collection for the audience", image: "/work/work-6.jpg" }
];

// Examples of a given style, most-relevant first (PDP). Falls back to the full
// set when we don't have a project tagged for that style yet.
export function caseStudiesFor(category?: ProductCategory): { items: CaseStudy[]; styleSpecific: boolean } {
  if (!category) return { items: CASE_STUDIES, styleSpecific: false };
  const matches = CASE_STUDIES.filter((c) => c.category === category);
  return matches.length ? { items: matches, styleSpecific: true } : { items: CASE_STUDIES, styleSpecific: false };
}
