import { createHmac } from 'crypto'
import { env } from '@/lib/env'
import { geheimnisGleich } from '@/lib/geheimnis'
import { ABO_BESTAETIGUNG_GUELTIG_MS } from '@/lib/abo-bestaetigung'

/*
 * Der signierte Bestätigungslink des Double-Opt-in (Register S11, Nr. 38) —
 * nur Server: Er braucht das Geheimnis aus env. Regeln und Texte stehen in
 * abo-bestaetigung.ts.
 */

// ── Der signierte Link ────────────────────────────────────────────────────────
//
// Dasselbe HMAC-Muster wie unsubscribe.ts und reorder-token.ts (Geheimnis aus
// dem validierten env-Modul, Vergleich in konstanter Zeit) — mit Zweck im
// Payload, damit kein anderer Token-Typ desselben Geheimnisses hier durchgeht,
// und mit Ablauf (S11). Der Token trägt nur die Abo-ID und den Zeitpunkt der
// Anfrage, keine Adresse: Er steht in einer URL, und die landet in Verläufen
// und Logs.
//
// AN DIE ANFRAGE GEBUNDEN (Nachbesserung Runde 1): Bestätigt wird nur, wenn
// `emailOptInAngefragtAm` noch genau dieser Zeitpunkt ist und das Abo noch
// unbestätigt (src/server/abo-anmeldung.ts). Ausschalten, Abmelden oder ein
// neuerer Link lösen die Anfrage auf — ein alter Link meldet dann niemanden
// wieder an. Der Ablauf folgt aus dem Anfragezeitpunkt plus Gültigkeit.

const SECRET = env.BETTER_AUTH_SECRET
const ZWECK = 'abo-optin'

function signiere(payload: string): string {
  return createHmac('sha256', SECRET).update(payload).digest('hex')
}

/**
 * Token für den Link in der Bestätigungsmail. `angefragtAm` ist genau der Wert,
 * der in `emailOptInAngefragtAm` steht; der Link gilt
 * `ABO_BESTAETIGUNG_GUELTIG_TAGE` ab da.
 */
export function erzeugeAboBestaetigungsToken(aboId: string, angefragtAm: Date): string {
  const payload = `${ZWECK}:${aboId}:${angefragtAm.getTime()}`
  return `${Buffer.from(payload).toString('base64url')}.${signiere(payload)}`
}

export type AboTokenErgebnis =
  | { ok: true; aboId: string; angefragtAm: Date }
  | { ok: false; grund: 'abgelaufen' | 'ungueltig' }

/**
 * Prüft Signatur, Zweck und Ablauf. „abgelaufen" nur bei gültiger Signatur —
 * ein manipulierter Token erfährt nie mehr als „ungültig".
 */
export function pruefeAboBestaetigungsToken(token: string, jetzt: Date): AboTokenErgebnis {
  const punkt = token.lastIndexOf('.')
  if (punkt < 1) return { ok: false, grund: 'ungueltig' }
  const payload = Buffer.from(token.slice(0, punkt), 'base64url').toString()
  if (!geheimnisGleich(token.slice(punkt + 1), signiere(payload))) return { ok: false, grund: 'ungueltig' }

  const teile = payload.split(':')
  if (teile.length !== 3 || teile[0] !== ZWECK) return { ok: false, grund: 'ungueltig' }
  const [, aboId, angefragtRoh] = teile
  const angefragt = Number(angefragtRoh)
  if (!aboId || !Number.isSafeInteger(angefragt) || angefragt <= 0) return { ok: false, grund: 'ungueltig' }
  if (jetzt.getTime() >= angefragt + ABO_BESTAETIGUNG_GUELTIG_MS) return { ok: false, grund: 'abgelaufen' }
  return { ok: true, aboId, angefragtAm: new Date(angefragt) }
}

/** Der Pfad der Bestätigungsseite samt Token — nur der Server baut ihn. */
export function aboBestaetigungsPfad(token: string): string {
  return `/account/neuigkeiten-bestaetigen?token=${encodeURIComponent(token)}`
}
