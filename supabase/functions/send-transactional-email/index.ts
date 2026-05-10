// Renders a registered React Email template and sends it via Resend
// through the Lovable connector gateway. No queue / pgmq dependency.
import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.ts'

const SITE_NAME = 'The Inner Cirql'
const FROM_DOMAIN = 'send.geoemployee.com' // verified Resend sender
const FROM_ADDRESS = `${SITE_NAME} <noreply@${FROM_DOMAIN}>`

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/resend'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const lovableKey = Deno.env.get('LOVABLE_API_KEY')
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!lovableKey) return json({ error: 'LOVABLE_API_KEY not configured' }, 500)
  if (!resendKey) return json({ error: 'RESEND_API_KEY not configured' }, 500)
  if (!supabaseUrl || !serviceKey) return json({ error: 'Server misconfigured' }, 500)

  let body: any
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON' }, 400) }

  const templateName: string = body.templateName || body.template_name
  const recipientEmail: string = body.recipientEmail || body.recipient_email
  const templateData: Record<string, any> =
    (body.templateData && typeof body.templateData === 'object') ? body.templateData : {}
  const messageId = crypto.randomUUID()

  if (!templateName) return json({ error: 'templateName is required' }, 400)
  const template = TEMPLATES[templateName]
  if (!template) {
    return json({
      error: `Template '${templateName}' not found. Available: ${Object.keys(TEMPLATES).join(', ')}`,
    }, 404)
  }
  const recipient = template.to || recipientEmail
  if (!recipient) return json({ error: 'recipientEmail is required' }, 400)

  // Render template
  let html: string, text: string, subject: string
  try {
    html = await renderAsync(React.createElement(template.component, templateData))
    text = await renderAsync(React.createElement(template.component, templateData), { plainText: true })
    subject = typeof template.subject === 'function' ? template.subject(templateData) : template.subject
  } catch (e: any) {
    console.error('Template render failed', { templateName, error: e?.message })
    return json({ error: `Template render failed: ${e?.message ?? String(e)}` }, 500)
  }

  // Best-effort log (table optional — ignore failures so they don't block sending)
  const supabase = createClient(supabaseUrl, serviceKey)
  const logAttempt = async (status: string, error_message: string | null = null, provider_id: string | null = null) => {
    try {
      await supabase.from('email_send_log').insert({
        message_id: messageId,
        template_name: templateName,
        recipient_email: recipient,
        status,
        error_message,
        provider_id,
      })
    } catch (_) { /* table may not exist yet — ignore */ }
  }

  await logAttempt('pending')

  // Send via Resend through gateway
  let providerStatus = 0
  let providerBody: any = null
  try {
    const resp = await fetch(`${GATEWAY_URL}/emails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${lovableKey}`,
        'X-Connection-Api-Key': resendKey,
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [recipient],
        subject,
        html,
        text,
      }),
    })
    providerStatus = resp.status
    providerBody = await resp.json().catch(() => ({}))
  } catch (e: any) {
    await logAttempt('failed', `network: ${e?.message ?? String(e)}`)
    return json({ error: `Send failed: ${e?.message ?? String(e)}` }, 500)
  }

  if (providerStatus < 200 || providerStatus >= 300) {
    const msg = `Resend ${providerStatus}: ${JSON.stringify(providerBody)}`
    console.error('Resend send failed', { templateName, recipient, msg })
    await logAttempt('failed', msg)
    return json({ error: msg }, 502)
  }

  const providerId = providerBody?.id ?? null
  await logAttempt('sent', null, providerId)
  console.log('Email sent via Resend', { templateName, recipient, providerId })
  return json({ success: true, sent: true, provider_id: providerId })
})
