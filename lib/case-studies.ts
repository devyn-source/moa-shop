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
  // --- Real (from the 2026 catalog) ---
  { id: "sunday-puffer", logo: "sunday", category: "outerwear", product: "Sunday Puffer Jacket", line: "Down puffer · nylon shell, rubber appliqué", image: "/work/sunday-puffer.png", fit: "contain" },

  // --- Placeholders (to be replaced as real styles are fed in) ---
  { id: "groq", logo: "groq", category: "hoodie", product: "Heavyweight Hoodies", line: "500-piece launch run for the team and partners", image: "/work/work-1.jpg" },
  { id: "goldenvoice", logo: "goldenvoice", category: "hoodie", product: "Event Crew Hoodies", line: "Festival staff and artist gifting", image: "/work/work-4.jpg" },
  { id: "canva", logo: "canva", category: "tee", product: "Heavyweight Tees", line: "Onboarding kits shipped worldwide", image: "/work/work-2.jpg" },
  { id: "twojeys", logo: "twojeys", category: "knitwear", product: "Knit Sweaters", line: "In-store retail capsule", image: "/work/work-5.jpg" },
  { id: "cherry", logo: "cherry", category: "headwear", product: "Embroidered Caps", line: "Seasonal collection for the audience", image: "/work/work-6.jpg" }
];

// Examples of a given style, most-relevant first (PDP). Falls back to the full
// set when we don't have a project tagged for that style yet.
export function caseStudiesFor(category?: ProductCategory): { items: CaseStudy[]; styleSpecific: boolean } {
  if (!category) return { items: CASE_STUDIES, styleSpecific: false };
  const matches = CASE_STUDIES.filter((c) => c.category === category);
  return matches.length ? { items: matches, styleSpecific: true } : { items: CASE_STUDIES, styleSpecific: false };
}
