begin;
insert into public.express_job_monitors(job) values ('express-operations') on conflict do nothing;
create function public.sync_express_order_incidents(p_incidents jsonb) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare item jsonb;
begin
  if jsonb_typeof(p_incidents) <> 'array' or jsonb_array_length(p_incidents) > 3000 then raise exception 'Invalid incident snapshot'; end if;
  perform pg_advisory_xact_lock(5200523);
  for item in select value from jsonb_array_elements(p_incidents) loop
    if coalesce(item->>'key','') !~ '^order:[A-Za-z0-9_-]+:(proof|hold|shipping)$' or length(coalesce(item->>'summary','')) not between 5 and 500 then raise exception 'Invalid incident'; end if;
    insert into public.express_operation_incidents(source_key,category,summary)
    values ('backend:'||(item->>'key'),item->>'category',item->>'summary')
    on conflict (source_key) where recovered_at is null do update set last_seen_at=now(),summary=excluded.summary;
  end loop;
  update public.express_operation_incidents set recovered_at=now()
  where source_key like 'backend:order:%' and recovered_at is null
    and not exists(select 1 from jsonb_array_elements(p_incidents) i where 'backend:'||(i->>'key')=source_key);
end;
$$;
revoke all on function public.sync_express_order_incidents(jsonb) from public,anon,authenticated;
grant execute on function public.sync_express_order_incidents(jsonb) to service_role;
commit;
