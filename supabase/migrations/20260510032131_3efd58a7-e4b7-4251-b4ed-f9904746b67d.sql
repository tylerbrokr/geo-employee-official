-- Schedule autopilot-tick hourly via pg_cron + pg_net
SELECT cron.schedule(
  'autopilot-tick-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://gfxdpbitanyuaowhiwzc.supabase.co/functions/v1/autopilot-tick',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  $$
);