begin;
create table public.express_job_runs (
  id uuid primary key default gen_random_uuid(),
  job text not null,
  scope text not null,
  status text not null check (status in ('running','succeeded','failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  summary text
);
create index express_job_runs_recent on public.express_job_runs(job, scope, started_at desc);
create table public.express_job_monitors (
  job text primary key,
  enabled boolean not null default false,
  enabled_at timestamptz,
  max_age_minutes integer not null default 35 check (max_age_minutes >= 5),
  checked_at timestamptz
);
insert into public.express_job_monitors(job) values ('express-refunds'),('fulfillment');
create table public.express_operation_incidents (
  id uuid primary key default gen_random_uuid(),
  source_key text not null,
  category text not null,
  summary text not null,
  owner text not null default 'Devyn',
  backup text not null default 'Tyler',
  opened_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  recovered_at timestamptz,
  acknowledged_at timestamptz,
  acknowledged_by text,
  next_action text,
  next_review_at timestamptz
);
create unique index express_incidents_active on public.express_operation_incidents(source_key) where recovered_at is null;
alter table public.express_job_runs enable row level security;
alter table public.express_job_monitors enable row level security;
alter table public.express_operation_incidents enable row level security;
revoke all on public.express_job_runs, public.express_job_monitors, public.express_operation_incidents from anon, authenticated;
grant all on public.express_job_runs, public.express_job_monitors, public.express_operation_incidents to service_role;

create function public.express_operations_watchdog() returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare m record; last_run record; last_ok timestamptz; problem text;
begin
  perform pg_advisory_xact_lock(5200522);
  for m in select * from public.express_job_monitors where enabled loop
    select * into last_run from public.express_job_runs where job=m.job and scope='production' order by started_at desc limit 1;
    select max(finished_at) into last_ok from public.express_job_runs where job=m.job and scope='production' and status='succeeded';
    problem := null;
    if last_run.status='failed' then problem := 'Latest job failed';
    elsif last_run.status='running' and last_run.started_at < now()-interval '5 minutes' then problem := 'Job started but did not finish';
    elsif coalesce(last_ok, m.enabled_at, now()-interval '1 day') < now()-make_interval(mins=>m.max_age_minutes) then problem := 'Scheduled success is overdue';
    end if;
    if problem is not null then
      insert into public.express_operation_incidents(source_key,category,summary)
      values ('job:'||m.job,'scheduler',m.job||': '||problem)
      on conflict (source_key) where recovered_at is null do update set last_seen_at=now(), summary=excluded.summary;
    elsif last_run.status='succeeded' then
      update public.express_operation_incidents set recovered_at=now() where source_key='job:'||m.job and recovered_at is null;
    end if;
    update public.express_job_monitors set checked_at=now() where job=m.job;
  end loop;
end;
$$;
revoke all on function public.express_operations_watchdog() from public, anon, authenticated;
grant execute on function public.express_operations_watchdog() to service_role;
commit;
