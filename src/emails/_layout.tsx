import * as React from 'react'
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Hr,
  Preview,
} from '@react-email/components'

const body: React.CSSProperties = {
  backgroundColor: '#f8fafc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
  margin: 0,
  padding: '24px 0',
}

const container: React.CSSProperties = {
  maxWidth: '600px',
  margin: '0 auto',
}

const header: React.CSSProperties = {
  backgroundColor: '#15803d',
  borderRadius: '12px 12px 0 0',
  padding: '20px 24px',
}

const logoText: React.CSSProperties = {
  color: '#ffffff',
  fontSize: '20px',
  fontWeight: '700',
  margin: 0,
  lineHeight: '1',
}

const content: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '0 0 12px 12px',
  padding: '28px 24px',
}

const footer: React.CSSProperties = {
  color: '#94a3b8',
  fontSize: '12px',
  textAlign: 'center' as const,
  marginTop: '20px',
  padding: '0 24px',
}

interface EmailLayoutProps {
  previewText: string
  children: React.ReactNode
}

export function EmailLayout({ previewText, children }: EmailLayoutProps) {
  return (
    <Html lang="de">
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Text style={logoText}>🌱 FarmerZone</Text>
          </Section>
          <Section style={content}>{children}</Section>
          <Hr style={{ borderColor: '#e2e8f0', margin: '0 24px' }} />
          <Text style={footer}>
            Diese E-Mail wurde von FarmerZone im Auftrag des Hofes versendet.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

// Shared style helpers used across templates
export const h1: React.CSSProperties = {
  color: '#0f172a',
  fontSize: '22px',
  fontWeight: '700',
  margin: '0 0 8px',
  lineHeight: '1.3',
}

export const bodyText: React.CSSProperties = {
  color: '#334155',
  fontSize: '15px',
  lineHeight: '1.6',
  margin: '0 0 16px',
}

export const mutedText: React.CSSProperties = {
  color: '#64748b',
  fontSize: '13px',
  lineHeight: '1.5',
  margin: '0 0 4px',
}

export const highlightBox: React.CSSProperties = {
  backgroundColor: '#f0fdf4',
  border: '1px solid #bbf7d0',
  borderRadius: '10px',
  padding: '16px 20px',
  margin: '20px 0',
}

export const highlightLabel: React.CSSProperties = {
  color: '#15803d',
  fontSize: '11px',
  fontWeight: '600',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  margin: '0 0 6px',
}

export const highlightValue: React.CSSProperties = {
  color: '#0f172a',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0 0 4px',
  lineHeight: '1.3',
}

export const tableRow: React.CSSProperties = {
  borderBottom: '1px solid #f1f5f9',
  padding: '8px 0',
}

export const totalRow: React.CSSProperties = {
  borderTop: '2px solid #e2e8f0',
  paddingTop: '12px',
  marginTop: '4px',
}

export const ctaButton: React.CSSProperties = {
  backgroundColor: '#15803d',
  borderRadius: '8px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '15px',
  fontWeight: '600',
  padding: '14px 28px',
  textDecoration: 'none',
  textAlign: 'center' as const,
  margin: '20px 0',
}

export const amberBox: React.CSSProperties = {
  backgroundColor: '#fffbeb',
  border: '1px solid #fde68a',
  borderRadius: '10px',
  padding: '16px 20px',
  margin: '20px 0',
}
