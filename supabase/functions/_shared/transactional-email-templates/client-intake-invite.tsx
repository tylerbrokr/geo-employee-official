import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface IntakeInviteProps {
  name?: string
  magicLink?: string
  // Editable copy (DB-backed). All optional with hardcoded fallbacks
  // so the template still renders cleanly if the DB row is missing.
  eyebrow?: string
  headline?: string
  body_paragraphs?: string[]
  cta_label?: string
  signature_line_1?: string
  signature_line_2?: string
}

const DEFAULTS = {
  eyebrow: 'THE INNER CIRQL · GEO',
  headline: 'Welcome, {name}.',
  body_paragraphs: [
    'Your GEO workspace is set up. The next step is a short intake. Five steps. About ten minutes. It tells GEO who you are, where you work, and what you sell.',
    'Once you finish, your site goes into production and posts begin publishing on your schedule.',
  ],
  cta_label: 'Open the intake',
  signature_line_1: 'Blake and Tyler',
  signature_line_2: 'The Inner Cirql',
}

function fillName(text: string, name?: string) {
  if (!text) return text
  if (text.includes('{name}')) {
    return name ? text.replace(/\{name\}/g, name) : text.replace(/,?\s*\{name\}/g, '').replace(/\.{2,}/g, '.')
  }
  return text
}

const ClientIntakeInviteEmail = (props: IntakeInviteProps) => {
  const { name, magicLink } = props
  const eyebrow = props.eyebrow ?? DEFAULTS.eyebrow
  const headline = fillName(props.headline ?? DEFAULTS.headline, name)
  const paragraphs = props.body_paragraphs?.length ? props.body_paragraphs : DEFAULTS.body_paragraphs
  const ctaLabel = props.cta_label ?? DEFAULTS.cta_label
  const sig1 = props.signature_line_1 ?? DEFAULTS.signature_line_1
  const sig2 = props.signature_line_2 ?? DEFAULTS.signature_line_2
  const link = magicLink ?? '#'

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{paragraphs[0]?.slice(0, 120) ?? 'Your GEO workspace is live.'}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={dotsRow}>
            <Text style={dots}>● ● ● ● ● ● ● ● ● ●</Text>
          </Section>

          <Text style={eyebrowStyle}>{eyebrow}</Text>

          <Heading style={h1}>{headline}</Heading>

          {paragraphs.map((p, i) => (
            <Text key={i} style={text}>{fillName(p, name)}</Text>
          ))}

          <Section style={ctaWrap}>
            <Button href={link} style={ctaButton}>{ctaLabel}</Button>
          </Section>

          <Section style={hr} />

          <Text style={signature}>
            {sig1}
            <br />
            <span style={signatureMuted}>{sig2}</span>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: ClientIntakeInviteEmail,
  subject: (data: Record<string, any>) => data?.subject ?? 'Your GEO workspace is live. Open the intake.',
  displayName: 'Client intake invite',
  previewData: {
    name: 'Jane',
    magicLink: 'https://www.geoemployee.com/onboarding?token=preview',
  },
} satisfies TemplateEntry

// Inner Cirql brand: white canvas, ink text, gold accent, zero radius, hairline borders.
const ink = '#1a1a1a'
const inkMuted = '#1a1a1a99'
const gold = '#c9a96e'
const offWhite = '#faf8f4'
const hairline = '#1a1a1a14'

const main: React.CSSProperties = {
  backgroundColor: '#ffffff',
  fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  color: ink,
  margin: 0,
  padding: '40px 0',
}

const container: React.CSSProperties = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '40px 32px',
  backgroundColor: '#ffffff',
}

const dotsRow: React.CSSProperties = { textAlign: 'center', margin: '0 0 32px' }
const dots: React.CSSProperties = {
  color: gold,
  letterSpacing: '4px',
  fontSize: '8px',
  margin: 0,
  lineHeight: 1,
}

const eyebrowStyle: React.CSSProperties = {
  fontSize: '10px',
  letterSpacing: '2px',
  color: inkMuted,
  textTransform: 'uppercase',
  margin: '0 0 24px',
  fontWeight: 500,
}

const h1: React.CSSProperties = {
  fontFamily: '"Cormorant Garamond", Georgia, serif',
  fontSize: '32px',
  fontWeight: 400,
  color: ink,
  lineHeight: 1.2,
  margin: '0 0 24px',
  letterSpacing: '-0.5px',
}

const text: React.CSSProperties = {
  fontSize: '15px',
  color: ink,
  lineHeight: 1.75,
  margin: '0 0 16px',
}

const ctaWrap: React.CSSProperties = { margin: '32px 0' }

const ctaButton: React.CSSProperties = {
  backgroundColor: gold,
  color: ink,
  padding: '16px 36px',
  fontSize: '13px',
  fontWeight: 600,
  letterSpacing: '1px',
  textTransform: 'uppercase',
  textDecoration: 'none',
  display: 'inline-block',
  borderRadius: 0,
}

const fineprint: React.CSSProperties = {
  fontSize: '12px',
  color: inkMuted,
  lineHeight: 1.6,
  margin: '0 0 32px',
  padding: '16px',
  backgroundColor: offWhite,
  wordBreak: 'break-all',
}

const linkStyle: React.CSSProperties = {
  color: ink,
  textDecoration: 'underline',
}

const hr: React.CSSProperties = {
  borderTop: `1px solid ${hairline}`,
  margin: '32px 0 24px',
  height: 0,
}

const signature: React.CSSProperties = {
  fontSize: '13px',
  color: ink,
  lineHeight: 1.6,
  margin: 0,
  fontWeight: 600,
}

const signatureMuted: React.CSSProperties = {
  color: inkMuted,
  fontFamily: '"Cormorant Garamond", Georgia, serif',
  fontStyle: 'italic',
  fontSize: '14px',
}
