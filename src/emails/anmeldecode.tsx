import * as React from 'react'
import { Text } from '@react-email/components'
import { EmailLayout, CodeKasten, bodyText, kleinText, leiseZeile } from './_layout'
import { MARKE } from '@/lib/marke'

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

// Board s3/w3-mail-zugang Bild 1 und 2: keine Überschrift im Körper — die Anrede führt zum Code.
const TEXTE = {
  anmelden: {
    wozu: `Hallo, gib diesen Code auf ${MARKE} ein, um dich anzumelden:`,
    nichtDu: 'Du wolltest dich nicht anmelden? Dann ignorier diese Mail einfach. Gib den Code nie weiter – wir fragen dich nie danach.',
  },
  bestellungen: {
    wozu: `Hallo, gib diesen Code auf ${MARKE} ein, um deine Bestellungen zu sehen:`,
    nichtDu: 'Du hast keinen Code angefordert? Dann ignorier diese Mail einfach.',
  },
} as const

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
    <EmailLayout fuss={{ art: 'plattform' }} previewText={`Der Code ist ${minuten} Minuten gültig.`}>
      <Text style={bodyText}>{text.wozu}</Text>
      <CodeKasten code={code} />
      <Text style={leiseZeile}>{`Der Code ist ${minuten} Minuten gültig und funktioniert nur einmal.`}</Text>
      <Text style={kleinText}>{text.nichtDu}</Text>
    </EmailLayout>
  )
}
