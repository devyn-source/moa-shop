// Garment Passport (Layer 1) — the per-SKU garment spec, authored once per SKU and
// composed with the per-order decoration sheet (Layer 2) into the vendor tech pack.
// Size chart is ingested verbatim from the real factory grading (product_zones.
// measurements) where we have it (_assumed:false); BOM/construction/labels are
// category-standard drafts flagged `_assumed:true` for the human review gate.
//
// Seeded file-based (mirrors the file-based product catalog). The mutable review
// store (Supabase catalog_product_specs — migration is in supabase/migrations/) +
// the /admin "Generate spec draft" flow are the next layer.
import generated from "./garment-specs.generated.json";

export type BomRow = {
  component: string;
  spec: string;
  composition: string;
  weightGsm: number | null;
  color: string;
  pantoneTcx: string;
  supplier: string;
  _assumed: boolean;
};

export type SizeChartPom = {
  code: string;
  name: string;
  tolerance: number; // ± inches
  bySize: Record<string, number>;
  _assumed: boolean;
};

export type ConstructionRow = {
  area: string;
  detail: string;
  stitch: string;
  spi: number | null;
  seamClass: string;
  _assumed: boolean;
};

export type LabelsPackaging = {
  mainLabel: string;
  careLabel: string;
  sizeLabel: string;
  hangTag: string;
  fold: string;
  polybag: string;
  _assumed: boolean;
};

export type GarmentPassport = {
  styleNumber: string;
  styleName: string;
  category: string;
  bom: BomRow[];
  sizeChart: { baseSize: string; poms: SizeChartPom[] };
  construction: ConstructionRow[];
  labelsPackaging: LabelsPackaging;
  flatsNeeded: string[];
  openQuestions: string[];
  // provenance
  _generatedAt?: string;
  _status?: "draft" | "reviewed" | "approved";
};

const SPECS = generated as Record<string, GarmentPassport>;

export function getProductSpec(slug: string): GarmentPassport | null {
  return SPECS[slug] ?? null;
}

export function allProductSpecs(): GarmentPassport[] {
  return Object.values(SPECS);
}

// How many fields a human still needs to verify (the _assumed flags + open questions).
export function reviewBurden(p: GarmentPassport): { assumed: number; questions: number } {
  const assumed =
    p.bom.filter((r) => r._assumed).length +
    p.sizeChart.poms.filter((r) => r._assumed).length +
    p.construction.filter((r) => r._assumed).length +
    (p.labelsPackaging._assumed ? 1 : 0);
  return { assumed, questions: p.openQuestions.length };
}

// "Set in stone" — a passport may only go to a vendor when EVERY field is a real,
// confirmed value: nothing assumed, no open questions, and explicitly approved.
// The vendor tech pack must never be generated for an unlocked passport.
export function isPassportLocked(p: GarmentPassport): boolean {
  const { assumed, questions } = reviewBurden(p);
  return assumed === 0 && questions === 0 && p._status === "approved";
}
