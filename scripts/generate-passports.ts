// Generate Garment Passports (Layer 1) for SKUs that have real factory measurements.
// Size chart = ingested VERBATIM from product_zones.measurements (_assumed:false).
// BOM / construction / labels = category-standard drafts (_assumed:true) for the
// human review gate. Writes lib/garment-specs.generated.json (committed seed).
//
// Run: set -a; source .env.local; set +a; npx tsx scripts/generate-passports.ts
import fs from "fs";
import path from "path";
import { getProducts, getProductMeasurements } from "../lib/store";
import type { BomRow, ConstructionRow, GarmentPassport, LabelsPackaging, SizeChartPom } from "../lib/garment-spec";

type Cls = "tee" | "fleece-top" | "knit" | "nylon-jacket" | "canvas-jacket" | "down-jacket" | "fleece-bottom";
const CLASS_OF: Record<string, Cls> = {
  "heavyweight-tee": "tee",
  "heavyweight-hoodie": "fleece-top",
  "knit-sweater": "knit",
  "nylon-chore-jacket": "nylon-jacket",
  "track-jacket": "nylon-jacket",
  "work-jacket": "canvas-jacket",
  "wide-leg-sweatpant": "fleece-bottom",
  "down-puffer": "down-jacket",
};

function parseFabric(fabric?: string): { gsm: number | null; composition: string } {
  if (!fabric) return { gsm: null, composition: "" };
  const g = fabric.match(/(\d{2,4})\s*gsm/i);
  return { gsm: g ? Number(g[1]) : null, composition: fabric.replace(/\d{2,4}\s*gsm/i, "").replace(/^[·,\-\s]+/, "").trim() };
}
function tolFor(pom: string): number {
  return /(length|sleeve|chest|width|waist|hip|bottom|opening|thigh|inseam|outseam|sweep)/i.test(pom) ? 0.5 : 0.25;
}
const code = (i: number) => String.fromCharCode(65 + i); // A, B, C…

const A = true; // _assumed
const bom = (component: string, spec: string, composition = "", weightGsm: number | null = null, supplier = "Confirm w/ factory"): BomRow =>
  ({ component, spec, composition, weightGsm, color: "", pantoneTcx: "", supplier, _assumed: A });
const con = (area: string, detail: string, stitch: string, spi: number | null, seamClass: string): ConstructionRow =>
  ({ area, detail, stitch, spi, seamClass, _assumed: A });

const LABELS_SEWN: LabelsPackaging = {
  mainLabel: "Woven damask main label, sewn at center-back neck (or per-order custom neck label)",
  careLabel: "Printed satin care label, sewn into left side seam — fiber content + care symbols + RN",
  sizeLabel: "Woven size tab, center-back neck below main label",
  hangTag: "MOA hangtag, looped at neck (per order)",
  fold: "Standard flat fold",
  polybag: "Individual recyclable polybag with suffocation warning",
  _assumed: A,
};

