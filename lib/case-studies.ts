// Completed-work showcase rendered below the PDP. Brand + product + one line.
// PLACEHOLDER copy + procedurally-generated photos (public/work/*.jpg) — replace
// the lines with real project details and swap in real photography.
export type CaseStudy = {
  id: string;
  brand: string;
  logo: string; // slug in /public/brand/clients/<logo>.png
  product: string;
  line: string;
  image: string;
};

export const CASE_STUDIES: CaseStudy[] = [
  { id: "groq", brand: "Groq", logo: "groq", product: "Heavyweight Hoodies", line: "Launch-day kit for the team and partners", image: "/work/work-1.jpg" },
  { id: "canva", brand: "Canva", logo: "canva", product: "New-Hire Kits", line: "Onboarding boxes shipped worldwide", image: "/work/work-2.jpg" },
  { id: "bigface", brand: "Bigface", logo: "bigface", product: "Cut-&-Sew Capsule", line: "Limited drop for the community", image: "/work/work-3.jpg" },
  { id: "goldenvoice", brand: "Goldenvoice", logo: "goldenvoice", product: "Event Crew Merch", line: "Festival staff and artist gifting", image: "/work/work-4.jpg" },
  { id: "twojeys", brand: "Two Jeys", logo: "twojeys", product: "Retail Merch Capsule", line: "In-store exclusive run", image: "/work/work-5.jpg" },
  { id: "cherry", brand: "Cherry", logo: "cherry", product: "Brand Merch", line: "Seasonal collection for the audience", image: "/work/work-6.jpg" },
];
