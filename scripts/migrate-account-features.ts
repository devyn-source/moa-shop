// One-off migration: account features (saved designs + wishlist + invoice requests).
// Mirrors scripts/reseed-products.ts env setup. Run:
//   npx --yes tsx scripts/migrate-account-features.ts
//
// DDL can't go through PostgREST (the service key only speaks the data API), so
// the SQL below is applied via the Supabase Management API — the project's
// established DDL path (never the Dashboard). Token comes from SUPABASE_ACCESS_TOKEN
// or the Supabase CLI's macOS keychain entry. The service-role client is then
// used to verify the schema actually landed.
import fs from "fs";
import { execSync } from "child_process";
import { createClient } from "@supabase/supabase-js";

// The migration SQL (also recorded at supabase/migrations/20260714000000_account_features.sql).
const SQL = `
-- 1) Saved designs — associate a shared config (/c/<id>) with the signed-in
--    customer. Set server-side from the Clerk session; never trusted from the
--    client. Nullable: anonymous shares keep working unchanged.
alter table shared_configs add column if not exists customer_email text;
create index if not exists shared_configs_customer_email_idx
  on shared_configs (customer_email, created_at desc);

-- 2) Wishlist hearts — one row per (customer, product).
create table if not exists wishlists (
  customer_email text not null,
  product_slug   text not null,
  created_at     timestamptz not null default now(),
  primary key (customer_email, product_slug)
);
alter table wishlists enable row level security;
-- no policies: service-role access only (all reads/writes are server-side).

-- 3) Invoice / PO payment-lane requests from checkout. A hand-raise lead, not
--    an order — the Stripe flow is untouched. Read by MOA ops (service role).
create table if not exists invoice_requests (
  id             uuid primary key default gen_random_uuid(),
  company_name   text not null,
  work_email     text not null,
  po_number      text,
  note           text,
  customer_email text,
  status         text not null default 'requested',
  created_at     timestamptz not null default now()
);
alter table invoice_requests enable row level security;
create index if not exists invoice_requests_created_at_idx on invoice_requests (created_at desc);
`;

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

function managementToken(): string {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN;
  // Supabase CLI keychain entry (go-keyring base64-wraps the sbp_ token).
  const raw = execSync(`security find-generic-password -s "Supabase CLI" -a "supabase" -w`, {
    encoding: "utf8"
  }).trim();
  return raw.startsWith("go-keyring-base64:")
    ? Buffer.from(raw.slice("go-keyring-base64:".length), "base64").toString("utf8")
    : raw;
}

async function main() {
  const ref = /https?:\/\/([a-z0-9]+)\.supabase\.co/.exec(env.SUPABASE_URL ?? "")?.[1];
  if (!ref) throw new Error("Couldn't derive project ref from SUPABASE_URL in .env.local");

  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${managementToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: SQL })
  });
  if (!res.ok) throw new Error(`Management API ${res.status}: ${await res.text()}`);
  console.log(`DDL applied to ${ref}.`);

  // New tables aren't visible to the data API until PostgREST reloads its
  // schema cache — ask for the reload, give it a beat, then verify.
  await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${managementToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: "notify pgrst, 'reload schema';" })
  });

  // Verify with the service-role client (data API) that the schema landed.
  const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  for (let attempt = 1; ; attempt++) {
    const results = await Promise.all([
      sb.from("shared_configs").select("id, customer_email").limit(1),
      sb.from("wishlists").select("customer_email").limit(1),
      sb.from("invoice_requests").select("id").limit(1)
    ]);
    const failed = results.find((r) => r.error);
    if (!failed) break;
    if (attempt >= 5) throw new Error(`verification failed: ${failed.error?.message}`);
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.log("Verified: shared_configs.customer_email, wishlists, invoice_requests all present.");
}

main().catch((e) => {
  console.error("MIGRATION FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
