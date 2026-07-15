import { getSupabase } from "./supabase";

// Shareable configuration links — a buyer configures, shares a /c/<id> URL with
// a teammate/approver, who opens it pre-filled and adds it to cart. Stored in
// Supabase shared_configs (id text, slug, config jsonb, customer_email).
// customer_email is set server-side from the Clerk session (never the client)
// so signed-in customers see their saved designs on /orders; anonymous shares
// keep working with it null.
export async function saveSharedConfig(
  id: string,
  slug: string,
  config: unknown,
  customerEmail?: string | null
): Promise<void> {
  const { error } = await getSupabase()
    .from("shared_configs")
    .insert({ id, slug, config, customer_email: customerEmail ?? null });
  if (error) throw new Error(`Failed to save config: ${error.message}`);
}

export async function getSharedConfig(id: string): Promise<{ slug: string; config: Record<string, unknown> } | null> {
  const { data, error } = await getSupabase().from("shared_configs").select("slug, config").eq("id", id).maybeSingle();
  if (error || !data) return null;
  return { slug: data.slug as string, config: (data.config ?? {}) as Record<string, unknown> };
}

// The signed-in customer's saved designs, newest first — powers the quiet
// "Saved designs" section on /orders. config is included so the card can show
// the chosen colorway chip.
export type SavedDesign = { id: string; slug: string; config: Record<string, unknown>; createdAt: string };

export async function listSharedConfigsByEmail(email: string, limit = 24): Promise<SavedDesign[]> {
  const { data, error } = await getSupabase()
    .from("shared_configs")
    .select("id, slug, config, created_at")
    .eq("customer_email", email)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((r) => ({
    id: r.id as string,
    slug: r.slug as string,
    config: (r.config ?? {}) as Record<string, unknown>,
    createdAt: r.created_at as string
  }));
}
