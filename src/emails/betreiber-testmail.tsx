import * as React from 'react'
import { Link, Text } from '@react-email/components'
import { ZUSTELLUNG_MAIL_TEXT } from '@/lib/zustellung'
import { EmailLayout, bodyText, h1, textLink } from './_layout'

export interface BetreiberTestmailProps {
  /** Der Eingang des Admin-Postfachs. */
  url: string
}

/** „Testmail an alle senden" (Postfach › Zustellung, Register N14, Nr. 95) — ohne Hofnamen, ohne Meldungstext. */
export function BetreiberTestmailEmail({ url }: BetreiberTestmailProps): React.JSX.Element {
  return (
    <EmailLayout previewText={ZUSTELLUNG_MAIL_TEXT.testTitel} fusszeile={ZUSTELLUNG_MAIL_TEXT.fuss}>
      <Text style={h1}>{ZUSTELLUNG_MAIL_TEXT.testTitel}</Text>
      <Text style={bodyText}>{ZUSTELLUNG_MAIL_TEXT.testSatz}</Text>
      <Text style={bodyText}>
        <Link href={url} style={textLink}>
          {ZUSTELLUNG_MAIL_TEXT.antwortOeffnen}
        </Link>
      </Text>
    </EmailLayout>
  )
}
