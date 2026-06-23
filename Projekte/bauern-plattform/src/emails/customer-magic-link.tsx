import * as React from 'react'
import { Text, Link } from '@react-email/components'
import { EmailLayout, h1, bodyText, mutedText, ctaButton } from './_layout'

export interface CustomerMagicLinkProps {
  firstName?: string
  magicUrl: string
}

export function CustomerMagicLinkEmail({ firstName, magicUrl }: CustomerMagicLinkProps) {
  const greeting = firstName ? `Hallo ${firstName},` : 'Hallo,'

  return (
    <EmailLayout previewText="Dein Login-Link für FarmerZone — gültig 15 Minuten">
      <Text style={h1}>Dein Login-Link 🔐</Text>
      <Text style={bodyText}>
        {greeting}
        <br />
        klicke auf den Button unten, um dich in deinem FarmerZone-Konto einzuloggen und deine
        Benachrichtigungen zu verwalten.
      </Text>

      <div style={{ textAlign: 'center' as const, margin: '28px 0' }}>
        <Link href={magicUrl} style={ctaButton}>
          Jetzt einloggen
        </Link>
      </div>

      <Text style={{ ...mutedText, margin: '0 0 6px' }}>
        ⏱ Dieser Link ist <strong>15 Minuten</strong> gültig und kann nur einmal verwendet werden.
      </Text>
      <Text style={mutedText}>
        Falls du keinen Login angefragt hast, kannst du diese E-Mail einfach ignorieren — dein
        Konto bleibt unverändert.
      </Text>
    </EmailLayout>
  )
}
