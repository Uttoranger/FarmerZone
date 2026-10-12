// Gründungshöfe: Die ersten freigeschalteten Höfe der Plattform laufen bis zu
// einem Enddatum als Hofladen ohne Grundgebühr (Register K2), danach gilt die
// normale Regel (E6-Ergänzung) — nie eine eigene Provision für „danach".
//
// Der Platz wird BERECHNET, nicht gespeichert — kein Schema-Feld. Damit kann
// er nicht mit der Wirklichkeit auseinanderlaufen, und ein zurückgenommener
// oder stillgelegter Hof gibt seinen Platz automatisch wieder frei.
// Gespeichert ist seit Nr. 62 nur das Enddatum je Hof (Farm.gruendungBis,
// DATE); null heißt Standard. Wirksam ist es nur mit Platz (bestimmeGruendungBis).
//
// Wer den Standard ändert, schreibt vorher bestehende Zusagen je Hof fest (Migration mit Freigabe).
//
// GELTUNGSBEREICH: Diese Datei speist den Admin-Bereich, die öffentliche
// Konditionen-Seite (Aufnahme-Schritte) und über den Lader ladeGruendungBis
// (src/server/queries/admin.ts) Tarif-Zeile und „Deine Konditionen" des Hofs.
// Die Gebührenberechnung bleibt unberührt (platformFeePercent steht auf 0).
//
// REGEL FÜR ANZEIGEN: Zahlen und Datum kommen aus den Konstanten unten, nie
// als Literal in eine Seite. Eine Zahl, die an zwei Orten steht, steht früher
// oder später verschieden da — und bei Konditionen ist das kein Schönheitsfehler.

import { baueGruendungsZusage, ONLINE_ZAHLUNG_START_SCHRITT } from '@/lib/konditionen'
import { formatDatumLang } from '@/lib/format'
import { kalendertagInWien } from '@/lib/wiener-tag'

export const MAX_GRUENDUNGSHOEFE = 12

/**
 * Bis einschließlich dieses Wiener Kalendertags läuft ein Gründungshof ohne
 * eigenes Datum (Register K2: Standard 31.12.2027). Wie `TARIFE_AB_TAG` das
 * EINZIGE Exemplar dieses Datums im Code; alles andere leitet sich ab.
 */
export const GRUENDUNG_BIS_STANDARD_TAG = '2027-12-31'

/**
 * Ein Kalendertag (JJJJ-MM-TT) → der Wert, den die DATE-Spalte
 * `Farm.gruendungBis` speichert und liefert: Mitternacht UTC (wie `teilenTag`).
 * Gelesen wird er nur über den Wiener Kalendertag (`kalendertagInWien`), nie
 * als Zeitpunkt — um 0:30 Uhr in Wien ist es in UTC noch gestern.
 */
export function bildeGruendungBis(kalendertag: string): Date {
  return new Date(`${kalendertag}T00:00:00.000Z`)
}

/** Der Standard in derselben Form wie die Spalte. */
export const GRUENDUNG_BIS_STANDARD: Date = bildeGruendungBis(GRUENDUNG_BIS_STANDARD_TAG)

/** „31. Dezember 2027" — wie die Tarif-Zeile und „Dein Stand" das Datum schreiben. */
export const GRUENDUNG_BIS_STANDARD_TEXT = formatDatumLang(GRUENDUNG_BIS_STANDARD)

/**
 * Die Zusage eines Gründungshofs in einem Satz, z. B. im Freischalt-Dialog mit
 * dem Standard. Der Wortlaut steht NUR in konditionen.ts
 * (`baueGruendungsZusage`, Register K2); „Dein Stand" nimmt ihn von dort.
 */
export function gruendungsKonditionenText(datum: Date): string {
  return baueGruendungsZusage(datum)
}

// === TEXTBAUSTEINE DER KONDITIONEN-SEITE ===

/** Der Weg auf die Plattform, in vier Schritten — durchgängig automatisch,
 *  nur die Freischaltung selbst ist ein bewusster Handgriff des Betreibers.
 *  Die Online-Zahlung gehört zum Start (Register Z1), Satz aus konditionen.ts. */
