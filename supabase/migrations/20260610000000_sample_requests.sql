-- Sample-kit request funnel (GATE 2 prep): prospects request a physical kit of
-- the catalog blanks before committing to an order. Read by MOA ops only
-- (service role); no public/RLS access.
create table if not exists sample_requests (
  id uuid primary key default gen_random_uuid(),
  contact_name text not null,
  contact_email text not null,
  company_name text not null,
  role_title text,
  ship_to jsonb not null default '{}'::jsonb,
  interested_slugs text[] not null default '{}',
  est_quantity text,
  timeline text,
  notes text,
  status text not null default 'requested', -- requested → approved → shipped → converted/declined
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table sample_requests enable row level security;
-- no policies: service-role access only.

create index if not exists sample_requests_status_idx on sample_requests (status, created_at desc);
