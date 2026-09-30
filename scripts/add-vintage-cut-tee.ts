// One-off (9/30): add the Vintage Cut Tee as a DRAFT row (the live shop never lists
// drafts; Express shows it through LAUNCH_STYLES), seed its spec passport, and drop
// client names from the tee + hoodie premium fabric labels in the live rows.
// Run: set -a; source .env.local; set +a; npx tsx scripts/add-vintage-cut-tee.ts
import { createClient } from "@supabase/supabase-js";
import { seedProducts } from "../lib/seed";
import specs from "../lib/garment-specs.generated.json";
import { saveCatalogSpec } from "../lib/garment-spec-store";
import type { GarmentPassport } from "../lib/garment-spec";

const RENAMES: Record<string, string> = {
  "Premium heavy (CODM)": "Premium heavyweight",
  "480gsm cotton fleece (Coachella)": "480gsm cotton fleece, premium",
};

async function main() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const p = seedProducts.find((x) => x.slug === "vintage-cut-tee")!;
  const { error } = await db.from("products").upsert(
    { id: p.id, slug: p.slug, data: p, is_published: false, sort_order: p.sortOrder },
    { onConflict: "id" }
  );
  if (error) throw error;
  console.log("upserted draft", p.slug);

  await saveCatalogSpec("vintage-cut-tee", (specs as Record<string, GarmentPassport>)["vintage-cut-tee"], "draft");
  console.log("seeded spec vintage-cut-tee");

  for (const slug of ["heavyweight-tee", "heavyweight-hoodie"]) {
    const { data: row, error: e } = await db.from("products").select("id,data").eq("slug", slug).single();
    if (e) throw e;
    const opts = (row.data.fabricOptions ?? []) as { label: string }[];
    const changed = opts.filter((o) => RENAMES[o.label]);
    if (!changed.length) { console.log(slug, "no client-named labels"); continue; }
    for (const o of changed) o.label = RENAMES[o.label];
    const { error: u } = await db.from("products").update({ data: { ...row.data, fabricOptions: opts } }).eq("id", row.id);
    if (u) throw u;
    console.log(slug, "renamed", changed.map((o) => o.label));
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
