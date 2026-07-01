import * as React from 'react'
import { Text, Link, Img } from '@react-email/components'
import { EmailLayout, h1, bodyText, ctaButton } from './_layout'

const ANLASS_LABEL: Record<string, string> = {
  FRESH_PRODUCT: '🥬 Frisches Produkt',
  NEW_SEASON: '🌱 Neue Saison',
  PROMOTION: '🏷️ Aktion',
  ANNOUNCEMENT: '📢 Mitteilung',
}

const ANLASS_COLOR: Record<string, string> = {
  FRESH_PRODUCT: '#2D5F3F',
  NEW_SEASON: '#059669',
  PROMOTION: '#D97706',
  ANNOUNCEMENT: '#2563EB',
}

interface StatusUpdateEmailProps {
  farmName: string
  farmSlug: string
  title: string
  body: string
  anlass: string
  photoUrl?: string
  unsubscribeUrl: string
  appUrl?: string
}

export function StatusUpdateEmail({
  farmName,
  farmSlug,
  title,
  body,
  anlass,
  photoUrl,
  unsubscribeUrl,
  appUrl = 'https://farmerzone.at',
}: StatusUpdateEmailProps) {
  const farmUrl = `${appUrl}/${farmSlug}`
  const anlassLabel = ANLASS_LABEL[anlass] ?? '📢 Mitteilung'
  const anlassColor = ANLASS_COLOR[anlass] ?? '#374151'

  return (
    <EmailLayout
      previewText={`${farmName}: ${title}`}
      manageUrl={unsubscribeUrl}
    >
      {/* Anlass badge */}
      <div
        style={{
          display: 'inline-block',
          backgroundColor: anlassColor + '18',
          color: anlassColor,
          borderRadius: '100px',
          padding: '4px 12px',
          fontSize: '12px',
          fontWeight: '600',
          marginBottom: '16px',
        }}
      >
        {anlassLabel}
      </div>

      {/* Farm name */}
      <Text style={{ ...bodyText, color: '#5C6F65', marginBottom: '4px' }}>
        Neuigkeit von {farmName}
      </Text>

      {/* Title */}
      <Text style={h1}>{title}</Text>

      {/* Photo */}
      {photoUrl && (
        <Img
          src={photoUrl}
          alt={title}
          style={{ width: '100%', borderRadius: '12px', margin: '16px 0', objectFit: 'cover' }}
        />
      )}

      {/* Body */}
      {body.split('\n').map((line, i) => (
        <Text key={i} style={{ ...bodyText, marginBottom: line ? '8px' : '4px' }}>
          {line || ' '}
        </Text>
      ))}

      {/* CTA */}
      <div style={{ textAlign: 'center', margin: '24px 0 8px' }}>
        <Link href={farmUrl} style={ctaButton}>
          Mehr ansehen beim {farmName}
        </Link>
      </div>

      {/* Unsubscribe */}
      <Text style={{ color: '#9CA3AF', fontSize: '11px', textAlign: 'center', marginTop: '16px' }}>
        Du erhältst diese E-Mail, weil du E-Mail-Updates für {farmName} aktiviert hast.{' '}
        <Link href={unsubscribeUrl} style={{ color: '#9CA3AF' }}>
          Abmelden
        </Link>
      </Text>
    </EmailLayout>
  )
}
