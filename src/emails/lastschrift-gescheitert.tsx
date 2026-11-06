import * as React from 'react'
import { Text } from '@react-email/components'
import { EmailLayout, Knopf, KnopfReihe, h1, bodyText } from './_layout'

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
    <EmailLayout fuss={{ art: 'plattform' }} previewText={`Lastschrift für ${monat} hat nicht geklappt`}>
      <Text style={h1}>Lastschrift hat nicht geklappt</Text>
      <Text style={bodyText}>{text}</Text>
      <KnopfReihe>
        <Knopf href={konditionenUrl}>Zu deinen Konditionen</Knopf>
      </KnopfReihe>
    </EmailLayout>
  )
}
