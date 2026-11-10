import * as React from 'react'
import { Text } from '@react-email/components'
import { EmailLayout, Knopf, KnopfReihe, h1, bodyText, kleinText, leiseZeile } from './_layout'
import { PASSWORT_LINK_DAUER_TEXT } from '@/lib/anmeldecode'

export interface PasswordResetProps {
  resetUrl: string
}

export function PasswordResetEmail({ resetUrl }: PasswordResetProps) {
  return (
    <EmailLayout fuss={{ art: 'plattform' }} previewText={`Der Link ist ${PASSWORT_LINK_DAUER_TEXT} gültig.`}>
      <Text style={h1}>Passwort zurücksetzen</Text>
      {/* Board s3/w3-mail-zugang Bild 3; ohne Namen — die Mail kennt nur die Adresse. */}
      <Text style={bodyText}>Hallo, du möchtest ein neues Passwort für dein Konto. Tipp auf den Knopf unten:</Text>
      <KnopfReihe>
        <Knopf href={resetUrl}>Neues Passwort wählen</Knopf>
      </KnopfReihe>
      <Text style={leiseZeile}>{`Dieser Link ist ${PASSWORT_LINK_DAUER_TEXT} gültig und funktioniert nur einmal.`}</Text>
      <Text style={kleinText}>Du warst das nicht? Dann ignorier diese Mail – dein Passwort bleibt, wie es ist.</Text>
    </EmailLayout>
  )
}
