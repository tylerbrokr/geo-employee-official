
-- Phase 4.1: IndexNow submissions audit log
CREATE TABLE public.indexnow_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  url_count int NOT NULL,
  status text NOT NULL CHECK (status IN ('success','failure')),
  http_status int,
  error_message text,
  urls_sample text[] NOT NULL DEFAULT '{}'
);
CREATE INDEX idx_indexnow_submissions_client_time
  ON public.indexnow_submissions (client_id, submitted_at DESC);

ALTER TABLE public.indexnow_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage indexnow_submissions"
  ON public.indexnow_submissions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Clients view own indexnow_submissions"
  ON public.indexnow_submissions FOR SELECT
  USING (public.owns_client(auth.uid(), client_id) OR public.has_role(auth.uid(), 'admin'::app_role));

-- Phase 4.2: Custom domain NAP checklist item
-- Update seed function to include the new item for future clients
CREATE OR REPLACE FUNCTION public.seed_nap_checklist()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.nap_checklist (client_id, item_key)
  VALUES
    (NEW.id, 'gmb_verified'),
    (NEW.id, 'gmb_nap_matches'),
    (NEW.id, 'bing_places_claimed'),
    (NEW.id, 'zillow_profile_matches'),
    (NEW.id, 'realtor_profile_matches'),
    (NEW.id, 'facebook_page_matches'),
    (NEW.id, 'custom_domain_connected')
  ON CONFLICT (client_id, item_key) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- Backfill existing clients
INSERT INTO public.nap_checklist (client_id, item_key)
SELECT id, 'custom_domain_connected' FROM public.clients
ON CONFLICT (client_id, item_key) DO NOTHING;