// component BOM + construction + open questions per garment class
function build(cls: Cls, fab: { gsm: number | null; composition: string }, variant: { colorLabel?: string; colorTcx?: string } | undefined) {
  const shell = (spec: string): BomRow => ({ component: "Shell fabric", spec, composition: fab.composition, weightGsm: fab.gsm, color: variant?.colorLabel ?? "", pantoneTcx: variant?.colorTcx ?? "", supplier: "Confirm w/ factory", _assumed: A });
  const thread = bom("Thread", "Spun polyester, Tkt 120 (seams) / Tkt 80 (topstitch)", "100% polyester");
  const baseQ = ["Confirm shell mill + exact weight/yield", "Confirm thread brand + ticket", "Supply + approve technical flats (front/back)"];

  switch (cls) {
    case "tee":
      return {
        bom: [shell(`${fab.gsm ?? "?"}gsm single jersey, ${fab.composition}`), bom("Neck rib", "1×1 rib, self or matching", fab.composition), bom("Neck tape", '3/8" twill tape, back-neck'), thread],
        construction: [
          con("Sleeves", "Set-in", "Overlock 504", 12, "EFc"),
          con("Bottom + sleeve hem", '1" turn, double-needle coverstitch', "Coverstitch 406", 12, "EFb"),
          con("Collar", '3/4" rib, single-needle set + back-neck tape', "Lockstitch 301", 12, "LSa"),
          con("Side seams", "Side-seamed", "Overlock 504", 12, "SSa"),
        ],
        flatsNeeded: ["front", "back"],
        openQuestions: baseQ,
      };
    case "fleece-top":
      return {
        bom: [shell(`${fab.gsm ?? "?"}gsm brushed-back fleece, ${fab.composition}`), bom("Rib", "2×2 rib, cuffs + hem", fab.composition), bom("Drawcord", "Round/flat cord + tipped eyelets", "100% cotton/poly"), bom("Eyelets", "Metal, matte, 2× at hood", "Metal"), thread],
        construction: [
          con("Sleeves", "Set-in", "Overlock 504 + coverstitch", 12, "EFc"),
          con("Hood", "2- or 3-panel, topstitched, drawcord through eyelets", "Lockstitch 301", 10, "LSc"),
          con("Pocket", "Kangaroo pouch, bartacked openings", "Lockstitch + bartack", 10, "LSa"),
          con("Cuffs + hem", "2×2 rib set", "Overlock + coverstitch", 12, "EFb"),
        ],
        flatsNeeded: ["front", "back", "hood detail"],
        openQuestions: [...baseQ, "Confirm drawcord + eyelet finish/supplier", "Lined vs unlined hood?"],
      };
    case "knit":
      return {
        bom: [shell(`${fab.gsm ? fab.gsm + "gsm " : ""}knit, ${fab.composition}`), bom("Rib trims", "2×1 rib — collar, cuffs, hem", fab.composition), thread],
        construction: [
          con("Gauge", "12gg (confirm)", "Flat-knit", null, "—"),
          con("Seams", "Linked or overlocked", "Linking / Overlock 504", null, "SSa"),
          con("Collar", "Crew, 2×1 rib, set + linked", "Linking", null, "—"),
          con("Sleeves", "Set-in or fully-fashioned", "Linking", null, "EFc"),
        ],
        flatsNeeded: ["front", "back"],
        openQuestions: [...baseQ, "CONFIRM knit gauge (gg) + yarn count — not derivable from a photo", "Fully-fashioned vs cut-and-sew?"],
      };
    case "nylon-jacket":
      return {
        bom: [shell(`Nylon shell, ${fab.composition}`), bom("Lining", "Taffeta or mesh", "Nylon/poly"), bom("Closure", "CF zipper or snaps", "Metal/poly"), bom("Hem", "Elastic or drawcord", ""), thread],
        construction: [
          con("Seams", "Bagged-out / serged", "Overlock 504 + topstitch", 10, "SSa"),
          con("Closure", "CF zipper set with topstitch (or snap placket)", "Lockstitch 301", 10, "LSc"),
          con("Stress points", "Bartacked at pocket + placket", "Bartack", null, "—"),
          con("Cuffs", "Elastic, rib, or adjustable", "Lockstitch", 10, "EFb"),
        ],
        flatsNeeded: ["front", "back"],
        openQuestions: [...baseQ, "Confirm zipper/snap brand + finish", "Lining type (taffeta vs mesh) + fill?"],
      };
    case "canvas-jacket":
      return {
        bom: [shell(`Cotton canvas, ${fab.composition}`), bom("Collar", "Corduroy contrast collar", "Cotton corduroy"), bom("Closure", "Metal snaps/buttons", "Metal"), bom("Pockets", "Patch pockets", fab.composition), thread],
        construction: [
          con("Seams", "Felled or double-topstitched", "Lockstitch 301", 8, "LSc"),
          con("Front placket", "Snap/button placket", "Lockstitch + bartack", 8, "LSc"),
          con("Pockets", "Patch, bartacked corners", "Lockstitch + bartack", 8, "LSa"),
          con("Collar", "Corduroy, topstitched", "Lockstitch 301", 10, "LSa"),
        ],
        flatsNeeded: ["front", "back"],
        openQuestions: [...baseQ, "Confirm snap/button finish + supplier", "Lined vs unlined body?"],
      };
    case "down-jacket":
      return {
        bom: [shell(`Nylon shell, ${fab.composition}`), bom("Lining", "Down-proof nylon", "Nylon"), bom("Fill", "CONFIRM: down (fill power + g/panel) or synthetic", ""), bom("Closure", "CF zipper, branded pull", "Metal/poly"), thread],
        construction: [
          con("Body", "Box-baffle or sewn-through channels", "Lockstitch 301, down-proof", 12, "LSc"),
          con("Quilting", "Channel quilt, even fill distribution", "Lockstitch 301", 12, "—"),
          con("Closure", "CF zipper, internal storm flap", "Lockstitch 301", 12, "LSc"),
          con("Hem + cuffs", "Elastic-bound or snap-adjust", "Bound", 10, "BSa"),
        ],
        flatsNeeded: ["front", "back", "baffle layout"],
        openQuestions: [...baseQ, "CONFIRM fill: down fill-power + grams per panel, OR synthetic weight — production-critical, not derivable", "Baffle construction: box vs sewn-through?"],
      };
    case "fleece-bottom":
      return {
        bom: [shell(`${fab.gsm ?? "?"}gsm brushed-back fleece, ${fab.composition}`), bom("Waistband", "Elastic + drawcord, tipped eyelets", "Elastic/cotton"), bom("Cuff/hem", "2×2 rib or open hem", fab.composition), thread],
        construction: [
          con("Waistband", "Tunnelled elastic, drawcord through eyelets", "Coverstitch + bartack", 10, "EFb"),
          con("Side seams + pockets", "Side-seam pockets", "Overlock 504 + lockstitch", 10, "SSa"),
          con("Hem", "2×2 rib cuff or 1.5\" open hem", "Coverstitch 406", 12, "EFb"),
          con("Rise", "Gusset at crotch", "Overlock 504", 10, "SSa"),
        ],
        flatsNeeded: ["front", "back"],
        openQuestions: [...baseQ, "Confirm waistband elastic width + drawcord finish", "Cuffed vs open hem?"],
      };
  }
}

