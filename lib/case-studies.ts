import type { ProductCategory } from "./types";

// Completed-work showcase: real styles MOA has produced for clients, shown as
// proof. On a PDP we filter to the EXACT product (by slug) — "this style, in the
// wild" — so e.g. the work-jacket PDP shows only the work jacket, not every
// outerwear piece. The landing shows the full diverse grid.
export type CaseStudy = {
  id: string;
  category: ProductCategory; // descriptive
  slugs: string[]; // storefront product slug(s) this project represents (drives PDP match)
  product: string;
  line: string;
  image: string;
  logo?: string; // slug in /public/brand/clients/<logo>.png (optional)
  fit?: "cover" | "contain"; // "contain" for transparent product cutouts
};

export const CASE_STUDIES: CaseStudy[] = [
  { id: "sunday-puffer", logo: "sunday", category: "outerwear", slugs: ["down-puffer"], product: "Sunday Puffer Jacket", line: "Down puffer · nylon shell, rubber appliqué", image: "/work/sunday-puffer.png", fit: "contain" },
  { id: "backbone-jacket", logo: "backbone", category: "outerwear", slugs: ["work-jacket"], product: "Backbone Work Jacket", line: "Cotton canvas · corduroy collar, woven patch", image: "/work/backbone-jacket.png", fit: "contain" },
  { id: "pudgy-hoodie", logo: "pudgy-penguins", category: "hoodie", slugs: ["heavyweight-hoodie"], product: "Pudgy Penguins Hoodie", line: "Heavyweight fleece · screen-print graphic", image: "/work/pudgy-hoodie.png", fit: "contain" },
  { id: "bigface-tee", logo: "bigface", category: "tee", slugs: ["heavyweight-tee"], product: "Bigface Tee", line: "Heavyweight tee · screen-print graphics", image: "/work/bigface-tee.png", fit: "contain" },
  { id: "shapes-sweater", logo: "shapes", category: "knitwear", slugs: ["knit-sweater"], product: "Shapes Knit Sweater", line: "Cotton knit · embroidered logo", image: "/work/shapes-sweater.png", fit: "contain" },
  { id: "bloody-sunday-cap", logo: "sunday", category: "headwear", slugs: ["five-panel", "dad-hat"], product: "Bloody Sunday Cap", line: "Cotton twill · tonal embossed logo", image: "/work/bloody-sunday-cap.png", fit: "contain" }
];

// PDP: exact product match by slug ("this style, in the wild"). Falls back to the
// full set only when the product has no dedicated project yet.
export function caseStudiesFor(slug?: string): { items: CaseStudy[]; styleSpecific: boolean } {
  if (!slug) return { items: CASE_STUDIES, styleSpecific: false }; // landing = full grid
  // PDP: show ONLY this product's case study. If we don't have one for this
  // product yet, show nothing — never fall back to unrelated styles.
  const matches = CASE_STUDIES.filter((c) => c.slugs.includes(slug));
  return { items: matches, styleSpecific: matches.length > 0 };
}
