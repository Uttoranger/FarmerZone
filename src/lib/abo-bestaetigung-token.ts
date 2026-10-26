import { ABO_BESTAETIGUNG_GUELTIG_MS } from '@/lib/abo-bestaetigung'
import { pruefeLink, signiereLink } from '@/lib/link-signatur'

/*
 * Der signierte Bestätigungslink des Double-Opt-in (Register S11, Nr. 38) —
 * nur Server: Die Signatur braucht das Geheimnis aus env (über
 * link-signatur.ts). Regeln und Texte stehen in abo-bestaetigung.ts.
 */

// ── Der signierte Link ────────────────────────────────────────────────────────
//
// Signiert über src/lib/link-signatur.ts (Zweck `abo-optin`, Register S17,
// Nr. 171): mit LINK_SECRET hängt die Signatur als `2.<hex>` am Token, ohne wie
// bisher als `<hex>` mit BETTER_AUTH_SECRET — bitgleich mit den Links vor
// Nr. 171, die damit weiter gelten. Der Base64-Teil bleibt
// `abo-optin:<aboId>:<ms>`: Der Zweck im Inhalt hält jeden anderen Token-Typ
// fern, auch ohne Kennung. Base64url enthält nie einen Punkt, deshalb trennt
// der ERSTE Punkt Inhalt und Signatur. Der Token trägt nur die Abo-ID und den
// Zeitpunkt der Anfrage, keine Adresse: Er steht in einer URL, und die landet
// in Verläufen und Logs.
//
// AN DIE ANFRAGE GEBUNDEN (Nachbesserung Runde 1): Bestätigt wird nur, wenn
// `emailOptInAngefragtAm` noch genau dieser Zeitpunkt ist und das Abo noch
// unbestätigt (src/server/abo-anmeldung.ts). Ausschalten, Abmelden oder ein
// neuerer Link lösen die Anfrage auf — ein alter Link meldet dann niemanden
// wieder an. Der Ablauf folgt aus dem Anfragezeitpunkt plus Gültigkeit.

const ZWECK = 'abo-optin'
const PRAEFIX = `${ZWECK}:`

/**
 * Token für den Link in der Bestätigungsmail. `angefragtAm` ist genau der Wert,
 * der in `emailOptInAngefragtAm` steht; der Link gilt
 * `ABO_BESTAETIGUNG_GUELTIG_TAGE` ab da.
 */
export function erzeugeAboBestaetigungsToken(aboId: string, angefragtAm: Date): string {
  const inhalt = `${aboId}:${angefragtAm.getTime()}`
  return `${Buffer.from(PRAEFIX + inhalt).toString('base64url')}.${signiereLink(ZWECK, inhalt)}`
}

export type AboTokenErgebnis =
  | { ok: true; aboId: string; angefragtAm: Date }
  | { ok: false; grund: 'abgelaufen' | 'ungueltig' }

/**
 * Prüft Signatur, Zweck und Ablauf. „abgelaufen" nur bei gültiger Signatur —
 * ein manipulierter Token erfährt nie mehr als „ungültig".
 */
export function pruefeAboBestaetigungsToken(token: string, jetzt: Date): AboTokenErgebnis {
  const punkt = token.indexOf('.')
  if (punkt < 1) return { ok: false, grund: 'ungueltig' }
  const payload = Buffer.from(token.slice(0, punkt), 'base64url').toString()
  // Signiert ist der Inhalt nach dem Präfix; ohne Präfix ist es kein Abo-Token.
  if (!payload.startsWith(PRAEFIX)) return { ok: false, grund: 'ungueltig' }
  const inhalt = payload.slice(PRAEFIX.length)
  if (!pruefeLink(ZWECK, inhalt, token.slice(punkt + 1))) return { ok: false, grund: 'ungueltig' }

  const teile = inhalt.split(':')
  if (teile.length !== 2) return { ok: false, grund: 'ungueltig' }
  const [aboId, angefragtRoh] = teile
  const angefragt = Number(angefragtRoh)
  if (!aboId || !Number.isSafeInteger(angefragt) || angefragt <= 0) return { ok: false, grund: 'ungueltig' }
  if (jetzt.getTime() >= angefragt + ABO_BESTAETIGUNG_GUELTIG_MS) return { ok: false, grund: 'abgelaufen' }
  return { ok: true, aboId, angefragtAm: new Date(angefragt) }
}

/** Der Pfad der Bestätigungsseite samt Token — nur der Server baut ihn. */
export function aboBestaetigungsPfad(token: string): string {
  return `/account/neuigkeiten-bestaetigen?token=${encodeURIComponent(token)}`
}
