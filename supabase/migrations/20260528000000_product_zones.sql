-- Per-product print-placement zones, authored visually in the studio.
-- zones jsonb shape: { "front": [Loc...], "back": [Loc...] }
create table if not exists product_zones (
  product_slug text primary key,
  zones jsonb not null,
  updated_at timestamptz not null default now()
);

alter table product_zones enable row level security;
