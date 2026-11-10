import * as React from 'react'
import { Text } from '@react-email/components'
import { EmailLayout, Knopf, KnopfReihe, h1, bodyText } from './_layout'

export interface PlattformgebuehrAnkuendigungProps {
  /** Der Satz aus `ankuendigungText` (src/lib/konditionen.ts) — dieselben Worte wie im Postfach. */
  text: string
  datum: string
  /** Vollständige Adresse von „Lastschrift einrichten“ (mit Ursprung). */
  lastschriftUrl: string
  knopf: string
}

/** Vier Wochen vor dem Einzugsbeginn (Register N38, Nr. 198): ab wann, Satz, Mandat nötig ja/nein. */
export function PlattformgebuehrAnkuendigungEmail({ text, datum, lastschriftUrl, knopf }: PlattformgebuehrAnkuendigungProps) {
  return (
    <EmailLayout fuss={{ art: 'plattform' }} previewText={`Plattformgebühr ab ${datum}`}>
      <Text style={h1}>Plattformgebühr ab {datum}</Text>
      <Text style={bodyText}>{text}</Text>
      <KnopfReihe>
        <Knopf href={lastschriftUrl}>{knopf}</Knopf>
      </KnopfReihe>
    </EmailLayout>
  )
}
