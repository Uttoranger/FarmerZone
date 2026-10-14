import * as React from 'react'
import { Link, Text } from '@react-email/components'
import { POSTFACH_MAIL_TEXT } from '@/lib/postfach'
import { EmailLayout, bodyText, ctaButton, h1, highlightBox, highlightValue, mutedText, textLink } from './_layout'

export interface PostfachAntwortProps {
  /** Titel des Fadens (des Rundschreibens), auf den das Team antwortet. */
  titel: string
  text: string
  linkUrl: string | null
  fadenUrl: string
}

/**
 * Eine Antwort des Teams im Faden per E-Mail (Register N12, Nr. 87) — nur mit
 * dem Haken „Betriebsmitteilung" und höchstens eine je Faden und Stunde
 * (Unterhaltung.letzteMailAm). Der Text der Antwort steht in der Mail, dazu
 * der Link und der Weg in den Faden; geantwortet wird in der App.
 */
export function PostfachAntwortEmail(p: PostfachAntwortProps): React.JSX.Element {
  return (
    <EmailLayout previewText={POSTFACH_MAIL_TEXT.antwortBetreff(p.titel)} fusszeile={POSTFACH_MAIL_TEXT.fuss}>
      <Text style={h1}>{POSTFACH_MAIL_TEXT.antwortTitel}</Text>
      <Text style={mutedText}>{`${POSTFACH_MAIL_TEXT.zu}: ${p.titel}`}</Text>
      <div style={highlightBox}>
        <Text style={{ ...highlightValue, whiteSpace: 'pre-wrap' }}>{p.text}</Text>
      </div>
      {p.linkUrl && (
        <Text style={bodyText}>
          <Link href={p.linkUrl} style={textLink}>
            {POSTFACH_MAIL_TEXT.link}
          </Link>
        </Text>
      )}
      <Link href={p.fadenUrl} style={ctaButton}>
        {POSTFACH_MAIL_TEXT.oeffnen}
      </Link>
      <Text style={mutedText}>{POSTFACH_MAIL_TEXT.antwortenInDerApp}</Text>
      <Text style={mutedText}>{POSTFACH_MAIL_TEXT.gruss}</Text>
    </EmailLayout>
  )
}
