CREATE TABLE IF NOT EXISTS public.email_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  template_name text NOT NULL,
  recipient_email text NOT NULL,
  status text NOT NULL,
  error_message text,
  provider_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_send_log_recipient ON public.email_send_log (recipient_email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_send_log_message ON public.email_send_log (message_id);

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read email log"
ON public.email_send_log FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));