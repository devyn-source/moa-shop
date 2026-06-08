// One-off: re-upsert the canonical seed into Supabase `products`.
// getProducts() only seeds when the table is EMPTY, so changes to seed.ts
// (colorways, decorations, pricing) need this to land. Run:
//   npx --yes tsx scripts/reseed-products.ts
import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import { seedProducts } from "../lib/seed";

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
);

const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const rows = seedProducts.map((p, i) => ({
  id: p.id,
  slug: p.slug,
  data: p,
  is_published: p.isPublished ?? true,
  sort_order: p.sortOrder ?? i
}));

async function main() {
  const { data, error } = await sb.from("products").upsert(rows, { onConflict: "id" }).select("id");
  if (error) {
    console.error("RESEED FAILED:", error.message);
    process.exit(1);
  }
  console.log(`Re-seeded ${data?.length ?? rows.length} products to Supabase.`);
}
main();
