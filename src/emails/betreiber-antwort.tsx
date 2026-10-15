import * as React from 'react'
import { Link, Text } from '@react-email/components'
import { ZUSTELLUNG_MAIL_TEXT } from '@/lib/zustellung'
import { EmailLayout, ctaButton, h1, highlightBox, highlightValue, mutedText } from './_layout'

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
 * (Regel „Antwort eines Hofs: sofort", Register N14, Nr. 95). Hofname und
 * Antwort sind Fremdtext: Sie stehen nur als Text da (React escaped sie), und
 * die Mail geht nur an bestätigte Adressen.
 */
export function BetreiberAntwortEmail(p: BetreiberAntwortProps): React.JSX.Element {
  return (
    <EmailLayout previewText={ZUSTELLUNG_MAIL_TEXT.antwortBetreff(p.hofName, p.titel)} fusszeile={ZUSTELLUNG_MAIL_TEXT.fuss}>
      <Text style={h1}>{ZUSTELLUNG_MAIL_TEXT.antwortTitel}</Text>
      <Text style={mutedText}>{`${p.hofName} · ${ZUSTELLUNG_MAIL_TEXT.antwortZu}: ${p.titel}`}</Text>
      <div style={highlightBox}>
        <Text style={{ ...highlightValue, whiteSpace: 'pre-wrap' }}>{p.text}</Text>
      </div>
      <Link href={p.url} style={ctaButton}>
        {ZUSTELLUNG_MAIL_TEXT.antwortOeffnen}
      </Link>
    </EmailLayout>
  )
}
