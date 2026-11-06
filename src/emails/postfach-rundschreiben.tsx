import * as React from 'react'
import { Link, Text } from '@react-email/components'
import { POSTFACH_MAIL_TEXT } from '@/lib/postfach'
import { EmailLayout, MAIL_FARBE, Knopf, KnopfReihe, bodyText, h1, leiseZeile, mutedText, textLink } from './_layout'

export interface PostfachRundschreibenProps {
  titel: string
  text: string
  /** Vollständige Adresse des Links der Nachricht (mit Ursprung) oder null. */
  linkUrl: string | null
  /** Vollständige Adresse des Fadens im Postfach des Hofs. */
  fadenUrl: string
}

/**
 * Ein Rundschreiben per E-Mail (Register N12, Nr. 87) — nur mit dem Haken
 * „Betriebsmitteilung": Es betrifft den Betrieb des Hofs, Werbung für Dritte
 * nie. Titel, Text und Link der Nachricht, Absender aus MARKE_TEAM (auch im Fuß:
 * POSTFACH_MAIL_TEXT.fuss statt des Hof-Satzes des Layouts); geantwortet
 * wird in der App. Der Text steht nur als Text-Kind da, nie als Markup.
 */
export function PostfachRundschreibenEmail(p: PostfachRundschreibenProps): React.JSX.Element {
  const [absender, art] = POSTFACH_MAIL_TEXT.vonTeam.split(' · ')
  return (
    <EmailLayout fuss={{ art: 'postfach' }} previewText={p.titel}>
      {/* Board s3/w3-mail-hof-konto Bild 4: der Absender fett, die Art leise daneben; Gruß in Fließtext. */}
      <Text style={{ ...mutedText, margin: '0 0 6px' }}>
        <strong style={{ color: MAIL_FARBE.text }}>{absender}</strong>
        {art ? ` · ${art}` : ''}
      </Text>
      <Text style={h1}>{p.titel}</Text>
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
      <Text style={{ ...bodyText, margin: '10px 0 0' }}>{POSTFACH_MAIL_TEXT.gruss}</Text>
    </EmailLayout>
  )
}
