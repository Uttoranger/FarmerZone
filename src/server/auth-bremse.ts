import * as Sentry from '@sentry/nextjs'
import type { BetterAuthRateLimitStorage } from 'better-auth'
import {
  DB_BREMSE_ZEITLIMIT_MS,
  fensterBeginn,
  innerhalbDerGrenze,
  sekundenBisFensterEnde,
  type DbBremse,
} from '@/lib/bremse-datenbank'
import { ohneAnfrage } from '@/lib/sentry-hygiene'
import { mitFrist, zaehleVersuche } from '@/server/bremse-datenbank'

/*
 * Die eingebaute Bremse von Better Auth über alle Instanzen (Register R1,
 * Ergänzung Nr. 125) — der Speicher für `rateLimit.customStorage` in auth.ts.
 *
 * Ohne eigenen Speicher zählt Better Auth im Arbeitsspeicher, auf Vercel also
 * je warmer Instanz: Wer seine Versuche über mehrere Instanzen verteilt, bekam
 * je Instanz die volle Zahl. Hier zählt dieselbe Tabelle wie die Bremsen aus R1
 * (`RateLimitZaehler`, `zaehleVersuche`) — ein atomares Hochzählen je festem
 * Fenster, der Schlüssel nur als HMAC („auth:" + 32 Hex-Zeichen), nie IP oder
 * Pfad im Klartext. Alte Zeilen räumt der bestehende Cron (`ablauf`).
 *
 * Better Auth nutzt nur `consume`, sobald es da ist (rate-limiter/index.mjs,
 * onRequestRateLimit): ein Schritt für Prüfen und Zählen, keine Lücke zwischen
 * Lesen und Schreiben.
 *
 * NIE OFFEN: Antwortet die Datenbank nicht binnen 1,5 s oder mit einem Fehler,
 * zählt die Instanz für sich im Arbeitsspeicher weiter — mit denselben festen
 * Fenstern, also so wie vor Nr. 125. Gemeldet wird nur die Fehlerklasse,
 * höchstens einmal je Minute und Instanz.
 */

/** Steht im Klartext vor dem HMAC — der Schlüssel von Better Auth (IP und Pfad) nur gehasht. */
export const AUTH_BREMSE_ZWECK = 'auth'

/** Höchstens so viele Schlüssel hält der Ersatz einer Instanz; ein Schwall vieler IPs füllt sonst den Speicher. */
export const ERSATZ_MAX_SCHLUESSEL = 10_000

/** Höchstens eine Meldung je Instanz in dieser Spanne, wenn die Datenbank ausfällt — sonst eine je Anmeldeversuch. */
export const AUTH_BREMSE_MELDE_ABSTAND_MS = 60_000

/** So beginnt der Schlüssel, wenn Better Auth keine Client-IP findet: Dann teilen sich alle einen Topf je Pfad. */
const OHNE_IP = 'no-trusted-ip'

/** Wie lange `set` einen Stand hält — länger als jedes Fenster der Anmeldung; das Fenster prüft Better Auth selbst. */
const SET_AUFBEWAHRUNG_MS = 60 * 60_000

type Regel = { window: number; max: number }
type Entscheidung = { allowed: boolean; retryAfter: number | null }
type ErsatzEintrag = { fensterStartMs: number; zaehler: number; ablaufMs: number }

/**
 * Der Zustand einer Instanz: der Ersatz im Arbeitsspeicher und was schon an
 * Sentry ging. Modul-Zustand wie bei den R1-Bremsen; Tests geben je Fall einen
 * frischen mit.
 */
export type AuthBremseZustand = {
  ersatz: Map<string, ErsatzEintrag>
  letzteMeldungMs: number | null
  ohneIpGemeldet: boolean
}

export function neuerAuthBremseZustand(): AuthBremseZustand {
  return { ersatz: new Map(), letzteMeldungMs: null, ohneIpGemeldet: false }
}

const ZUSTAND_DIESER_INSTANZ = neuerAuthBremseZustand()

/** Macht Platz für einen neuen Schlüssel: erst alles Abgelaufene, dann die ältesten (die Map hält die Einfügereihenfolge). */
function platzSchaffen(ersatz: Map<string, ErsatzEintrag>, jetztMs: number): void {
  if (ersatz.size < ERSATZ_MAX_SCHLUESSEL) return
  for (const [schluessel, eintrag] of ersatz) if (eintrag.ablaufMs <= jetztMs) ersatz.delete(schluessel)
  for (const schluessel of ersatz.keys()) {
    if (ersatz.size < ERSATZ_MAX_SCHLUESSEL) break
    ersatz.delete(schluessel)
  }
}

/**
 * Zählt einen Versuch im Arbeitsspeicher dieser Instanz und gibt den neuen
 * Stand zurück — dasselbe feste Fenster wie in der Tabelle (`fensterBeginn`).
 */
