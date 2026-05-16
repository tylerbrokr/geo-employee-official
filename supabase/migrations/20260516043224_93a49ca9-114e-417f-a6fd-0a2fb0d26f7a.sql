CREATE TABLE public.client_visibility_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  total_score SMALLINT NOT NULL,
  profile_score SMALLINT NOT NULL,
  infra_score SMALLINT NOT NULL,
  schema_score SMALLINT NOT NULL,
  content_score SMALLINT NOT NULL,
  checks JSONB NOT NULL DEFAULT '[]'::jsonb,
  hostname TEXT,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_visibility_reports_client_created ON public.client_visibility_reports (client_id, created_at DESC);

ALTER TABLE public.client_visibility_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage visibility reports"
ON public.client_visibility_reports
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));