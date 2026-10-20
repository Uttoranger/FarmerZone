import * as React from 'react'
import { Text, Link } from '@react-email/components'
import { EmailLayout, h1, bodyText, mutedText, ctaButton } from './_layout'
import { MARKE } from '@/lib/marke'
import { PASSWORT_LINK_DAUER_TEXT } from '@/lib/anmeldecode'

export interface PasswordResetProps {
  resetUrl: string
}

export function PasswordResetEmail({ resetUrl }: PasswordResetProps) {
  return (
    <EmailLayout previewText={`Passwort zurücksetzen — Link gültig ${PASSWORT_LINK_DAUER_TEXT}`}>
      <Text style={h1}>Passwort zurücksetzen</Text>
      <Text style={bodyText}>
        Hallo,
        <br />
        {`du möchtest das Passwort für dein ${MARKE}-Konto zurücksetzen. Klicke auf den Button unten und wähle ein neues Passwort.`}
      </Text>

      <div style={{ textAlign: 'center' as const, margin: '28px 0' }}>
        <Link href={resetUrl} style={ctaButton}>
          Neues Passwort wählen
        </Link>
      </div>

      <Text style={{ ...mutedText, margin: '0 0 6px' }}>
        Dieser Link ist <strong>{PASSWORT_LINK_DAUER_TEXT}</strong> gültig und kann nur einmal verwendet werden.
      </Text>
      <Text style={mutedText}>
        Falls du das nicht angefordert hast, ignoriere diese E-Mail. Dein Passwort bleibt
        unverändert.
      </Text>
    </EmailLayout>
  )
}
