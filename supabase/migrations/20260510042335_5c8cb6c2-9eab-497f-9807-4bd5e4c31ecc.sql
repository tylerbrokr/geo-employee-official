
CREATE TABLE public.email_template_copy (
  template_name TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  eyebrow TEXT NOT NULL DEFAULT '',
  headline TEXT NOT NULL,
  body_paragraphs TEXT[] NOT NULL DEFAULT '{}',
  cta_label TEXT NOT NULL DEFAULT '',
  signature_line_1 TEXT NOT NULL DEFAULT '',
  signature_line_2 TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

ALTER TABLE public.email_template_copy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read template copy"
  ON public.email_template_copy FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update template copy"
  ON public.email_template_copy FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins insert template copy"
  ON public.email_template_copy FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_email_template_copy_updated_at
  BEFORE UPDATE ON public.email_template_copy
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.email_template_copy (
  template_name, subject, eyebrow, headline, body_paragraphs, cta_label, signature_line_1, signature_line_2
) VALUES (
  'client-intake-invite',
  'Your GEO workspace is live. Open the intake.',
  'THE INNER CIRQL · GEO',
  'Welcome, {name}.',
  ARRAY[
    'Your GEO workspace is set up. The next step is a short intake. Five steps. About ten minutes. It tells GEO who you are, where you work, and what you sell.',
    'Once you finish, your site goes into production and posts begin publishing on your schedule.'
  ],
  'Open the intake',
  'The GEO team',
  'The Inner Cirql'
);
