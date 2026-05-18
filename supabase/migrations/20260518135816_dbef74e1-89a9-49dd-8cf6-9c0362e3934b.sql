UPDATE public.email_template_copy
SET signature_line_1 = 'Blake and Tyler',
    signature_line_2 = 'The Inner Cirql',
    updated_at = now()
WHERE template_name IN ('client-intake-invite', 'weekly-client-digest');