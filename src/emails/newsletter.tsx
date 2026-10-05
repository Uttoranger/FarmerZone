import * as React from 'react'
import { Text, Link, Hr } from '@react-email/components'
import { EmailLayout, h1, bodyText, mutedText, ctaButton, textLink, MAIL_FARBE } from './_layout'

export interface NewsletterEmailProps {
  farmName: string
  farmSlug: string
  title: string
  body: string
  ctaLabel?: string
  ctaUrl?: string
  unsubscribeUrl: string
  appUrl?: string
}

export function NewsletterEmail({
  farmName,
  farmSlug,
  title,
  body,
  ctaLabel,
  ctaUrl,
  unsubscribeUrl,
  appUrl = 'https://farmerzone.at',
}: NewsletterEmailProps) {
  const shopUrl = `${appUrl}/${farmSlug}`

  return (
    <EmailLayout previewText={`${farmName}: ${title}`}>
      <Text style={{ ...mutedText, margin: '0 0 4px' }}>{farmName}</Text>
      <Text style={h1}>{title}</Text>

      <Text style={bodyText}>{body}</Text>

      {ctaLabel && ctaUrl && (
        <div style={{ textAlign: 'center' as const, margin: '24px 0' }}>
          <Link href={ctaUrl} style={ctaButton}>
            {ctaLabel}
          </Link>
        </div>
      )}

      <Hr style={{ borderColor: MAIL_FARBE.rand, margin: '24px 0' }} />

      <div style={{ textAlign: 'center' as const }}>
        <Link href={shopUrl} style={{ ...textLink, fontSize: '13px' }}>
          Zum Hof-Shop →
        </Link>
      </div>

      <Text style={{ ...mutedText, textAlign: 'center' as const, marginTop: '16px', fontSize: '11px' }}>
        Du erhältst diese Nachricht, weil du den Newsletter von {farmName} abonniert hast.{' '}
        <Link href={unsubscribeUrl} style={{ color: MAIL_FARBE.textLeise }}>
          Abmelden
        </Link>
      </Text>
    </EmailLayout>
  )
}
