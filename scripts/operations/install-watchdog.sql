-- Independent of Vercel cron. Monitors remain disabled until the app is deployed.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('moa-express-watchdog','*/5 * * * *','select public.express_operations_watchdog()');
