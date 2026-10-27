import * as React from 'react'
import { Link, Text } from '@react-email/components'
import { EmailLayout, h1, bodyText, ctaButton } from './_layout'

export interface LastschriftGescheitertProps {
  /** Der Satz aus `lastschriftGescheitertText` (src/lib/konditionen.ts) — dieselben Worte wie im Postfach. */
  text: string
  monat: string
  /** Vollständige Adresse von „Deine Konditionen“ (mit Ursprung). */
  konditionenUrl: string
}

/** Die Lastschrift der Monatsabrechnung ist gescheitert (Register N38, Nr. 198). */
export function LastschriftGescheitertEmail({ text, monat, konditionenUrl }: LastschriftGescheitertProps) {
  return (
    <EmailLayout previewText={`Lastschrift für ${monat} hat nicht geklappt`}>
      <Text style={h1}>Lastschrift für {monat} hat nicht geklappt</Text>
      <Text style={bodyText}>{text}</Text>
      <Link href={konditionenUrl} style={ctaButton}>
        Zu deinen Konditionen
      </Link>
    </EmailLayout>
  )
}
