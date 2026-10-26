import type { KaufSperre } from '@/lib/bereiche-anzeige'

/*
 * Die Notbremse „Bestellungen anhalten“ (Register N34, Nr. 189): Der Admin hält
 * neue Bestellungen auf ALLEN Höfen an — mit Grund (nur für ihn und das
 * Protokoll), Satz für die Kundschaft und spätestem Ende. Laufende
 * Bestellungen, Abholung, Status und Storno durch den Hof bleiben unberührt.
 *
 * Rein und ohne Datenbank (tests/notbremse.test.ts); kein Zod, weil das Band
 * und die Kaufknöpfe der Kundenseiten diese Datei im Browser laden (Nr. 196).
 * Die Eingabe prüft die Action (src/server/actions/notbremse.ts).
 *
 * Gespeichert ist sie in den vier Feldern `bestellstopp*` der einen Zeile
 * PlattformEinstellung (Nr. 188). Ob sie gilt, entscheidet `bestellstoppAktiv`
 * beim LESEN mit der Uhr des Lesers: Nach „bis“ endet sie von selbst, ohne
 * Cron und ohne Schreiben (wie die Frist einer Reservierung).
 */

/** Die Gründe der Liste — `wert` geht in die Datenbank, `label` ins Protokoll und ins Formular (Mockup mobil-admin-notbremse). */
export const NOTBREMSE_GRUENDE = [
  { wert: 'zahlungen', label: 'Zahlungen gestört (Stripe)' },
  { wert: 'kasse', label: 'Fehler in der Kasse' },
  { wert: 'wartung', label: 'Wartung' },
  { wert: 'sonstiges', label: 'Sonstiges' },
] as const

export type NotbremseGrund = (typeof NOTBREMSE_GRUENDE)[number]['wert']

export const NOTBREMSE_GRUND_WERTE = NOTBREMSE_GRUENDE.map((g) => g.wert) as [NotbremseGrund, ...NotbremseGrund[]]

/** Das Label eines gespeicherten Grunds; ein unbekannter Wert (alte Zeile) heißt „Sonstiges“. */
export function notbremseGrundLabel(wert: string): string {
  return NOTBREMSE_GRUENDE.find((g) => g.wert === wert)?.label ?? 'Sonstiges'
}

/** Vorgabe für den Satz an die Kundschaft — wörtlich aus dem Mockup; der Admin kann ihn ändern. */
export const NOTBREMSE_SATZ_VORGABE = 'Bestellen ist gerade kurz nicht möglich. Bitte versuch es in einer Stunde wieder.'

/** Höchstens so lang steht der Satz im Band — eine Zeile am Handy, zwei bis drei im Notfall. */
export const NOTBREMSE_SATZ_MAX = 200

/** „bis“ ist Pflicht und liegt höchstens 72 Stunden in der Zukunft (Freigabe Lauf 26, 189 Punkt 1). */
export const NOTBREMSE_HOECHSTENS_MS = 72 * 60 * 60 * 1000

/** Die festen Sätze der Action — Deutsch, geduzt, ohne Fachbegriffe. */
export const NOTBREMSE_FEHLER = {
  ungueltig: 'Wir konnten die Eingabe nicht lesen. Lade die Seite neu und versuch es noch einmal.',
  grund: 'Wähl einen Grund aus der Liste.',
  satz: `Schreib einen Satz für die Kundschaft (höchstens ${NOTBREMSE_SATZ_MAX} Zeichen).`,
  satzPerson: 'Schreib den Satz ohne E-Mail-Adresse und ohne Telefonnummer.',
  bis: 'Wähl, bis wann die Bestellungen angehalten sind.',
  vorbei: 'Dieser Zeitpunkt ist schon vorbei. Wähl einen späteren.',
  zuLang: 'Höchstens 72 Stunden – danach musst du die Notbremse neu setzen.',
  speichern: 'Wir konnten die Notbremse nicht speichern. Versuch es noch einmal.',
} as const

/**
 * Was die Seiten und die Prüfkette von der Zeile brauchen — reines JSON
 * (ISO-Text statt Date), weil `unstable_cache` es so speichert.
 */
export type BestellstoppStand = { ab: string; bis: string; grund: string; satz: string }

/** Was die Kundschaft sieht, solange die Notbremse gilt. */
export type Bestellstopp = { satz: string; bis: string }