export const GRUENDUNGS_AUFNAHME_SCHRITTE = [
  {
    titel: 'Registrieren',
    text: 'Dauert zwei Minuten — Name, E-Mail, Passwort, und du kannst sofort loslegen.',
  },
  {
    titel: 'Hof einrichten',
    text: 'Produkte, Fotos, Abholzeiten. Alles geht schon vor der Freischaltung, in Ruhe.',
  },
  ONLINE_ZAHLUNG_START_SCHRITT,
  {
    titel: 'Freischaltung',
    text: 'Der Betreiber prüft kurz — du bekommst automatisch eine E-Mail, sobald dein Hof öffentlich ist.',
  },
] as const

/** Beschriftung eines belegten Platzes, z. B. „Gründungshof Nr. 3". */
export function gruendungshofLabel(platz: number): string {
  return `Gründungshof Nr. ${platz}`
}

/** Beschriftung für einen freigeschalteten Hof ohne Gründungsplatz. */
export const KEIN_GRUENDUNGSPLATZ = 'kein Gründungsplatz'

/**
 * Ein Hof, so wie ihn die Platzvergabe braucht. Bewusst schmal gehalten, damit
 * die Funktionen rein und ohne Datenbank testbar bleiben — `AdminFarmRow`
 * erfüllt diese Form bereits.
 */
export type HofFuerPlatz = {
  id: string
  approvedAt: Date | null
  createdAt: Date
  archivedAt: Date | null
}

/**
 * Vergibt die Gründungsplätze.
 *
 * Es zählen nur freigeschaltete und nicht stillgelegte Höfe. Ein stillgelegter
 * Hof belegt keinen Platz — sonst blockierte ein aufgegebener Hof dauerhaft
 * eine Zusage, die niemand mehr nutzt; die nachfolgenden Höfe rücken auf.
 *
 * Sortiert wird nach `approvedAt` aufsteigend; bei gleichem Zeitpunkt
 * entscheidet `createdAt`, danach die `id`. Diese doppelte Rückfallebene ist
 * kein Zierrat: Die Migration aus #47 hat allen Bestandshöfen denselben
 * Freigabezeitpunkt eingetragen (Backfill), und auch zwei Freischaltungen in
 * derselben Sekunde sind möglich. Ohne stabilen Tiebreak wäre die Vergabe bei
 * jedem Seitenaufruf eine andere.
 *
 * @returns Map von Hof-ID auf Platznummer (1-basiert), nur für Höfe im Rennen.
 */
export function gruendungsplaetze(hoefe: HofFuerPlatz[]): Map<string, number> {
  const imRennen = hoefe
    .filter((h): h is HofFuerPlatz & { approvedAt: Date } => h.approvedAt !== null && h.archivedAt === null)
    .sort((a, b) => {
      const nachFreigabe = a.approvedAt.getTime() - b.approvedAt.getTime()
      if (nachFreigabe !== 0) return nachFreigabe
      const nachAnlage = a.createdAt.getTime() - b.createdAt.getTime()
      if (nachAnlage !== 0) return nachAnlage
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    })

  return new Map(imRennen.map((h, i) => [h.id, i + 1]))
}

/** Platz eines einzelnen Hofes, oder null wenn er nicht im Rennen ist. */
export function gruendungsplatzVon(hofId: string, hoefe: HofFuerPlatz[]): number | null {
  return gruendungsplaetze(hoefe).get(hofId) ?? null
}

/** true, wenn der Hof einen der Gründungsplätze belegt (Platz <= 12). */
export function istGruendungshof(hofId: string, hoefe: HofFuerPlatz[]): boolean {
  const platz = gruendungsplatzVon(hofId, hoefe)
  return platz !== null && platz <= MAX_GRUENDUNGSHOEFE
}

/** Wie viele der Plätze vergeben sind — höchstens MAX_GRUENDUNGSHOEFE. */
export function vergebeneGruendungsplaetze(hoefe: HofFuerPlatz[]): number {
  return Math.min(gruendungsplaetze(hoefe).size, MAX_GRUENDUNGSHOEFE)
}

/**
 * Bekäme ein noch wartender Hof bei sofortiger Freischaltung einen Platz?
 * Für den Bestätigungsdialog. Die 12 sind eine KONDITIONS-Grenze, keine
 * Zugangsgrenze — Freischalten bleibt in jedem Fall möglich.
 */
