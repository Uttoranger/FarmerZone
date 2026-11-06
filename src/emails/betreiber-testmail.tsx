import * as React from 'react'
import { Text } from '@react-email/components'
import { ZUSTELLUNG_MAIL_TEXT } from '@/lib/zustellung'
import { EmailLayout, bodyText, h1 } from './_layout'

export interface BetreiberTestmailProps {
  /** Der Eingang des Admin-Postfachs — die Mail selbst verlinkt ihn nicht mehr (Board s3/w3-mail-team Bild 5). */
  url: string
}

/** „Testmail an alle senden" (Postfach › Zustellung, Register N14, Nr. 95) — ohne Hofnamen, ohne Meldungstext, ohne Link. */
export function BetreiberTestmailEmail(_props: BetreiberTestmailProps): React.JSX.Element {
  return (
    <EmailLayout fuss={{ art: 'betrieb' }} previewText={ZUSTELLUNG_MAIL_TEXT.testTitel}>
      <Text style={h1}>{ZUSTELLUNG_MAIL_TEXT.testTitel}</Text>
      <Text style={bodyText}>{ZUSTELLUNG_MAIL_TEXT.testSatz}</Text>
    </EmailLayout>
  )
}
