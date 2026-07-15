-- Account features (Jul 14): saved designs ownership, wishlist hearts,
-- invoice/PO hand-raise requests. Applied via scripts/migrate-account-features.ts.

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
  customer_email text,                                -- signed-in Clerk email, when present
  status         text not null default 'requested',   -- requested → invoiced → paid / declined
  created_at     timestamptz not null default now()
);
alter table invoice_requests enable row level security;
create index if not exists invoice_requests_created_at_idx on invoice_requests (created_at desc);