export function zaehleImSpeicher(ersatz: Map<string, ErsatzEintrag>, schluessel: string, fensterMs: number, jetzt: Date): number {
  const fensterStartMs = fensterBeginn(jetzt, fensterMs).getTime()
  const bisher = ersatz.get(schluessel)
  const zaehler = bisher && bisher.fensterStartMs === fensterStartMs ? bisher.zaehler + 1 : 1
  if (bisher) ersatz.delete(schluessel)
  else platzSchaffen(ersatz, jetzt.getTime())
  ersatz.set(schluessel, { fensterStartMs, zaehler, ablaufMs: fensterStartMs + fensterMs })
  return zaehler
}

function meldeAusfall(err: unknown, jetzt: Date, zustand: AuthBremseZustand): void {
  const jetztMs = jetzt.getTime()
  // Läuft die Uhr zurück, bleibt es ruhig (Differenz negativ).
  if (zustand.letzteMeldungMs !== null && jetztMs - zustand.letzteMeldungMs < AUTH_BREMSE_MELDE_ABSTAND_MS) return
  zustand.letzteMeldungMs = jetztMs
  // Nur die Klasse: Der Fehlertext könnte Teile der Abfrage tragen, die Anfrage den Pfad.
  const meldung = new Error('Login-Bremse zählt je Instanz: Datenbank nicht erreichbar')
  meldung.name = err instanceof Error ? err.name : 'Unbekannt'
  Sentry.captureException(meldung, (scope) => scope.setLevel('warning').setTags({ bereich: 'auth-bremse' }).addEventProcessor(ohneAnfrage))
}

function meldeOhneIp(zustand: AuthBremseZustand): void {
  if (zustand.ohneIpGemeldet) return
  zustand.ohneIpGemeldet = true
  Sentry.captureMessage('Keine Client-IP für die Login-Bremse', (scope) =>
    scope.setLevel('warning').setTags({ bereich: 'auth-bremse' }).addEventProcessor(ohneAnfrage)
  )
}

/**
 * Ein Versuch für den Schlüssel von Better Auth (`ip|pfad`) unter dessen Regel
 * (`window` in Sekunden). Erlaubt, solange der Zähler NACH diesem Versuch die
 * Grenze nicht übersteigt; sonst die Sekunden bis zum Fensterende.
 */
export async function verbrauche(
  schluessel: string,
  regel: Regel,
  jetzt: Date = new Date(),
  zustand: AuthBremseZustand = ZUSTAND_DIESER_INSTANZ
): Promise<Entscheidung> {
  if (schluessel.startsWith(OHNE_IP)) meldeOhneIp(zustand)
  const bremse: DbBremse = { zweck: AUTH_BREMSE_ZWECK, max: regel.max, fensterMs: regel.window * 1000 }
  let zaehler: number
  try {
    const [stand] = await mitFrist(zaehleVersuche([{ bremse, merkmal: schluessel }], jetzt), DB_BREMSE_ZEITLIMIT_MS)
    zaehler = stand
  } catch (err) {
    meldeAusfall(err, jetzt, zustand)
    zaehler = zaehleImSpeicher(zustand.ersatz, schluessel, bremse.fensterMs, jetzt)
  }
  if (innerhalbDerGrenze(zaehler, regel.max)) return { allowed: true, retryAfter: null }
  return { allowed: false, retryAfter: sekundenBisFensterEnde(jetzt, bremse.fensterMs) }
}

/**
 * Für `rateLimit.customStorage`. `get`/`set` ruft Better Auth nur für einen
 * Speicher OHNE `consume` (rate-limiter/index.mjs, legacyConsume); der Typ
 * verlangt sie trotzdem. Sie lesen und schreiben den Ersatz im Arbeitsspeicher
 * — fiele `consume` je weg, zählte die Instanz für sich, nie offen.
 */
export const AUTH_BREMS_SPEICHER: BetterAuthRateLimitStorage = {
  get: async (schluessel) => {
    const eintrag = ZUSTAND_DIESER_INSTANZ.ersatz.get(schluessel)
    return eintrag ? { key: schluessel, count: eintrag.zaehler, lastRequest: eintrag.fensterStartMs } : null
  },
  set: async (schluessel, stand) => {
    const { ersatz } = ZUSTAND_DIESER_INSTANZ
    if (!ersatz.has(schluessel)) platzSchaffen(ersatz, Date.now())
    ersatz.set(schluessel, { fensterStartMs: stand.lastRequest, zaehler: stand.count, ablaufMs: stand.lastRequest + SET_AUFBEWAHRUNG_MS })
  },
  consume: (schluessel, regel) => verbrauche(schluessel, regel),
}
