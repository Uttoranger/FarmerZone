import * as React from 'react'
import { Text } from '@react-email/components'
import { EmailLayout, CodeKasten, bodyText, h1, leiseZeile } from './_layout'
import { ADMIN_SICHERHEIT_MAIL, type AdminSicherheitAnlass } from '@/lib/admin-anmeldung'

export interface AdminSicherheitProps {
  anlass: AdminSicherheitAnlass
  /** Gerät und Browser in festen Wörtern („Windows · Chrome", geraetName). */
  geraet: string
  /** „19.10. um 14:32" — Wiener Zeit (anmeldeZeitpunkt). */
  wann: string
  /** Nur beim Anlass „einrichtungscode": die 6 Ziffern. */
  code?: string
}

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
        {code && <CodeKasten code={code} />}
        <Text style={leiseZeile}>{text.codeGilt}</Text>
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
