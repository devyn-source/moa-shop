-- These tables were originally installed outside the migration history.
-- Keep their baseline before account_features, which alters shared_configs.
begin;
create table if not exists public.products (
  id text primary key,
  slug text not null unique,
  data jsonb not null,
  is_published boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);
create index if not exists idx_products_slug on public.products(slug);

create table if not exists public.shared_configs (
  id text primary key,
  slug text not null,
  config jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  event text not null,
  session_id text,
  anon_id text,
  path text,
  slug text,
  value numeric,
  props jsonb not null default '{}'::jsonb,
  referrer text,
  ua text,
  created_at timestamptz not null default now()
);
create index if not exists idx_ae_created on public.analytics_events(created_at desc);
create index if not exists idx_ae_event on public.analytics_events(event);
create index if not exists idx_ae_session on public.analytics_events(session_id);
create index if not exists idx_ae_slug on public.analytics_events(slug);

alter table public.products enable row level security;
alter table public.shared_configs enable row level security;
alter table public.analytics_events enable row level security;
revoke all on public.products,public.shared_configs,public.analytics_events from anon,authenticated;
grant all on public.products,public.shared_configs,public.analytics_events to service_role;
grant usage,select on sequence public.analytics_events_id_seq to service_role;
commit;
