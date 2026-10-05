begin;
create table public.express_alert_deliveries (
  content_hash text primary key,
  incident_id uuid not null references public.express_operation_incidents(id),
  message jsonb not null,
  status text not null default 'draft' check(status in ('draft','sending','sent','unknown')),
  approved_by text,
  provider_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.express_alert_deliveries enable row level security;
revoke all on public.express_alert_deliveries from anon,authenticated;
grant select,insert,update on public.express_alert_deliveries to service_role;
commit;
