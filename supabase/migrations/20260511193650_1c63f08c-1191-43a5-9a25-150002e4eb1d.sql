ALTER TABLE public.client_markets
  ADD COLUMN IF NOT EXISTS raw_input jsonb NOT NULL DEFAULT '{}'::jsonb;