INSERT INTO public.email_template_copy (
  template_name, subject, eyebrow, headline, body_paragraphs, cta_label, signature_line_1, signature_line_2
) VALUES (
  'weekly-client-digest',
  'Your Inner Cirql GEO report – week of {weekOf}',
  'WEEKLY GEO REPORT',
  'Your Inner Cirql GEO report',
  '{}',
  'Open your dashboard',
  '— Blake & Tyler',
  ''
)
ON CONFLICT (template_name) DO NOTHING;