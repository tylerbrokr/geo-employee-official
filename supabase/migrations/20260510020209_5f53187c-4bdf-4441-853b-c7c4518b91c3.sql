
-- Pipeline stage enum
CREATE TYPE public.pipeline_stage AS ENUM (
  'draft', 'intake_sent', 'intake_complete', 'site_live', 'topics_ready', 'autopilot'
);

CREATE TYPE public.topic_kind AS ENUM ('seo', 'geo');
CREATE TYPE public.topic_status AS ENUM ('queued', 'used', 'skipped');

-- Extend clients with pipeline + autopilot + richer intake fields
ALTER TABLE public.clients
  ADD COLUMN pipeline_stage public.pipeline_stage NOT NULL DEFAULT 'draft',
  ADD COLUMN autopilot_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN autopilot_day smallint,
  ADD COLUMN autopilot_started_at timestamptz,
  ADD COLUMN last_autopublish_at timestamptz,
  ADD COLUMN voice text,
  ADD COLUMN values_text text,
  ADD COLUMN ideal_client text,
  ADD COLUMN brokerage_story text,
  ADD COLUMN differentiators text,
  ADD COLUMN property_types text[] NOT NULL DEFAULT '{}'::text[];

-- client_sites
CREATE TABLE public.client_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL UNIQUE,
  subdomain text,
  custom_domain text UNIQUE,
  vercel_domain_id text,
  dns_verified boolean NOT NULL DEFAULT false,
  dns_records jsonb,
  provisioned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own site" ON public.client_sites FOR SELECT
  USING (public.owns_client(auth.uid(), client_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage sites" ON public.client_sites FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_client_sites_updated
  BEFORE UPDATE ON public.client_sites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- client_topics
CREATE TABLE public.client_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  kind public.topic_kind NOT NULL,
  title text NOT NULL,
  primary_keyword text,
  secondary_keywords text[] NOT NULL DEFAULT '{}'::text[],
  talking_points text[] NOT NULL DEFAULT '{}'::text[],
  h2s text[] NOT NULL DEFAULT '{}'::text[],
  geo_scope text,
  niche text,
  word_count integer,
  position integer NOT NULL DEFAULT 0,
  status public.topic_status NOT NULL DEFAULT 'queued',
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_topics_client_status ON public.client_topics(client_id, status, position);

ALTER TABLE public.client_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own topics" ON public.client_topics FOR SELECT
  USING (public.owns_client(auth.uid(), client_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage topics" ON public.client_topics FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_client_topics_updated
  BEFORE UPDATE ON public.client_topics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- posts: link back to topic + extras
ALTER TABLE public.posts
  ADD COLUMN topic_id uuid REFERENCES public.client_topics(id) ON DELETE SET NULL,
  ADD COLUMN excerpt text,
  ADD COLUMN cover_image_url text;
