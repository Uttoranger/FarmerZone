import * as React from 'react'
import { Text } from '@react-email/components'
import { BETRIEB_MAIL_TEXT, type BetriebMail } from '@/lib/betrieb'
import { EmailLayout, HinweisKasten, Knopf, KnopfReihe, bodyText, h1, kleinText } from './_layout'

export interface BetriebWarnungProps {
  /** Betreff und Sätze aus `betriebMail` (src/lib/betrieb.ts) — die Vorlage rendert nur. */
  mail: BetriebMail
  /** Admin › Betrieb. */
  url: string
}

/**
 * Warn-Mail von Admin › Betrieb (Register N18, Nr. 103; Board s3/w3-mail-betrieb
 * Bild 6): Grenze erreicht (80 %, 95 %, voll), Entwarnung, Ablauf überfällig
 * oder gescheitert. Der erste Satz (die Messung) steht in der orangen Karte.
 * Nur Zahlen und Namen aus festen Listen — kein Hofname, keine Adresse, kein Meldungstext.
 */
export function BetriebWarnungEmail({ mail, url }: BetriebWarnungProps): React.JSX.Element {
  const [erster, ...weitere] = mail.absaetze
  return (
    <EmailLayout fuss={{ art: 'betrieb' }} previewText={mail.titel}>
      <Text style={h1}>{mail.titel}</Text>
      {erster && <HinweisKasten art="orange">{erster}</HinweisKasten>}
      {weitere.map((satz) => (
        <Text key={satz} style={bodyText}>
          {satz}
        </Text>
      ))}
      {mail.hilft && <Text style={bodyText}>{`${BETRIEB_MAIL_TEXT.hilft} ${mail.hilft}`}</Text>}
      <KnopfReihe>
        <Knopf href={url}>{mail.knopf}</Knopf>
      </KnopfReihe>
      <Text style={kleinText}>{mail.fuss}</Text>
    </EmailLayout>
  )
}
