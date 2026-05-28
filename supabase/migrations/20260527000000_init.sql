-- MOA Catalog — dedicated Supabase project (separate from MoaOS).
-- MVP persists ORDERS only. Catalog products/vendors stay in app seed data
-- (lib/seed.ts) and are read-only, so orders are decoupled from product IDs.

create table if not exists orders (
  id uuid primary key,
  order_number text not null unique,
  status text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_created_at_idx on orders (created_at desc);
create index if not exists orders_status_idx on orders (status);

-- RLS on with no policies: only the service_role key (server-side) can access.
alter table orders enable row level security;
