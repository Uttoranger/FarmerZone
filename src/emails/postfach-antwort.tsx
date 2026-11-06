import * as React from 'react'
import { Link, Text } from '@react-email/components'
import { POSTFACH_MAIL_TEXT } from '@/lib/postfach'
import { EmailLayout, Knopf, KnopfReihe, bodyText, h1, leiseZeile, mutedText, textLink } from './_layout'

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
    <EmailLayout fuss={{ art: 'postfach' }} previewText={POSTFACH_MAIL_TEXT.antwortBetreff(p.titel)}>
      <Text style={h1}>{POSTFACH_MAIL_TEXT.antwortTitel}</Text>
      <Text style={{ ...mutedText, margin: '0 0 6px' }}>{`${POSTFACH_MAIL_TEXT.zu}: ${p.titel}`}</Text>
      {/* Board s3/w3-mail-hof-konto Bild 5: die Antwort als Fließtext, ohne Kasten und ohne Gruß. */}
      <Text style={{ ...bodyText, whiteSpace: 'pre-wrap' }}>{p.text}</Text>
      {p.linkUrl && (
        <Text style={bodyText}>
          <Link href={p.linkUrl} style={textLink}>
            {POSTFACH_MAIL_TEXT.link}
          </Link>
        </Text>
      )}
      <KnopfReihe>
        <Knopf href={p.fadenUrl}>{POSTFACH_MAIL_TEXT.oeffnen}</Knopf>
      </KnopfReihe>
      <Text style={leiseZeile}>{POSTFACH_MAIL_TEXT.antwortenInDerApp}</Text>
    </EmailLayout>
  )
}
