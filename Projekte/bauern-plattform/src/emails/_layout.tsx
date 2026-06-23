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
  backgroundColor: '#FAFAF7',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
  margin: 0,
  padding: '32px 0',
}

const container: React.CSSProperties = {
  maxWidth: '600px',
  margin: '0 auto',
}

const header: React.CSSProperties = {
  backgroundColor: '#2D5F3F',
  borderRadius: '20px 20px 0 0',
  padding: '24px 28px',
}

const logoMark: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '10px',
}

const logoText: React.CSSProperties = {
  color: '#ffffff',
  fontSize: '18px',
  fontWeight: '700',
  margin: 0,
  lineHeight: '1',
  letterSpacing: '-0.02em',
}

const logoSub: React.CSSProperties = {
  color: 'rgba(255,255,255,0.6)',
  fontSize: '11px',
  fontWeight: '500',
  margin: '3px 0 0',
  letterSpacing: '0.06em',
  textTransform: 'uppercase' as const,
}

const content: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '0 0 20px 20px',
  padding: '32px 28px',
}

const footerWrapper: React.CSSProperties = {
  textAlign: 'center' as const,
  marginTop: '24px',
  padding: '0 24px',
}

const footerPill: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: '#E8F0E8',
  borderRadius: '100px',
  padding: '6px 16px',
  color: '#5C6F65',
  fontSize: '11px',
  marginBottom: '12px',
}

const footerText: React.CSSProperties = {
  color: '#5C6F65',
  fontSize: '12px',
  margin: '0',
  lineHeight: '1.5',
}

interface EmailLayoutProps {
  previewText: string
  children: React.ReactNode
  manageUrl?: string
}

export function EmailLayout({ previewText, children, manageUrl }: EmailLayoutProps) {
  return (
    <Html lang="de">
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <div style={logoMark}>
              <div>
                <Text style={logoText}>🌱 FarmerZone</Text>
                <Text style={logoSub}>Regionale Lebensmittel</Text>
              </div>
            </div>
          </Section>
          <Section style={content}>{children}</Section>
          <Hr style={{ borderColor: '#E8E5DC', margin: '0 24px' }} />
          <div style={footerWrapper}>
            <div style={footerPill}>Versandt von FarmerZone</div>
            <Text style={footerText}>
              Diese E-Mail wurde im Auftrag eines Hofes versendet.
            </Text>
            {manageUrl && (
              <Text style={{ ...footerText, marginTop: '6px' }}>
                <a href={manageUrl} style={{ color: '#5C6F65' }}>
                  Benachrichtigungen verwalten
                </a>
              </Text>
            )}
          </div>
        </Container>
      </Body>
    </Html>
  )
}

// Shared style helpers
export const h1: React.CSSProperties = {
  color: '#1A2B22',
  fontSize: '22px',
  fontWeight: '700',
  margin: '0 0 10px',
  lineHeight: '1.3',
}

export const bodyText: React.CSSProperties = {
  color: '#374151',
  fontSize: '15px',
  lineHeight: '1.65',
  margin: '0 0 16px',
}

export const mutedText: React.CSSProperties = {
  color: '#5C6F65',
  fontSize: '13px',
  lineHeight: '1.5',
  margin: '0 0 4px',
}

export const highlightBox: React.CSSProperties = {
  backgroundColor: '#E8F0E8',
  border: '1px solid #C4D9C8',
  borderRadius: '12px',
  padding: '18px 22px',
  margin: '20px 0',
}

export const highlightLabel: React.CSSProperties = {
  color: '#2D5F3F',
  fontSize: '11px',
  fontWeight: '600',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  margin: '0 0 6px',
}

export const highlightValue: React.CSSProperties = {
  color: '#1A2B22',
  fontSize: '17px',
  fontWeight: '600',
  margin: '0 0 4px',
  lineHeight: '1.3',
}

export const tableRow: React.CSSProperties = {
  borderBottom: '1px solid #E8E5DC',
  padding: '8px 0',
}

export const totalRow: React.CSSProperties = {
  borderTop: '2px solid #E8E5DC',
  paddingTop: '12px',
  marginTop: '4px',
}

export const ctaButton: React.CSSProperties = {
  backgroundColor: '#2D5F3F',
  borderRadius: '12px',
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
  backgroundColor: '#FFFBEB',
  border: '1px solid #FDE68A',
  borderRadius: '12px',
  padding: '16px 20px',
  margin: '20px 0',
}
