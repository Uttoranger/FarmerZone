import * as React from 'react'
import { Text } from '@react-email/components'
import { EmailLayout, bodyText, h1 } from './_layout'

export interface BescheidProps {
  /** Die Antwort des Teams auf den Wunsch — Text aus dem Admin, steht nur als Text-Kind da (React escaped ihn). */
  antwort: string
}

/** Überschrift der Bescheid-Mail (Board s3/w3-mail-neuigkeiten Bild 4). */
export const BESCHEID_TITEL = 'Danke für deinen Wunsch'

/**
 * Bescheid an eine Kundin, die einen Wunsch gemeldet hat (Register N14,
 * Nr. 105): dieselbe Karte wie jede Mail, darin die Antwort des Teams. Kein
 * Knopf, keine Werbung; der Fuß nennt das Team als Absender (wie das Postfach).
 */
export function BescheidEmail({ antwort }: BescheidProps): React.JSX.Element {
  const absaetze = antwort.split(/\r?\n\s*\n/).map((a) => a.trim()).filter(Boolean)
  return (
    <EmailLayout fuss={{ art: 'postfach' }} previewText={absaetze[0] ?? BESCHEID_TITEL}>
      <Text style={h1}>{BESCHEID_TITEL}</Text>
      {absaetze.map((absatz, i) => (
        <Text key={i} style={{ ...bodyText, whiteSpace: 'pre-wrap' }}>
          {absatz}
        </Text>
      ))}
    </EmailLayout>
  )
}
