import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

// Server-side client using the service-role key. Orders read/write happens in
// server components and route handlers only — never expose this to the browser.
export function getSupabase(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
  }

  client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return client;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Orders are looked up by either UUID (order.id) or order number (MOA-S-...).
// The id column is a uuid, so guard which column we filter to avoid cast errors.
export function orderLookupColumn(value: string): "id" | "order_number" {
  return UUID_RE.test(value) ? "id" : "order_number";
}
