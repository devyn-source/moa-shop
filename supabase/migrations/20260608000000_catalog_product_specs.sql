-- Garment Passport (Layer 1) — the per-SKU garment spec: BOM, size chart, construction,
-- labels/packaging. Authored ONCE per SKU and composed with the per-order decoration
-- sheet (Layer 2) into the vendor tech pack. Seeded from product_zones.measurements
-- where available, so the size chart is factory-verified rather than assumed.
create table if not exists public.catalog_product_specs (
  product_slug text primary key,
  spec         jsonb       not null,
  status       text        not null default 'draft',  -- draft | reviewed
  generated_at timestamptz not null default now(),
  reviewed_at  timestamptz,
  updated_at   timestamptz not null default now()
);
