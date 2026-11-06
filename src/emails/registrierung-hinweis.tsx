import * as React from 'react'
import { Text } from '@react-email/components'
import { EmailLayout, h1, bodyText, leiseZeile, Knopf, KnopfReihe } from './_layout'
import { MARKE } from '@/lib/marke'

export interface RegistrierungHinweisProps {
  /** Wie sich das Konto anmeldet — Höfe mit Passwort, Kundinnen mit Code. */
  weg: 'passwort' | 'code'
  /** Vollständige Adresse der passenden Anmeldeseite. */
  anmelden: string
  /** Nur beim Passwort-Weg: Adresse von „Passwort vergessen". */
  passwortZuruecksetzen: string | null
}

/**
 * „Jemand wollte sich mit deiner Adresse registrieren" an ein bestehendes
 * Konto (Register F6 „19b", Nachtlauf Nr. 27). Die Registrierung selbst
 * antwortet bei einer vergebenen Adresse wie bei Erfolg — nur hier erfährt
 * die echte Person, dass es ihr Konto schon gibt. Hell wie alle Mails, ohne
 * Emojis, Palette aus _layout.tsx; keine Werbung.
 */
export function RegistrierungHinweisEmail({ weg, anmelden }: RegistrierungHinweisProps) {
  return (
    <EmailLayout fuss={{ art: 'plattform' }} previewText={`Zu deiner Adresse gibt es schon ein Konto bei ${MARKE}.`}>
      <Text style={h1}>Zu deiner Adresse gibt es schon ein Konto</Text>
      {/* Board s3/w3-mail-sicherheit Bild 6: ein Knopf; „Passwort vergessen“ steht auf der Anmeldeseite. */}
      <Text style={bodyText}>
        {weg === 'passwort'
          ? 'Gerade wollte sich jemand mit dieser Adresse neu registrieren. Warst du das? Dann melde dich einfach an.'
          : 'Gerade wollte sich jemand mit dieser Adresse neu registrieren. Warst du das? Dann melde dich einfach an – wir schicken dir dafür einen Code an diese Adresse.'}
      </Text>

      <KnopfReihe>
        <Knopf href={anmelden}>Anmelden</Knopf>
      </KnopfReihe>

      <Text style={leiseZeile}>Warst du das nicht? Dann musst du nichts tun.</Text>
    </EmailLayout>
  )
}
