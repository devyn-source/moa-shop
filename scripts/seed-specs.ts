// One-time: load the file-seed passport drafts into catalog_product_specs so the
// admin flow can edit/lock them. Run: set -a; source .env.local; set +a; npx tsx scripts/seed-specs.ts
import specs from "../lib/garment-specs.generated.json";
import { saveCatalogSpec, type SpecStatus } from "../lib/garment-spec-store";
import type { GarmentPassport } from "../lib/garment-spec";

async function main() {
  const entries = Object.entries(specs as Record<string, GarmentPassport>);
  for (const [slug, spec] of entries) {
    await saveCatalogSpec(slug, spec, (spec._status as SpecStatus) || "draft");
    console.log("seeded", slug);
  }
  console.log(`\nseeded ${entries.length} drafts → catalog_product_specs`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
