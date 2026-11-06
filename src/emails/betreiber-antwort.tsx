import * as React from 'react'
import { Text } from '@react-email/components'
import { ZUSTELLUNG_MAIL_TEXT } from '@/lib/zustellung'
import { EmailLayout, Knopf, KnopfReihe, bodyText, h1, mutedText } from './_layout'

export interface BetreiberAntwortProps {
  hofName: string
  /** Titel des Fadens (des Rundschreibens), auf den der Hof antwortet. */
  titel: string
  text: string
  /** Der Faden im Eingang (Filter Antwort). */
  url: string
}

/**
 * Ein Hof hat im Faden geantwortet → die Empfängerliste der Zustellung
 * (Regel „Antwort eines Hofs: sofort", Register N14, Nr. 95; Board
 * s3/w3-mail-betrieb Bild 5). Hofname und Antwort sind Fremdtext: Sie stehen
 * nur als Text da (React escaped sie), und die Mail geht nur an bestätigte Adressen.
 */
export function BetreiberAntwortEmail(p: BetreiberAntwortProps): React.JSX.Element {
  return (
    <EmailLayout fuss={{ art: 'betrieb' }} previewText={ZUSTELLUNG_MAIL_TEXT.antwortBetreff(p.hofName, p.titel)}>
      <Text style={h1}>{ZUSTELLUNG_MAIL_TEXT.antwortTitel}</Text>
      <Text style={{ ...mutedText, margin: '0 0 6px' }}>{`${p.hofName} · ${ZUSTELLUNG_MAIL_TEXT.antwortZu.toLowerCase()} „${p.titel}“`}</Text>
      <Text style={{ ...bodyText, whiteSpace: 'pre-wrap' }}>{`„${p.text}“`}</Text>
      <KnopfReihe>
        <Knopf href={p.url}>{ZUSTELLUNG_MAIL_TEXT.antwortOeffnen}</Knopf>
      </KnopfReihe>
    </EmailLayout>
  )
}
