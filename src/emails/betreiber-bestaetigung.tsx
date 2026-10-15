import * as React from 'react'
import { Text } from '@react-email/components'
import { BESTAETIGEN_TEXT, ZUSTELLUNG_MAIL_TEXT } from '@/lib/zustellung'
import { EmailLayout, h1, bodyText, mutedText, Knopf, KnopfReihe } from './_layout'

export interface BetreiberBestaetigungProps {
  /** Volle Adresse der Seite mit dem Knopf (bestaetigenPfad). */
  url: string
}

/**
 * „Bitte bestätige deine Adresse" — eine weitere Adresse für die
 * Betriebs-Mails (Postfach › Zustellung, Register N14, Nr. 95; Double-Opt-in
 * nach dem Muster der Abo-Bestätigung, S11). Der Link öffnet nur die Seite,
 * bestätigt wird dort per Knopf: Link-Scanner der Mailprogramme rufen Links
 * ungefragt auf (ARCHITECTURE §5). Ohne Hofnamen und ohne Meldungstext — die
 * Adresse ist ja noch nicht bestätigt.
 */
export function BetreiberBestaetigungEmail({ url }: BetreiberBestaetigungProps): React.JSX.Element {
  return (
    <EmailLayout previewText={ZUSTELLUNG_MAIL_TEXT.bestaetigungTitel} fusszeile={ZUSTELLUNG_MAIL_TEXT.fuss}>
      <Text style={h1}>{ZUSTELLUNG_MAIL_TEXT.bestaetigungTitel}</Text>
      <Text style={bodyText}>{ZUSTELLUNG_MAIL_TEXT.bestaetigungSatz}</Text>
      <KnopfReihe>
        <Knopf href={url}>{BESTAETIGEN_TEXT.knopf}</Knopf>
      </KnopfReihe>
      <Text style={{ ...mutedText, margin: '0 0 6px' }}>{ZUSTELLUNG_MAIL_TEXT.bestaetigungGueltig}</Text>
      <Text style={mutedText}>{ZUSTELLUNG_MAIL_TEXT.bestaetigungIgnorieren}</Text>
    </EmailLayout>
  )
}
