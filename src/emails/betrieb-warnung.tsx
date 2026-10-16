import * as React from 'react'
import { Link, Text } from '@react-email/components'
import { BETRIEB_MAIL_TEXT, type BetriebMail } from '@/lib/betrieb'
import { ZUSTELLUNG_MAIL_TEXT } from '@/lib/zustellung'
import { EmailLayout, bodyText, ctaButton, h1, kleinText, mutedText } from './_layout'

export interface BetriebWarnungProps {
  /** Betreff und Sätze aus `betriebMail` (src/lib/betrieb.ts) — die Vorlage rendert nur. */
  mail: BetriebMail
  /** Admin › Betrieb. */
  url: string
}

/**
 * Warn-Mail von Admin › Betrieb (Register N18, Nr. 103; Mockup
 * email-betrieb-warnung): Grenze erreicht (80 %, 95 %, voll), Entwarnung,
 * Ablauf überfällig oder gescheitert. Nur Zahlen und Namen aus festen Listen —
 * kein Hofname, keine Adresse, kein Meldungstext.
 */
export function BetriebWarnungEmail({ mail, url }: BetriebWarnungProps): React.JSX.Element {
  return (
    <EmailLayout previewText={mail.titel} fusszeile={ZUSTELLUNG_MAIL_TEXT.fuss}>
      <Text style={mutedText}>{BETRIEB_MAIL_TEXT.kopf}</Text>
      <Text style={h1}>{mail.titel}</Text>
      {mail.absaetze.map((satz) => (
        <Text key={satz} style={bodyText}>
          {satz}
        </Text>
      ))}
      {mail.hilft && (
        <Text style={bodyText}>
          <strong>{BETRIEB_MAIL_TEXT.hilft}</strong> {mail.hilft}
        </Text>
      )}
      <Link href={url} style={ctaButton}>
        {mail.knopf}
      </Link>
      <Text style={kleinText}>{mail.fuss}</Text>
    </EmailLayout>
  )
}
