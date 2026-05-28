-- Future dedicated MOA Shop Supabase schema.
-- The current MVP uses local JSON persistence in .data until credentials exist.

create table if not exists shop_vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text not null,
  contact_name text,
  contact_email text,
  contact_wechat text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists catalog_products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  category text not null,
  display_name text not null,
  headline_description text not null,
  long_description text not null,
  default_vendor_id uuid references shop_vendors(id),
  vendor_unit_cost_usd numeric(12,2) not null default 0,
  moq integer not null,
  lead_time_days integer not null,
  is_published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists catalog_product_variants (
  id uuid primary key default gen_random_uuid(),
  catalog_product_id uuid not null references catalog_products(id) on delete cascade,
  fabric_label text not null,
  color_label text not null,
  color_hex text not null,
  mockup_template_url text,
  is_available boolean not null default true,
  sort_order integer not null default 0
);

create table if not exists catalog_decoration_methods (
  id uuid primary key default gen_random_uuid(),
  catalog_product_id uuid not null references catalog_products(id) on delete cascade,
  method text not null,
  per_unit_adder_usd numeric(12,2) not null default 0,
  max_colors integer,
  placement_zones jsonb not null default '[]'::jsonb,
  is_available boolean not null default true,
  sort_order integer not null default 0
);

create table if not exists catalog_price_tiers (
  id uuid primary key default gen_random_uuid(),
  catalog_product_id uuid not null references catalog_products(id) on delete cascade,
  min_qty integer not null,
  max_qty integer,
  per_unit_usd numeric(12,2) not null
);

create table if not exists shop_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  clerk_user_id text,
  contact_name text not null,
  contact_email text not null,
  contact_phone text,
  company_name text,
  catalog_product_id uuid references catalog_products(id),
  variant_id uuid,
  decoration_method text,
  quantity integer not null,
  per_unit_usd numeric(12,2) not null,
  decoration_adder_usd numeric(12,2) not null default 0,
  subtotal_usd numeric(12,2) not null,
  tax_usd numeric(12,2) not null default 0,
  total_usd numeric(12,2) not null,
  customer_artwork_url text,
  customer_artwork_notes text,
  stripe_payment_intent_id text,
  stripe_checkout_session_id text,
  payment_status text not null default 'unpaid',
  status text not null default 'paid',
  ship_to_name text,
  ship_to_address jsonb not null default '{}'::jsonb,
  tracking_carrier text,
  tracking_number text,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists shop_order_status_log (
  id uuid primary key default gen_random_uuid(),
  shop_order_id uuid not null references shop_orders(id) on delete cascade,
  status_from text,
  status_to text not null,
  actor_clerk_user_id text,
  note text,
  created_at timestamptz not null default now()
);
