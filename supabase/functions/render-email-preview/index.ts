import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Admin-only preview renderer. Accepts arbitrary template props (copy overrides)
// and returns rendered HTML so the admin email editor can show a live preview
// without enqueuing an actual email.

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const authHeader = req.headers.get('Authorization') ?? ''

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return json({ error: 'unauthorized' }, 401)

  const { data: roles } = await userClient.from('user_roles').select('role').eq('user_id', user.id)
  if (!roles?.some((r: any) => r.role === 'admin')) return json({ error: 'forbidden' }, 403)

  let templateName: string, props: Record<string, any>
  try {
    const body = await req.json()
    templateName = body.templateName
    props = body.props ?? {}
  } catch {
    return json({ error: 'invalid json' }, 400)
  }

  const entry = TEMPLATES[templateName]
  if (!entry) return json({ error: `template '${templateName}' not found` }, 404)

  try {
    const merged = { ...(entry.previewData ?? {}), ...props }
    const html = await renderAsync(React.createElement(entry.component, merged))
    const subject =
      props.subject ??
      (typeof entry.subject === 'function' ? entry.subject(merged) : entry.subject)
    return json({ html, subject })
  } catch (e: any) {
    return json({ error: e?.message ?? String(e) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
