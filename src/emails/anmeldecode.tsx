import * as React from 'react'
import { Text } from '@react-email/components'
import { EmailLayout, h1, bodyText, mutedText, MAIL_FARBE } from './_layout'

export interface AnmeldecodeProps {
  code: string
  /** Gültigkeit in Minuten — kommt aus ANMELDECODE_GUELTIG_SEKUNDEN, nie eine zweite Zahl. */
  minuten: number
  /**
   * Wofür der Code ist: die Anmeldung (Nr. 08, Standard) oder „Bestellungen
   * finden" (Nr. 14) — dort meldet er nicht an, er zeigt nur die Bestellungen
   * dieser Adresse auf diesem Gerät.
   */
  zweck?: 'anmelden' | 'bestellungen'
}

const TEXTE = {
  anmelden: {
    titel: 'Dein Anmeldecode',
    wozu: 'gib diesen Code auf FarmerZone ein, um dich anzumelden:',
    nichtDu: 'Du wolltest dich nicht anmelden?',
    kurztext: 'Dein Code für FarmerZone',
  },
  bestellungen: {
    titel: 'Dein Code für deine Bestellungen',
    wozu: 'gib diesen Code auf FarmerZone ein, um deine Bestellungen zu sehen:',
    nichtDu: 'Du wolltest deine Bestellungen nicht ansehen?',
    kurztext: 'Dein Code für deine Bestellungen',
  },
} as const

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
  // Die Ziffern gleich breit, damit 1 und 7 nicht verrutschen.
  fontFamily: 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace',
}

/**
 * Die Mail mit dem Anmeldecode für Kundinnen (E7, Nr. 08). Hell wie alle
 * Mails (DESIGN_SYSTEM, „Lesbarkeit"), ohne Emojis.
 *
 * Bewusst OHNE Link: Ein Link aus einer Mail ändert nie einen Zustand
 * (ARCHITECTURE §5) — Link-Scanner der Mailprogramme rufen ihn ungefragt auf.
 * Angemeldet wird nur, wer den Code auf der Seite eintippt.
 * Bewusst OHNE Code im Vorschautext und im Betreff (src/lib/email.ts): beide
 * stehen auf dem Sperrbildschirm, der Betreff zusätzlich im Server-Log.
 */
export function AnmeldecodeEmail({ code, minuten, zweck = 'anmelden' }: AnmeldecodeProps) {
  const text = TEXTE[zweck]
  return (
    <EmailLayout previewText={`${text.kurztext} – ${minuten} Minuten gültig`}>
      <Text style={h1}>{text.titel}</Text>
      <Text style={bodyText}>
        Hallo,
        <br />
        {text.wozu}
      </Text>

      <div style={codeKasten}>
        <Text style={codeText}>{code}</Text>
      </div>

      <Text style={{ ...mutedText, margin: '0 0 6px' }}>
        Der Code ist <strong>{minuten} Minuten</strong> gültig und funktioniert nur einmal.
      </Text>
      <Text style={mutedText}>
        {text.nichtDu} Dann kannst du diese E-Mail einfach ignorieren. Gib den Code
        nie an andere weiter – wir fragen dich nie danach.
      </Text>
    </EmailLayout>
  )
}
