import * as React from 'react'
import { Link, Text } from '@react-email/components'
import { MARKE_TEAM } from '@/lib/marke'
import { POSTFACH_MAIL_TEXT } from '@/lib/postfach'
import { EmailLayout, bodyText, ctaButton, h1, mutedText, textLink } from './_layout'

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
 * nie. Titel, Text und Link der Nachricht, Absender aus MARKE_TEAM; geantwortet
 * wird in der App. Der Text steht nur als Text-Kind da, nie als Markup.
 */
export function PostfachRundschreibenEmail(p: PostfachRundschreibenProps) {
  return (
    <EmailLayout previewText={p.titel}>
      <Text style={mutedText}>{POSTFACH_MAIL_TEXT.vonTeam}</Text>
      <Text style={h1}>{p.titel}</Text>
      <Text style={{ ...bodyText, whiteSpace: 'pre-wrap' }}>{p.text}</Text>
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
      <Text style={mutedText}>{`Dein ${MARKE_TEAM}`}</Text>
    </EmailLayout>
  )
}
