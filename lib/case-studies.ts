import type { ProductCategory } from "./types";

// Completed-work showcase. On a PDP we filter to the viewed product's `category`
// ("this style, produced for…") — the highest-converting, most relevant proof.
// The landing shows the full diverse grid. PLACEHOLDER copy + procedurally
// generated photos (public/work/*.jpg) — replace with real project details +
// photography (and tag each with the right `category`).
export type CaseStudy = {
  id: string;
  brand: string;
  logo: string; // slug in /public/brand/clients/<logo>.png
  category: ProductCategory; // the garment style this project was
  product: string;
  line: string;
  image: string;
};

export const CASE_STUDIES: CaseStudy[] = [
  { id: "groq", brand: "Groq", logo: "groq", category: "hoodie", product: "Heavyweight Hoodies", line: "500-piece launch run for the team and partners", image: "/work/work-1.jpg" },
  { id: "goldenvoice", brand: "Goldenvoice", logo: "goldenvoice", category: "hoodie", product: "Event Crew Hoodies", line: "Festival staff and artist gifting", image: "/work/work-4.jpg" },
  { id: "canva", brand: "Canva", logo: "canva", category: "tee", product: "Heavyweight Tees", line: "Onboarding kits shipped worldwide", image: "/work/work-2.jpg" },
  { id: "bigface", brand: "Bigface", logo: "bigface", category: "outerwear", product: "Puffer Jackets", line: "Limited drop for the community", image: "/work/work-3.jpg" },
  { id: "twojeys", brand: "Two Jeys", logo: "twojeys", category: "knitwear", product: "Knit Sweaters", line: "In-store retail capsule", image: "/work/work-5.jpg" },
  { id: "cherry", brand: "Cherry", logo: "cherry", category: "headwear", product: "Embroidered Caps", line: "Seasonal collection for the audience", image: "/work/work-6.jpg" }
];

// Examples of a given style, most-relevant first (PDP). Falls back to the full
// set when we don't have a project tagged for that style yet.
export function caseStudiesFor(category?: ProductCategory): { items: CaseStudy[]; styleSpecific: boolean } {
  if (!category) return { items: CASE_STUDIES, styleSpecific: false };
  const matches = CASE_STUDIES.filter((c) => c.category === category);
  return matches.length ? { items: matches, styleSpecific: true } : { items: CASE_STUDIES, styleSpecific: false };
}
