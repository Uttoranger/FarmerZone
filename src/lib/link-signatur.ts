import { createHmac } from 'crypto'
import { env } from '@/lib/env'
import { geheimnisGleich } from '@/lib/geheimnis'

/**
 * Die Signatur der Links in Mails (Register S17, Ergänzung 24.10.2026, Nr. 166)
 * — EINE Stelle für Bestell-Link, Nachbestell-Token, Abmeldelink und, seit
 * Nr. 171, den Double-Opt-in-Link (abo-bestaetigung-token.ts).
 *
 * Zwei Geheimnisse, unterschieden an einer Schlüsselkennung vor dem Hex:
 *  - ohne Kennung (`<hex>`): BETTER_AUTH_SECRET, so wie bis Nr. 166 signiert
 *    wurde. Diese Links liegen in Postfächern und laufen teils nie ab
 *    (Bestell-Link, Abmeldelink) — sie gelten weiter, auch mit LINK_SECRET.
 *  - Kennung 2 (`2.<hex>`): LINK_SECRET. Damit hängt ein Link nicht mehr am
 *    Geheimnis der Sitzungen; wer es tauscht, macht keine Mail-Links kaputt
 *    und umgekehrt.
 * Neue Links bekommen Kennung 2, sobald LINK_SECRET gesetzt ist; ohne bleibt
 * alles wie bisher. Eine Kennung, die wir nicht kennen, gilt nie — auch nicht
 * die 2, wenn LINK_SECRET fehlt. Tausch mit Kennung 3: docs/ai/ARCHITECTURE.md
 * §5, „Signierte Links".
 */
export type LinkZweck = 'bestellung-ansehen' | 'nachbestellen' | 'abmelden' | 'abo-optin' | 'widerruf'

/** Die Kennung, die neue Signaturen mit LINK_SECRET tragen. */
export const LINK_KENNUNG = '2'

// Das alte Verfahren hatte nur beim Bestell-Link und beim Double-Opt-in-Link
// ein Zweck-Präfix; Nachbestell- und Abmelde-Token signierten den nackten
// Inhalt (ihre Inhalte haben verschiedene Formen). Damit alte Links gelten,
// bleibt das ohne Kennung genau so — auch für `nachbestellen` und `abmelden`
// nie ändern, sonst gälten verschickte Links nicht mehr. Mit Kennung trägt
// jeder Zweck sein Präfix — dort gilt eine Signatur nur für genau einen Zweck.
const ALTES_PRAEFIX: Record<LinkZweck, boolean> = {
  'bestellung-ansehen': true,
  nachbestellen: false,
  abmelden: false,
  // Bis Nr. 171 HMAC über `abo-optin:<aboId>:<ms>` — mit Präfix bitgleich.
  'abo-optin': true,
  // Nr. 200: neu, mit Präfix — die Signatur gilt nie zugleich als Bestell-Link.
  widerruf: true,
}

function hmac(geheimnis: string, text: string): string {
  return createHmac('sha256', geheimnis).update(text).digest('hex')
}

function alteSignatur(zweck: LinkZweck, inhalt: string): string {
  return hmac(env.BETTER_AUTH_SECRET, ALTES_PRAEFIX[zweck] ? `${zweck}:${inhalt}` : inhalt)
}

// Gelesen bei jedem Aufruf, nicht beim Laden: Im Test ist env das rohe
// process.env, und ein leerer Wert zählt wie ein fehlender.
function geheimnisFuer(kennung: string): string | undefined {
  if (kennung === LINK_KENNUNG) return env.LINK_SECRET || undefined
  return undefined
}

/** Signiert `inhalt` für `zweck` — mit LINK_SECRET als `2.<hex>`, sonst wie bisher. */
export function signiereLink(zweck: LinkZweck, inhalt: string): string {
  const geheimnis = geheimnisFuer(LINK_KENNUNG)
  if (!geheimnis) return alteSignatur(zweck, inhalt)
  return `${LINK_KENNUNG}.${hmac(geheimnis, `${zweck}:${inhalt}`)}`
}

/** Gilt `signatur` für `zweck` und `inhalt`? Vergleich in konstanter Zeit. */
export function pruefeLink(zweck: LinkZweck, inhalt: string, signatur: string): boolean {
  const punkt = signatur.indexOf('.')
  if (punkt < 0) return geheimnisGleich(signatur, alteSignatur(zweck, inhalt))
  const geheimnis = geheimnisFuer(signatur.slice(0, punkt))
  if (!geheimnis) return false
  return geheimnisGleich(signatur.slice(punkt + 1), hmac(geheimnis, `${zweck}:${inhalt}`))
}
