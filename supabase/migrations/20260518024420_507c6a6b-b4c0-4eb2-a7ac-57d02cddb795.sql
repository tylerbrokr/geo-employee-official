
-- 1) IndexNow key on client_sites
ALTER TABLE public.client_sites
  ADD COLUMN IF NOT EXISTS indexnow_key text UNIQUE,
  ADD COLUMN IF NOT EXISTS last_indexnow_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_indexnow_count integer;

UPDATE public.client_sites
  SET indexnow_key = replace(gen_random_uuid()::text, '-', '')
  WHERE indexnow_key IS NULL;

-- 2) NAP checklist
CREATE TABLE IF NOT EXISTS public.nap_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  item_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  completed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, item_key)
);

ALTER TABLE public.nap_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage nap_checklist"
  ON public.nap_checklist FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners view own nap_checklist"
  ON public.nap_checklist FOR SELECT
  USING (owns_client(auth.uid(), client_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners update own nap_checklist"
  ON public.nap_checklist FOR UPDATE
  USING (owns_client(auth.uid(), client_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners insert own nap_checklist"
  ON public.nap_checklist FOR INSERT
  WITH CHECK (owns_client(auth.uid(), client_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_nap_checklist_updated
  BEFORE UPDATE ON public.nap_checklist
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed function + trigger
CREATE OR REPLACE FUNCTION public.seed_nap_checklist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.nap_checklist (client_id, item_key)
  VALUES
    (NEW.id, 'gmb_verified'),
    (NEW.id, 'gmb_nap_matches'),
    (NEW.id, 'bing_places_claimed'),
    (NEW.id, 'zillow_profile_matches'),
    (NEW.id, 'realtor_profile_matches'),
    (NEW.id, 'facebook_page_matches')
  ON CONFLICT (client_id, item_key) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_seed_nap_checklist
  AFTER INSERT ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.seed_nap_checklist();

-- Backfill for existing clients
INSERT INTO public.nap_checklist (client_id, item_key)
SELECT c.id, k.item_key
FROM public.clients c
CROSS JOIN (VALUES
  ('gmb_verified'),
  ('gmb_nap_matches'),
  ('bing_places_claimed'),
  ('zillow_profile_matches'),
  ('realtor_profile_matches'),
  ('facebook_page_matches')
) AS k(item_key)
ON CONFLICT (client_id, item_key) DO NOTHING;

-- 3) Publish days array
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS autopilot_days smallint[] NOT NULL DEFAULT ARRAY[1,4]::smallint[];

-- Backfill from existing autopilot_day where set
UPDATE public.clients
SET autopilot_days = ARRAY[autopilot_day, ((autopilot_day + 3) % 7)::smallint]::smallint[]
WHERE autopilot_day IS NOT NULL
  AND (autopilot_days IS NULL OR autopilot_days = ARRAY[1,4]::smallint[]);
