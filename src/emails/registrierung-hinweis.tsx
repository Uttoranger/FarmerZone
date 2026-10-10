import * as React from 'react'
import { Text } from '@react-email/components'
import { EmailLayout, h1, bodyText, mutedText, Knopf, KnopfReihe } from './_layout'

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
export function RegistrierungHinweisEmail({ weg, anmelden, passwortZuruecksetzen }: RegistrierungHinweisProps) {
  return (
    <EmailLayout previewText="Zu deiner E-Mail-Adresse gibt es schon ein Konto bei FarmerZone">
      <Text style={h1}>Zu deiner Adresse gibt es schon ein Konto</Text>
      <Text style={bodyText}>
        Hallo,
        <br />
        jemand wollte sich mit deiner E-Mail-Adresse bei FarmerZone registrieren. Zu dieser Adresse gibt es aber schon
        ein Konto.
      </Text>
      {weg === 'passwort' ? (
        <Text style={bodyText}>Warst du das? Dann melde dich an. Hast du dein Passwort vergessen, setze es zurück.</Text>
      ) : (
        <Text style={bodyText}>
          Warst du das? Dann melde dich an – wir schicken dir dafür einen Code an diese Adresse.
        </Text>
      )}

      <KnopfReihe>
        <Knopf href={anmelden}>Anmelden</Knopf>
        {passwortZuruecksetzen && (
          <Knopf href={passwortZuruecksetzen} art="rahmen">
            Passwort zurücksetzen
          </Knopf>
        )}
      </KnopfReihe>

      <Text style={mutedText}>
        Warst du es nicht, kannst du diese E-Mail ignorieren. An deinem Konto hat sich nichts geändert.
      </Text>
    </EmailLayout>
  )
}
