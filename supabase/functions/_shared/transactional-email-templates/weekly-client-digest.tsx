import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface DigestPost {
  title: string
  slug: string
}

interface WeeklyDigestProps {
  firstName?: string
  weekOf?: string
  posts?: DigestPost[]
  siteUrl?: string // hostname, no protocol
  visibilityScore?: number | null
  pendingNapItems?: string[]
  portalUrl?: string
  // DB-editable copy (with hardcoded fallbacks)
  eyebrow?: string
  headline?: string
  cta_label?: string
  signature_line_1?: string
  signature_line_2?: string
}

const DEFAULTS = {
  eyebrow: 'WEEKLY GEO REPORT',
  headline: 'Your Inner Cirql GEO report',
  cta_label: 'Open your dashboard',
  signature_line_1: 'Blake and Tyler',
  signature_line_2: 'The Inner Cirql',
}

const WeeklyClientDigestEmail = (props: WeeklyDigestProps) => {
  const eyebrow = props.eyebrow ?? DEFAULTS.eyebrow
  const headline = props.headline ?? DEFAULTS.headline
  const ctaLabel = props.cta_label ?? DEFAULTS.cta_label
  const sig1 = props.signature_line_1 ?? DEFAULTS.signature_line_1
  const sig2 = props.signature_line_2 ?? DEFAULTS.signature_line_2

  const weekOf = props.weekOf ?? ''
  const posts = props.posts ?? []
  const siteUrl = props.siteUrl ?? ''
  const visibilityScore =
    typeof props.visibilityScore === 'number' ? props.visibilityScore : null
  const pendingNapItems = props.pendingNapItems ?? []
  const portalUrl = props.portalUrl ?? 'https://www.geoemployee.com/dashboard'

  const greeting = props.firstName ? `Hi ${props.firstName},` : 'Hi,'
  const postCount = posts.length

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>
        {postCount > 0
          ? `${postCount} ${postCount === 1 ? 'post' : 'posts'} published this week.`
          : 'Your weekly GEO report.'}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={dotsRow}>
            <Text style={dots}>● ● ● ● ● ● ● ● ● ●</Text>
          </Section>

          <Text style={eyebrowStyle}>{eyebrow}</Text>
          <Heading style={h1}>{headline}</Heading>
          {weekOf && <Text style={subHead}>Week of {weekOf}</Text>}

          <Text style={text}>{greeting}</Text>

          {/* Published this week */}
          <Section style={section}>
            <Text style={sectionLabel}>PUBLISHED THIS WEEK</Text>
            {postCount === 0 ? (
              <Text style={text}>No posts published this week.</Text>
            ) : (
              <>
                <Text style={text}>
                  {postCount} {postCount === 1 ? 'post' : 'posts'} live on your site:
                </Text>
                {posts.map((p, i) => {
                  const href = siteUrl ? `https://${siteUrl}/blog/${p.slug}` : `#`
                  return (
                    <Text key={i} style={listItem}>
                      <Link href={href} style={linkStyle}>
                        {p.title}
                      </Link>
                    </Text>
                  )
                })}
              </>
            )}
          </Section>

          {/* AI Visibility score */}
          {visibilityScore !== null && (
            <Section style={section}>
              <Text style={sectionLabel}>AI VISIBILITY SCORE</Text>
              <Text style={scoreLine}>
                <span style={scoreNumber}>{visibilityScore}</span>
                <span style={scoreSuffix}>/100</span>
              </Text>
            </Section>
          )}

          {/* Action items */}
          {pendingNapItems.length > 0 && (
            <Section style={section}>
              <Text style={sectionLabel}>ACTION ITEMS</Text>
              <Text style={text}>
                A few profile items still need attention. Completing these strengthens your
                AI visibility score.
              </Text>
              {pendingNapItems.map((label, i) => (
                <Text key={i} style={listItem}>
                  • {label}
                </Text>
              ))}
            </Section>
          )}

          {/* CTA */}
          <Section style={ctaWrap}>
            <Button href={portalUrl} style={ctaButton}>
              {ctaLabel}
            </Button>
          </Section>

          <Section style={hr} />

          <Text style={signature}>
            {sig1}
            {sig2 && (
              <>
                <br />
                <span style={signatureMuted}>{sig2}</span>
              </>
            )}
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: WeeklyClientDigestEmail,
  subject: (data: Record<string, any>) =>
    data?.subject ??
    `Your Inner Cirql GEO report – week of ${data?.weekOf ?? 'this week'}`,
  displayName: 'Weekly client digest',
  previewData: {
    firstName: 'Tyler',
    weekOf: 'May 11, 2026',
    posts: [
      { title: 'What are the best neighborhoods in Austin for first-time buyers?', slug: 'best-neighborhoods-austin-first-time-buyers' },
      { title: 'How much does a home inspection cost in Travis County?', slug: 'home-inspection-cost-travis-county' },
    ],
    siteUrl: 'tylerlewis.mygeosite.com',
    visibilityScore: 78,
    pendingNapItems: ['Bing Places claimed', 'Zillow profile matches NAP'],
    portalUrl: 'https://www.geoemployee.com/dashboard',
  },
} satisfies TemplateEntry

// Inner Cirql brand
const ink = '#1a1a1a'
const inkMuted = '#1a1a1a99'
const inkSoft = '#1a1a1a66'
const gold = '#c9a96e'
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
  margin: '0 0 16px',
  fontWeight: 500,
}

const h1: React.CSSProperties = {
  fontFamily: '"Cormorant Garamond", Georgia, serif',
  fontSize: '32px',
  fontWeight: 400,
  color: ink,
  lineHeight: 1.2,
  margin: '0 0 8px',
  letterSpacing: '-0.5px',
}

const subHead: React.CSSProperties = {
  fontSize: '13px',
  color: inkMuted,
  margin: '0 0 32px',
}

const text: React.CSSProperties = {
  fontSize: '15px',
  color: ink,
  lineHeight: 1.75,
  margin: '0 0 12px',
}

const section: React.CSSProperties = {
  margin: '24px 0',
  paddingTop: '24px',
  borderTop: `1px solid ${hairline}`,
}

const sectionLabel: React.CSSProperties = {
  fontSize: '10px',
  letterSpacing: '2px',
  color: inkSoft,
  textTransform: 'uppercase',
  margin: '0 0 12px',
  fontWeight: 600,
}

const listItem: React.CSSProperties = {
  fontSize: '14px',
  color: ink,
  lineHeight: 1.6,
  margin: '0 0 8px',
}

const scoreLine: React.CSSProperties = {
  margin: '0',
  lineHeight: 1,
}

const scoreNumber: React.CSSProperties = {
  fontFamily: '"Cormorant Garamond", Georgia, serif',
  fontSize: '56px',
  fontWeight: 400,
  color: gold,
  letterSpacing: '-1px',
}

const scoreSuffix: React.CSSProperties = {
  fontSize: '16px',
  color: inkMuted,
  marginLeft: '4px',
}

const linkStyle: React.CSSProperties = {
  color: ink,
  textDecoration: 'underline',
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
