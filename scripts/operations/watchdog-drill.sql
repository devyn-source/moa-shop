begin;
insert into public.express_job_monitors(job,enabled,enabled_at) values ('stage4-drill',true,now()-interval '1 hour');
select public.express_operations_watchdog();
do $$ begin
 if not exists(select 1 from public.express_operation_incidents where source_key='job:stage4-drill' and recovered_at is null) then raise exception 'Missed run was not detected'; end if;
end $$;
insert into public.express_job_runs(job,scope,status,started_at,finished_at) values ('stage4-drill','production','succeeded',now(),now());
select public.express_operations_watchdog();
do $$ begin
 if exists(select 1 from public.express_operation_incidents where source_key='job:stage4-drill' and recovered_at is null) then raise exception 'Recovered job remained open'; end if;
end $$;
insert into public.express_job_runs(job,scope,status,started_at,finished_at) values ('stage4-drill','production','failed',now()+interval '1 second',now()+interval '1 second');
select public.express_operations_watchdog();
select public.express_operations_watchdog();
do $$ begin
 if (select count(*) from public.express_operation_incidents where source_key='job:stage4-drill' and recovered_at is null) != 1 then raise exception 'Failed job was lost or duplicated'; end if;
 if has_table_privilege('anon','public.express_job_runs','select') or has_table_privilege('authenticated','public.express_operation_incidents','update') or has_function_privilege('anon','public.express_operations_watchdog()','execute') then raise exception 'Monitoring permissions too broad'; end if;
end $$;
rollback;
select 'Missed run, recovery, failure, deduplication and restricted access passed; fixtures rolled back' as result;
