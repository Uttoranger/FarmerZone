import * as React from 'react'
import { Text } from '@react-email/components'
import { EmailLayout, Knopf, KnopfReihe, h1, bodyText } from './_layout'

export interface OnlineZahlungProps {
  /** Die Überschrift = der Betreff (onlineZahlungNachricht, src/lib/stripe-konto.ts). */
  betreff: string
  /** Derselbe Text wie die Postfach-Nachricht (onlineZahlungNachricht). */
  text: string
  /** Vollständige Adresse der Zahlungs-Einstellungen (mit Ursprung). */
  zahlungUrl: string
  /** „Zahlung ansehen“ (ZAHLUNG_ANSEHEN). */
  knopf: string
}

/**
 * Das Stripe-Konto des Hofs hat sich geändert (Register N49, A012): Die
 * Online-Zahlung ist aktiv bzw. Stripe braucht nach der Prüfung noch Angaben.
 * Texte nur aus src/lib/stripe-konto.ts — dieselben Worte wie im Postfach.
 */
export function OnlineZahlungEmail({ betreff, text, zahlungUrl, knopf }: OnlineZahlungProps) {
  return (
    <EmailLayout fuss={{ art: 'plattform' }} previewText={betreff}>
      <Text style={h1}>{betreff}</Text>
      <Text style={bodyText}>{text}</Text>
      <KnopfReihe>
        <Knopf href={zahlungUrl}>{knopf}</Knopf>
      </KnopfReihe>
    </EmailLayout>
  )
}
