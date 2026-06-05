import { getSupabase } from "./supabase";

// Shareable configuration links — a buyer configures, shares a /c/<id> URL with
// a teammate/approver, who opens it pre-filled and adds it to cart. Stored in
// Supabase shared_configs (id text, slug, config jsonb).
export async function saveSharedConfig(id: string, slug: string, config: unknown): Promise<void> {
  const { error } = await getSupabase().from("shared_configs").insert({ id, slug, config });
  if (error) throw new Error(`Failed to save config: ${error.message}`);
}

export async function getSharedConfig(id: string): Promise<{ slug: string; config: Record<string, unknown> } | null> {
  const { data, error } = await getSupabase().from("shared_configs").select("slug, config").eq("id", id).maybeSingle();
  if (error || !data) return null;
  return { slug: data.slug as string, config: (data.config ?? {}) as Record<string, unknown> };
}