/** Die vier Felder der Zeile → Stand; null, wenn keine Notbremse gesetzt ist (oder ein Feld fehlt). */
export function bestellstoppAus(zeile: {
  bestellstoppAb: Date | null
  bestellstoppBis: Date | null
  bestellstoppGrund: string | null
  bestellstoppSatz: string | null
}): BestellstoppStand | null {
  const { bestellstoppAb: ab, bestellstoppBis: bis, bestellstoppGrund: grund, bestellstoppSatz: satz } = zeile
  if (ab === null || bis === null || satz === null || satz.trim() === '') return null
  return { ab: ab.toISOString(), bis: bis.toISOString(), grund: grund ?? 'sonstiges', satz }
}

/**
 * Gilt die Notbremse JETZT? Ab „ab“ (einschließlich) bis vor „bis“. Die Frist
 * gilt beim Lesen — eine abgelaufene Notbremse ist aus, auch wenn die Felder
 * noch gefüllt sind.
 */
export function bestellstoppAktiv(stand: BestellstoppStand | null, jetzt: Date): Bestellstopp | null {
  if (stand === null) return null
  const ab = Date.parse(stand.ab)
  const bis = Date.parse(stand.bis)
  if (Number.isNaN(ab) || Number.isNaN(bis)) return null
  const t = jetzt.getTime()
  return t >= ab && t < bis ? { satz: stand.satz, bis: stand.bis } : null
}

/** Welche Prüfung „bis“ nicht besteht — null, wenn es passt (nach `jetzt`, höchstens 72 h danach). */
export function notbremseBisFehler(bis: Date, jetzt: Date): string | null {
  const t = bis.getTime()
  if (Number.isNaN(t)) return NOTBREMSE_FEHLER.bis
  if (t <= jetzt.getTime()) return NOTBREMSE_FEHLER.vorbei
  if (t - jetzt.getTime() > NOTBREMSE_HOECHSTENS_MS) return NOTBREMSE_FEHLER.zuLang
  return null
}

// Wiener Zeit, wie die Kundschaft sie liest: „Mo., 26.10., 11:00“.
const BIS_FORMAT = new Intl.DateTimeFormat('de-AT', {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Vienna',
})

/** „bis Mo., 26.10., 11:00 Uhr“ — das späteste Ende im Band. */
export function bestellstoppBisText(bis: string): string {
  return `bis ${BIS_FORMAT.format(new Date(bis))} Uhr`
}

/**
 * Für Kaufknopf und Produktkarte zählt die Notbremse wie eine Sperre ohne
 * Termin: Der Knopf ruht mit „Nicht bestellbar“, der Korb bleibt. Den Grund
 * sagen Band und `BestellstoppHinweis` — das Ergebnis darum NIE an
 * `KaufSperreHinweis` geben (der spräche von fehlender Abholzeit). Eine Sperre
 * des Hofs (Pause …) geht vor, sie bleibt nach dem Freigeben bestehen.
 */
export function sperreMitBestellstopp(sperre: KaufSperre, stopp: Bestellstopp | null): KaufSperre {
  if (sperre !== null || stopp === null) return sperre
  return 'keine-abholzeit'
}

/** Die Wörter der Kundenseiten (Register N8: „Notbremse“, „Bestellungen anhalten“ nur im Admin). */
export const BESTELLSTOPP_TEXT = {
  titel: 'Bestellen geht gerade nicht.',
} as const

/** Woher das Band der Kundenseiten die Notbremse holt (src/app/api/notbremse/route.ts). */
export const NOTBREMSE_PFAD = '/api/notbremse'

/**
 * Die Antwort von GET /api/notbremse → Notbremse oder null. Ohne Zod (Browser
 * der Kundenseiten, Nr. 196): nur `{ stopp: { satz, bis } }` mit Text und
 * lesbarer Zeit zählt, alles andere heißt „kein Band“.
 */
export function bestellstoppAusAntwort(daten: unknown): Bestellstopp | null {
  if (typeof daten !== 'object' || daten === null) return null
  const stopp: unknown = (daten as { stopp?: unknown }).stopp
  if (typeof stopp !== 'object' || stopp === null) return null
  const { satz, bis } = stopp as { satz?: unknown; bis?: unknown }
  if (typeof satz !== 'string' || satz.trim() === '' || typeof bis !== 'string' || Number.isNaN(Date.parse(bis))) return null
  return { satz, bis }
}
