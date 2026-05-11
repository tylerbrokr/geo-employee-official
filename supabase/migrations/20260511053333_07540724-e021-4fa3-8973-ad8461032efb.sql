SELECT cron.unschedule(jobname) FROM cron.job WHERE jobname = 'regenerate-stale-site-copy-every-2min';

SELECT cron.schedule(
  'regenerate-stale-site-copy-every-2min',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://gfxdpbitanyuaowhiwzc.supabase.co/functions/v1/regenerate-stale-site-copy',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdmeGRwYml0YW55dWFvd2hpd3pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzNzQyNzQsImV4cCI6MjA5Mzk1MDI3NH0.tDc_27_y2oplcA9xXsuHy8IeisdsO14W22C3NcSkn_4"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);