async function main() {
  const products = await getProducts({ includeDrafts: true });
  const out: Record<string, GarmentPassport> = {};
  let done = 0;

  for (const [slug, cls] of Object.entries(CLASS_OF)) {
    const product = products.find((p) => p.slug === slug);
    if (!product) {
      console.log(`skip ${slug} — product not found`);
      continue;
    }
    const meas = (await getProductMeasurements(slug).catch(() => null)) as { rows?: { pom: string; values: Record<string, number> }[]; sampleSize?: string } | null;
    if (!meas?.rows?.length) {
      console.log(`skip ${slug} — no measurements`);
      continue;
    }
    const variant = product.variants[0];
    const fab = parseFabric(variant?.fabric);

    const poms: SizeChartPom[] = meas.rows.map((r, i) => ({
      code: code(i),
      name: r.pom,
      tolerance: tolFor(r.pom),
      bySize: r.values,
      _assumed: false, // ← real factory grading, verbatim
    }));

    const t = build(cls, fab, variant);
    out[slug] = {
      styleNumber: product.skuCode,
      styleName: product.displayName,
      category: product.category,
      bom: t.bom,
      sizeChart: { baseSize: meas.sampleSize || "M", poms },
      construction: t.construction,
      labelsPackaging: { ...LABELS_SEWN },
      flatsNeeded: t.flatsNeeded,
      openQuestions: t.openQuestions,
      _generatedAt: new Date().toISOString().slice(0, 10),
      _status: "draft",
    };
    const assumed = out[slug].bom.filter((r) => r._assumed).length + out[slug].construction.length + 1;
    console.log(`✓ ${slug.padEnd(22)} class=${cls.padEnd(14)} POMs=${poms.length} (verified) · assumed≈${assumed} · Q=${t.openQuestions.length}`);
    done++;
  }

  fs.writeFileSync(path.join(process.cwd(), "lib/garment-specs.generated.json"), JSON.stringify(out, null, 2));
  console.log(`\nWrote ${done} passports → lib/garment-specs.generated.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
