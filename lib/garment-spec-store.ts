// Persistent, mutable Garment Passport store (Supabase catalog_product_specs).
// This is the SOURCE OF TRUTH once MOA captures + locks the real per-SKU values.
// Falls back to the committed file seed (the category-template bootstrap draft)
// for SKUs that haven't been stored yet. The vendor tech pack must only ever read
// a row whose status is "approved" (set in stone) — see isPassportLocked.
import { getSupabase } from "./supabase";
import { getProductSpec as seedSpec, type GarmentPassport } from "./garment-spec";

export type SpecStatus = "draft" | "reviewed" | "approved";

// Stored spec (locked/edited) if present; else the bootstrap seed draft.
export async function getCatalogSpec(slug: string): Promise<GarmentPassport | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("catalog_product_specs")
    .select("spec,status,generated_at,reviewed_at")
    .eq("product_slug", slug)
    .maybeSingle();
  if (error) throw new Error(`Failed to load spec ${slug}: ${error.message}`);
  if (data?.spec) return { ...(data.spec as GarmentPassport), _status: data.status as SpecStatus };
  return seedSpec(slug);
}

export async function saveCatalogSpec(slug: string, spec: GarmentPassport, status: SpecStatus): Promise<void> {
  const supabase = getSupabase();
  const now = new Date().toISOString();
  const { error } = await supabase.from("catalog_product_specs").upsert(
    {
      product_slug: slug,
      spec: { ...spec, _status: status },
      status,
      updated_at: now,
      ...(status === "approved" ? { reviewed_at: now } : {})
    },
    { onConflict: "product_slug" }
  );
  if (error) throw new Error(`Failed to save spec ${slug}: ${error.message}`);
}

// All stored specs (for the admin list).
export async function listCatalogSpecs(): Promise<{ slug: string; spec: GarmentPassport; status: SpecStatus }[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("catalog_product_specs")
    .select("product_slug,spec,status")
    .order("product_slug");
  if (error) throw new Error(`Failed to list specs: ${error.message}`);
  return (data ?? []).map((r) => ({ slug: r.product_slug, spec: r.spec as GarmentPassport, status: r.status as SpecStatus }));
}