export function bekaemePlatzBeiFreigabe(hoefe: HofFuerPlatz[]): boolean {
  return vergebeneGruendungsplaetze(hoefe) < MAX_GRUENDUNGSHOEFE
}

// === GRÜNDUNGS-ENDDATUM JE HOF (Register K2, Nr. 62) ===

/** Ein Hof, wie das Enddatum ihn braucht: Kennung und die Spalte (null = Standard). */
export type HofMitGruendungBis = { id: string; gruendungBis: Date | null }

/**
 * Das wirksame Gründungs-Enddatum eines Hofs: mit Gründungsplatz (Platz ≤ 12)
 * sein eigenes Datum oder der Standard, ohne Platz null — dann gilt die
 * normale Regel. `hoefe` ist die Liste der Platzvergabe; steht der Hof nicht
 * darin, hat er keinen Platz.
 */
export function bestimmeGruendungBis(hof: HofMitGruendungBis, hoefe: HofFuerPlatz[]): Date | null {
  return istGruendungshof(hof.id, hoefe) ? (hof.gruendungBis ?? GRUENDUNG_BIS_STANDARD) : null
}

/**
 * Verkürzt `neu` die Zusage gegenüber `bisher`? Ein früherer Tag geht nur mit
 * Zustimmung des Hofs (Register K1: zugesagte Konditionen bleiben). Verglichen
 * wird der Wiener Kalendertag, nie der Zeitpunkt.
 */
export function verkuerztGruendung(bisher: Date | null, neu: Date | null): boolean {
  return bisher !== null && neu !== null && verkuerztGruendungTag(kalendertagInWien(bisher), kalendertagInWien(neu))
}

/**
 * Dieselbe Regel auf Kalendertagen — für den Dialog, der Tage aus dem Feld
 * hat. JJJJ-MM-TT vergleicht sich als Text wie als Datum; ein unlesbarer Text
 * (Browser ohne Datumsfeld) verkürzt nichts, den lehnt der Server ab.
 */
export function verkuerztGruendungTag(bisherTag: string, neuTag: string): boolean {
  return neuTag < bisherTag
}

/** Was die Admin-Liste je Gründungshof zeigt — fertig als Text, die Liste ist eine Client-Komponente. */
export type GruendungAnzeige = {
  /** Das wirksame Datum als Wiener Kalendertag JJJJ-MM-TT (Vorbelegung im Dialog). */
  bisTag: string
  /** Lang geschrieben wie in „Dein Stand", z. B. „31. Dezember 2027". */
  bisText: string
  /** true = eigenes Datum am Hof, false = Standard. */
  abweichend: boolean
}

/** Spalte der Admin-Liste, Zeile der Karte und Titel des Dialogs. */
export const GRUENDUNG_BIS_TITEL = 'Gründungshof bis'

/** Die Marke neben dem Datum in der Admin-Liste. */
export const GRUENDUNG_BIS_MARKE = { standard: 'Standard', abweichend: 'abweichend' } as const

/** Die Texte des Dialogs „Gründungshof bis" im Admin. */
export const GRUENDUNG_BIS_DIALOG = {
  feld: 'Letzter Tag als Gründungshof',
  leer: `Leer = Standard (${GRUENDUNG_BIS_STANDARD_TEXT})`,
  zuruecksetzen: 'Auf Standard zurücksetzen',
  zustimmung: 'Nur mit Zustimmung des Hofs (K1)',
  frueher: (bisherText: string): string => `Das neue Ende liegt vor dem bisherigen (${bisherText}).`,
  zugestimmt: 'Der Hof hat dem früheren Ende zugestimmt.',
} as const

/** Die Anzeige des wirksamen Datums; null ohne Gründungsplatz. */
export function baueGruendungAnzeige(hof: HofMitGruendungBis, hoefe: HofFuerPlatz[]): GruendungAnzeige | null {
  const bis = bestimmeGruendungBis(hof, hoefe)
  if (bis === null) return null
  return { bisTag: kalendertagInWien(bis), bisText: formatDatumLang(bis), abweichend: hof.gruendungBis !== null }
}
