import { getSupabase } from "./supabase";

// Wishlist hearts — one row per (customer_email, product_slug). All access is
// server-side via the service-role client; ownership = the signed-in Clerk
// email, enforced by the callers (route handler / /orders page), never the URL.

// Saved slugs for a customer, newest first.
export async function listWishlistSlugs(email: string): Promise<string[]> {
  const { data, error } = await getSupabase()
    .from("wishlists")
    .select("product_slug")
    .eq("customer_email", email)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map((r) => r.product_slug as string);
}

// Toggle a heart. Returns the new state: true = saved, false = removed.
export async function toggleWishlist(email: string, slug: string): Promise<boolean> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("wishlists")
    .select("product_slug")
    .eq("customer_email", email)
    .eq("product_slug", slug)
    .maybeSingle();
  if (error) throw new Error(`wishlist lookup failed: ${error.message}`);

  if (data) {
    const { error: delError } = await sb
      .from("wishlists")
      .delete()
      .eq("customer_email", email)
      .eq("product_slug", slug);
    if (delError) throw new Error(`wishlist remove failed: ${delError.message}`);
    return false;
  }

  const { error: insError } = await sb
    .from("wishlists")
    .insert({ customer_email: email, product_slug: slug });
  // A concurrent double-tap can race the existence check into the PK — that
  // still means "saved", so only real failures throw.
  if (insError && insError.code !== "23505") throw new Error(`wishlist save failed: ${insError.message}`);
  return true;
}
