import * as React from 'react'
import { Section, Text } from '@react-email/components'
import { EmailLayout, MAIL_FARBE, bodyText, h1, highlightBox, kleinText, mutedText } from './_layout'
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

const codeKasten: React.CSSProperties = {
  backgroundColor: MAIL_FARBE.gruenFlaeche,
  border: `1px solid ${MAIL_FARBE.gruenRand}`,
  borderRadius: '12px',
  padding: '18px 12px',
  margin: '24px 0',
  textAlign: 'center' as const,
}

const codeText: React.CSSProperties = {
  color: MAIL_FARBE.text,
  fontSize: '34px',
  fontWeight: '700',
  letterSpacing: '0.3em',
  lineHeight: '1.2',
  margin: 0,
  fontFamily: 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace',
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
  if (anlass === 'einrichtungscode') {
    return (
      <EmailLayout previewText={betreff}>
        <Text style={h1}>{betreff}</Text>
        <Text style={bodyText}>
          {text.anrede}
          <br />
          {text.satz.einrichtungscode}
        </Text>
        <div style={codeKasten}>
          <Text style={codeText}>{code}</Text>
        </div>
        <Text style={{ ...mutedText, margin: '0 0 6px' }}>{text.codeGilt}</Text>
        <Text style={mutedText}>{text.codeNichtDu}</Text>
        <Text style={mutedText}>{text.fuss}</Text>
      </EmailLayout>
    )
  }
  return (
    <EmailLayout previewText={`${betreff} · ${geraet}`}>
      <Text style={h1}>{betreff}</Text>
      <Text style={bodyText}>
        {text.anrede}
        <br />
        {text.vorher} <strong>{wann}</strong> {text.satz[anlass]}
      </Text>
      <Section style={{ ...highlightBox, padding: '12px 16px' }}>
        <Text style={{ ...bodyText, fontWeight: '600', margin: 0 }}>{geraet}</Text>
        <Text style={{ ...kleinText, margin: 0 }}>{wann}</Text>
      </Section>
      {anlass === 'ersatzcode-benutzt' && <Text style={bodyText}>{text.ersatzcodeFolge}</Text>}
      <Text style={bodyText}>{text.warstDu}</Text>
      <Text style={mutedText}>{text.fuss}</Text>
    </EmailLayout>
  )
}
