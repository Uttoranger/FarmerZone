import * as React from 'react'
import { Text } from '@react-email/components'
import { EmailLayout, CodeKasten, bodyText, h1, leiseZeile } from './_layout'
import { ADMIN_SICHERHEIT_MAIL, type AdminSicherheitAnlass } from '@/lib/admin-anmeldung'

export interface AdminSicherheitProps {
  anlass: AdminSicherheitAnlass
  /** Gerät und Browser in festen Wörtern („Windows · Chrome", geraetName). */
  geraet: string
  /** „Di, 2. März 2027, 21:14 Uhr“ — Wiener Zeit nach V9 (zeitpunktMitUhr in src/lib/email.ts). */
  wann: string
  /** Nur beim Anlass „einrichtungscode": die 6 Ziffern. */
  code?: string
}

/** Die Überschrift der Passkey-Mail nach Board s3/w3-mail-team Bild 2; der Betreff bleibt „Neuer Passkey bei deinem Admin-Konto“. */
const PASSKEY_UEBERSCHRIFT = 'Neuer Passkey'

/**
 * „Admin-Sicherheit" (Register N20; Nr. 115) — eine Vorlage für die Mails an
 * ein Admin-Konto: Passkey hinzugefügt, Passkey entfernt, Ersatzcode benutzt
 * (je mit Gerät und Uhrzeit) und der E-Mail-Code der Einrichtung. Bewusst OHNE
 * Link zum Anmelden: Eine Mail, die zum Anmelden führt, wäre das Muster jeder
 * gefälschten Mail. Der Code steht nie im Betreff oder Vorschautext (beide
 * stehen auf dem Sperrbildschirm, der Betreff im Server-Log). Hell wie alle
 * Mails, ohne Emojis.
 */
export function AdminSicherheitEmail({ anlass, geraet, wann, code }: AdminSicherheitProps): React.JSX.Element {
  const text = ADMIN_SICHERHEIT_MAIL
  const betreff = text.betreff[anlass]
  // Board s3/w3-mail-team Bild 1 und 2: die Anrede im selben Satz, das Gerät im Satz statt in einem Kasten.
  if (anlass === 'einrichtungscode') {
    return (
      <EmailLayout fuss={{ art: 'plattform' }} previewText={betreff}>
        <Text style={bodyText}>{`${text.anrede} ${text.satz.einrichtungscode}`}</Text>
        {/* Ungegliedert: Das Feld der Einrichtung nimmt nur sechs Ziffern ohne Leerzeichen (einrichtungscodeSchema). */}
        {code && <CodeKasten code={code} gruppiert={false} />}
        <Text style={leiseZeile}>{text.codeGilt}</Text>
      </EmailLayout>
    )
  }
  // Board s3/w3-mail-team Bild 2 (Nr. 280): „Neuer Passkey“, der Passkey in Anführungszeichen, der Zeitpunkt in Klammern.
  if (anlass === 'passkey-hinzugefuegt') {
    return (
      <EmailLayout fuss={{ art: 'plattform' }} previewText={`${betreff} · ${geraet}`}>
        <Text style={h1}>{PASSKEY_UEBERSCHRIFT}</Text>
        <Text style={bodyText}>{`Bei deinem Admin-Konto wurde der Passkey „${geraet}“ hinzugefügt (${wann}).`}</Text>
        <Text style={bodyText}>{text.warstDu}</Text>
      </EmailLayout>
    )
  }
  return (
    <EmailLayout fuss={{ art: 'plattform' }} previewText={`${betreff} · ${geraet}`}>
      <Text style={h1}>{betreff}</Text>
      <Text style={bodyText}>
        {`${text.anrede} ${text.vorher} `}
        <strong>{wann}</strong>
        {` ${text.satz[anlass]} `}
        <strong>{geraet}</strong>.
      </Text>
      {anlass === 'ersatzcode-benutzt' && <Text style={bodyText}>{text.ersatzcodeFolge}</Text>}
      <Text style={bodyText}>{text.warstDu}</Text>
    </EmailLayout>
  )
}
