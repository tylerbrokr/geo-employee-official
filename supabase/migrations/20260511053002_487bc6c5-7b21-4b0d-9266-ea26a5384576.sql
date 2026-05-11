-- 1. agent_display_name on client_sites
ALTER TABLE public.client_sites
  ADD COLUMN IF NOT EXISTS agent_display_name TEXT;

-- 2. site_copy table
CREATE TABLE IF NOT EXISTS public.site_copy (
  client_id UUID PRIMARY KEY,
  tagline TEXT NOT NULL DEFAULT '',
  bio_short TEXT NOT NULL DEFAULT '',
  bio_long TEXT NOT NULL DEFAULT '',
  ideal_client_blurb TEXT NOT NULL DEFAULT '',
  area_blurb TEXT NOT NULL DEFAULT '',
  meta_title TEXT NOT NULL DEFAULT '',
  meta_description TEXT NOT NULL DEFAULT '',
  ai_generated_at TIMESTAMPTZ,
  ai_model TEXT,
  manually_edited JSONB NOT NULL DEFAULT '{}'::jsonb,
  stale BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.site_copy ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage site_copy" ON public.site_copy;
CREATE POLICY "Admins manage site_copy"
  ON public.site_copy FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Clients view own site_copy" ON public.site_copy;
CREATE POLICY "Clients view own site_copy"
  ON public.site_copy FOR SELECT
  USING (owns_client(auth.uid(), client_id) OR has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS site_copy_updated_at ON public.site_copy;
CREATE TRIGGER site_copy_updated_at
  BEFORE UPDATE ON public.site_copy
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Staleness function + triggers
CREATE OR REPLACE FUNCTION public.mark_site_copy_stale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _client_id UUID;
BEGIN
  IF TG_TABLE_NAME = 'profiles' THEN
    SELECT id INTO _client_id FROM public.clients WHERE owner_user_id = NEW.id LIMIT 1;
  ELSE
    _client_id := COALESCE(NEW.client_id, OLD.client_id);
  END IF;

  IF _client_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  UPDATE public.site_copy SET stale = true WHERE client_id = _client_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS clients_mark_copy_stale ON public.clients;
CREATE TRIGGER clients_mark_copy_stale
  AFTER UPDATE OF business_name, voice, values_text, ideal_client, brokerage_story, differentiators, property_types, brokerage
  ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.mark_site_copy_stale();

DROP TRIGGER IF EXISTS client_markets_mark_copy_stale ON public.client_markets;
CREATE TRIGGER client_markets_mark_copy_stale
  AFTER INSERT OR UPDATE ON public.client_markets
  FOR EACH ROW EXECUTE FUNCTION public.mark_site_copy_stale();

DROP TRIGGER IF EXISTS client_specialties_mark_copy_stale ON public.client_specialties;
CREATE TRIGGER client_specialties_mark_copy_stale
  AFTER INSERT OR DELETE ON public.client_specialties
  FOR EACH ROW EXECUTE FUNCTION public.mark_site_copy_stale();

DROP TRIGGER IF EXISTS profiles_mark_copy_stale ON public.profiles;
CREATE TRIGGER profiles_mark_copy_stale
  AFTER UPDATE OF full_name ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.mark_site_copy_stale();

-- 4. Re-attach the existing purge triggers (they exist as functions but were dropped from triggers list)
DROP TRIGGER IF EXISTS posts_enqueue_purge ON public.posts;
CREATE TRIGGER posts_enqueue_purge
  AFTER INSERT OR UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_post_publish_purge();

DROP TRIGGER IF EXISTS client_markets_enqueue_purge ON public.client_markets;
CREATE TRIGGER client_markets_enqueue_purge
  AFTER INSERT OR UPDATE ON public.client_markets
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_markets_update_purge();

-- 5. Validation triggers on existing tables (re-attach)
DROP TRIGGER IF EXISTS validate_client_sites ON public.client_sites;
CREATE TRIGGER validate_client_sites
  BEFORE INSERT OR UPDATE ON public.client_sites
  FOR EACH ROW EXECUTE FUNCTION public.validate_client_sites_ssl_status();

DROP TRIGGER IF EXISTS validate_purges ON public.site_cache_purges;
CREATE TRIGGER validate_purges
  BEFORE INSERT OR UPDATE ON public.site_cache_purges
  FOR EACH ROW EXECUTE FUNCTION public.validate_site_cache_purges();

-- 6. Seed site_copy + agent_display_name for any existing client_sites
INSERT INTO public.site_copy (client_id, stale)
SELECT cs.client_id, true
FROM public.client_sites cs
LEFT JOIN public.site_copy sc ON sc.client_id = cs.client_id
WHERE sc.client_id IS NULL;

UPDATE public.client_sites cs
SET agent_display_name = p.full_name
FROM public.clients c
JOIN public.profiles p ON p.id = c.owner_user_id
WHERE cs.client_id = c.id AND cs.agent_display_name IS NULL;