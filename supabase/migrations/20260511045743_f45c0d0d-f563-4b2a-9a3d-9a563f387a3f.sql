
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any previous schedules with the same names
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('verify-domains-every-5min', 'purge-site-cache-every-1min');

SELECT cron.schedule(
  'verify-domains-every-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://gfxdpbitanyuaowhiwzc.supabase.co/functions/v1/verify-domains',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmeGRwYml0YW55dWFvd2hpd3pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzNzQyNzQsImV4cCI6MjA5Mzk1MDI3NH0.tDc_27_y2oplcA9xXsuHy8IeisdsO14W22C3NcSkn_4"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

SELECT cron.schedule(
  'purge-site-cache-every-1min',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://gfxdpbitanyuaowhiwzc.supabase.co/functions/v1/purge-site-cache',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmeGRwYml0YW55dWFvd2hpd3pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzNzQyNzQsImV4cCI6MjA5Mzk1MDI3NH0.tDc_27_y2oplcA9xXsuHy8IeisdsO14W22C3NcSkn_4"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
