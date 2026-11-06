import * as React from 'react'
import { Text } from '@react-email/components'
import { ZUSTELLUNG_MAIL_TEXT } from '@/lib/zustellung'
import { EmailLayout, bodyText, h1 } from './_layout'

/** „Testmail an alle senden" (Postfach › Zustellung, Register N14, Nr. 95) — ohne Hofnamen, ohne Meldungstext, ohne Link (Board s3/w3-mail-team Bild 5). */
export function BetreiberTestmailEmail(): React.JSX.Element {
  return (
    <EmailLayout fuss={{ art: 'betrieb' }} previewText={ZUSTELLUNG_MAIL_TEXT.testTitel}>
      <Text style={h1}>{ZUSTELLUNG_MAIL_TEXT.testTitel}</Text>
      <Text style={bodyText}>{ZUSTELLUNG_MAIL_TEXT.testSatz}</Text>
    </EmailLayout>
  )
}
