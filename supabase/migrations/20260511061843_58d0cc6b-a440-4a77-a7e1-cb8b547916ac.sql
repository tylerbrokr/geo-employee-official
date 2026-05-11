-- 1. NAP fields on clients (for LLM citation authority + LocalBusiness schema)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS phone_e164 text,
  ADD COLUMN IF NOT EXISTS street_address text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text;

-- 2. OG image on site_copy
ALTER TABLE public.site_copy
  ADD COLUMN IF NOT EXISTS og_image_url text;

-- 3. client_areas table (one row per crawlable /areas/[slug] page)
CREATE TABLE IF NOT EXISTS public.client_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  slug text NOT NULL,
  area_type text NOT NULL CHECK (area_type IN ('city','neighborhood','county')),
  name text NOT NULL,
  state text,
  parent_area_id uuid REFERENCES public.client_areas(id) ON DELETE SET NULL,
  intro text NOT NULL DEFAULT '',
  market_blurb text NOT NULL DEFAULT '',
  faqs jsonb NOT NULL DEFAULT '[]'::jsonb,
  meta_title text NOT NULL DEFAULT '',
  meta_description text NOT NULL DEFAULT '',
  stale boolean NOT NULL DEFAULT true,
  ai_model text,
  ai_generated_at timestamptz,
  manually_edited jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_client_areas_client ON public.client_areas(client_id);
CREATE INDEX IF NOT EXISTS idx_client_areas_stale ON public.client_areas(stale) WHERE stale = true;

ALTER TABLE public.client_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage client_areas"
  ON public.client_areas FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Clients view own client_areas"
  ON public.client_areas FOR SELECT
  USING (owns_client(auth.uid(), client_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anon read client_areas for live sites"
  ON public.client_areas FOR SELECT
  TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.client_sites s
    WHERE s.client_id = client_areas.client_id AND s.dns_verified = true
  ));

CREATE TRIGGER trg_client_areas_updated_at
  BEFORE UPDATE ON public.client_areas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. public_client_areas view (mirrors public_site_copy pattern)
CREATE OR REPLACE VIEW public.public_client_areas
WITH (security_invoker=on) AS
SELECT
  a.client_id,
  a.slug,
  a.area_type,
  a.name,
  a.state,
  a.intro,
  a.market_blurb,
  a.faqs,
  a.meta_title,
  a.meta_description,
  a.updated_at
FROM public.client_areas a
JOIN public.client_sites s ON s.client_id = a.client_id
WHERE s.dns_verified = true;

GRANT SELECT ON public.public_client_areas TO anon, authenticated;

-- 5. Update mark_site_copy_stale to also mark areas stale when markets change
CREATE OR REPLACE FUNCTION public.mark_areas_stale_on_markets_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.client_areas SET stale = true WHERE client_id = NEW.client_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_areas_stale_on_markets ON public.client_markets;
CREATE TRIGGER trg_mark_areas_stale_on_markets
  AFTER INSERT OR UPDATE ON public.client_markets
  FOR EACH ROW EXECUTE FUNCTION public.mark_areas_stale_on_markets_change();