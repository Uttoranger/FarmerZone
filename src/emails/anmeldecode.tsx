import * as React from 'react'
import { Text } from '@react-email/components'
import { EmailLayout, h1, bodyText, mutedText } from './_layout'

export interface AnmeldecodeProps {
  code: string
  /** Gültigkeit in Minuten — kommt aus ANMELDECODE_GUELTIG_SEKUNDEN, nie eine zweite Zahl. */
  minuten: number
}

const codeKasten: React.CSSProperties = {
  backgroundColor: '#E8F0E8',
  border: '1px solid #C4D9C8',
  borderRadius: '12px',
  padding: '18px 12px',
  margin: '24px 0',
  textAlign: 'center' as const,
}

const codeText: React.CSSProperties = {
  color: '#1A2B22',
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
export function AnmeldecodeEmail({ code, minuten }: AnmeldecodeProps) {
  return (
    <EmailLayout previewText={`Dein Code für FarmerZone – ${minuten} Minuten gültig`}>
      <Text style={h1}>Dein Anmeldecode</Text>
      <Text style={bodyText}>
        Hallo,
        <br />
        gib diesen Code auf FarmerZone ein, um dich anzumelden:
      </Text>

      <div style={codeKasten}>
        <Text style={codeText}>{code}</Text>
      </div>

      <Text style={{ ...mutedText, margin: '0 0 6px' }}>
        Der Code ist <strong>{minuten} Minuten</strong> gültig und funktioniert nur einmal.
      </Text>
      <Text style={mutedText}>
        Du wolltest dich nicht anmelden? Dann kannst du diese E-Mail einfach ignorieren. Gib den Code
        nie an andere weiter – wir fragen dich nie danach.
      </Text>
    </EmailLayout>
  )
}
