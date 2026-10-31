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
//
// SEIT NR. 93 (Register K2-Ergänzung „Gründungshöfe sichtbar"): Plätze gesamt,
// Standard-Ende und Anzeige stehen in Admin › Einstellungen
// (PlattformEinstellung, src/lib/plattform-einstellung.ts). MAX_GRUENDUNGSHOEFE
// und GRUENDUNG_BIS_STANDARD_TAG sind deren Standardwerte. Die Funktionen hier
// bleiben rein: Wer die Einstellung braucht, bekommt sie als Parameter
// (`plaetze`, `GruendungEinstellung`) — ohne Parameter gilt der Standard, so
// laufen die Aufrufer von vor Nr. 93 unverändert.
//
// SEIT NR. 116 (Register K2, Änderung 19.10.2026, Aktion „100 Gründungshöfe“):
// Platz und Ende werden je Hof FESTGESCHRIEBEN (Farm.gruendungPlatz,
// Farm.gruendungBis) — einmal für alle per Admin-Aktion „Zusagen
// festschreiben“, danach bei jeder Freischaltung (kleinste freie Nummer,
// Ende nach `zusageEnde`). Bis dahin (PlattformEinstellung.gruendungFestAm
// leer) gilt alles oben unverändert. Ab dann zählen die gespeicherten Plätze,
// nicht mehr die Reihenfolge: Stilllegen, Wieder-Aktivieren und Freigabe
// entziehen nehmen keinem Hof seinen Platz. Welche Vergabe gilt, steht an
// jeder Zeile der Platzvergabe (`gruendungFest`, gesetzt von den Ladern).

import { baueGruendungsZusage, grundgebuehrText, KOSTENLOS, MONATLICH_KUENDBAR, ONLINE_ZAHLUNG_START_SCHRITT, TARIFE_AB_TAG, TARIFE_AB_TEXT, tarifText } from '@/lib/konditionen'
import { formatDatumLang } from '@/lib/format'
import { MARKE } from '@/lib/marke'
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
  /**
   * Aus der Vergabe genommen (Register K2, Ergänzung 16.10.2026, Nr. 109) —
   * Pflichtfeld, damit kein Aufrufer es vergisst: Die Höfe kommen nur aus
   * HOF_FUER_GRUENDUNG oder dem Select von getAdminFarms (Wache
   * tests/gruendung-ausgenommen-wache.test.ts).
   */
  gruendungAusgenommen: boolean
  /** Der festgeschriebene Platz (Farm.gruendungPlatz, Nr. 116) — zählt nur mit `gruendungFest`. */
  gruendungPlatz?: number | null
  /**
   * Sind die Zusagen festgeschrieben (PlattformEinstellung.gruendungFestAm,
   * Nr. 116)? Die Lader (HOF_FUER_GRUENDUNG, getAdminFarms) setzen es an jeder
   * Zeile gleich — so rechnet jede Regel mit derselben Vergabe, auch wo ein
   * Aufrufer die Einstellung nicht kennt (Admin › Höfe, Finanzen). Fehlt es:
   * Reihenfolge wie vor Nr. 116.
   */
  gruendungFest?: boolean
  /**
   * Die Plätze der Einstellung (PlattformEinstellung.gruendungPlaetze) — von
   * den Ladern an jede Zeile gesetzt wie `gruendungFest`. Vor dem Festschreiben
   * lassen sich die Plätze schon erhöhen; ohne diese Zahl rechneten Tarif-Zeile,
   * „Dein Stand“ und Admin › Höfe weiter mit 12, die Gründungs-Nachricht aber
   * mit der Einstellung. Fehlt sie: der Standard.
   */
  gruendungPlaetze?: number
}

/** Gilt die festgeschriebene Vergabe? Die Lader setzen das Kennzeichen an allen Zeilen gleich. */
export function vergabeFest(hoefe: readonly HofFuerPlatz[]): boolean {
  return hoefe.some((h) => h.gruendungFest === true)
}

/** Die Plätze der Einstellung, wie die Lader sie an die Zeilen schreiben — ohne: der Standard (MAX_GRUENDUNGSHOEFE). */
export function plaetzeDerVergabe(hoefe: readonly HofFuerPlatz[]): number {
  return hoefe.find((h) => h.gruendungPlaetze !== undefined)?.gruendungPlaetze ?? MAX_GRUENDUNGSHOEFE
}

/** Die Reihenfolge der Freischaltung: `approvedAt`, dann `createdAt`, dann `id` (siehe gruendungsplaetze). */
function nachReihenfolge(a: HofFuerPlatz & { approvedAt: Date }, b: HofFuerPlatz & { approvedAt: Date }): number {
  const nachFreigabe = a.approvedAt.getTime() - b.approvedAt.getTime()
  if (nachFreigabe !== 0) return nachFreigabe
  const nachAnlage = a.createdAt.getTime() - b.createdAt.getTime()
  if (nachAnlage !== 0) return nachAnlage
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/**
 * Vergibt die Gründungsplätze.
 *
 * Es zählen nur freigeschaltete und nicht stillgelegte Höfe. Ein stillgelegter
 * Hof belegt keinen Platz — sonst blockierte ein aufgegebener Hof dauerhaft
 * eine Zusage, die niemand mehr nutzt; die nachfolgenden Höfe rücken auf.
 * Ebenso ein ausgenommener Hof (Register K2, Nr. 109, etwa ein Testhof).
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
export function gruendungsplaetze(hoefe: readonly HofFuerPlatz[]): Map<string, number> {
  // Festgeschrieben (Nr. 116): der gespeicherte Platz — auch eines stillgelegten
  // oder zurückgenommenen Hofs, er hält ihn (K2). Ausgenommene haben keinen.
  if (vergabeFest(hoefe)) {
    return new Map(
      hoefe.flatMap((h) => (h.gruendungPlatz !== null && h.gruendungPlatz !== undefined && !h.gruendungAusgenommen ? [[h.id, h.gruendungPlatz] as const] : []))
    )
  }
  const imRennen = hoefe
    .filter((h): h is HofFuerPlatz & { approvedAt: Date } => h.approvedAt !== null && h.archivedAt === null && !h.gruendungAusgenommen)
    .sort(nachReihenfolge)

  return new Map(imRennen.map((h, i) => [h.id, i + 1]))
}

/** Platz eines einzelnen Hofes, oder null wenn er nicht im Rennen ist. */
export function gruendungsplatzVon(hofId: string, hoefe: readonly HofFuerPlatz[]): number | null {
  return gruendungsplaetze(hoefe).get(hofId) ?? null
}

/** true, wenn der Hof einen der Gründungsplätze belegt (Platz <= `plaetze`, Standard: die Plätze an den Zeilen). */
export function istGruendungshof(hofId: string, hoefe: readonly HofFuerPlatz[], plaetze: number = plaetzeDerVergabe(hoefe)): boolean {
  const platz = gruendungsplatzVon(hofId, hoefe)
  // Festgeschrieben IST der Platz die Zusage — nie gegen eine Zahl geprüft (die Plätze wachsen nur).
  return platz !== null && (vergabeFest(hoefe) || platz <= plaetze)
}

/** Wie viele der Plätze vergeben sind — höchstens `plaetze` (Standard: die Plätze an den Zeilen); festgeschrieben alle gespeicherten. */
export function vergebeneGruendungsplaetze(hoefe: readonly HofFuerPlatz[], plaetze: number = plaetzeDerVergabe(hoefe)): number {
  const vergeben = gruendungsplaetze(hoefe).size
  return vergabeFest(hoefe) ? vergeben : Math.min(vergeben, plaetze)
}

/**
 * Bekäme ein noch wartender Hof bei sofortiger Freischaltung einen Platz?
 * Für den Bestätigungsdialog. Die Plätze sind eine KONDITIONS-Grenze, keine
 * Zugangsgrenze — Freischalten bleibt in jedem Fall möglich.
 */
export function bekaemePlatzBeiFreigabe(hoefe: readonly HofFuerPlatz[], plaetze: number = plaetzeDerVergabe(hoefe)): boolean {
  return vergebeneGruendungsplaetze(hoefe, plaetze) < plaetze
}

// === GRÜNDUNGS-ENDDATUM JE HOF (Register K2, Nr. 62) ===

/** Ein Hof, wie das Enddatum ihn braucht: Kennung und die Spalte (null = Standard). */
export type HofMitGruendungBis = { id: string; gruendungBis: Date | null }

/**
 * Das wirksame Gründungs-Enddatum eines Hofs: mit Gründungsplatz (Platz ≤ den
 * Plätzen an den Zeilen, `plaetzeDerVergabe`) sein eigenes Datum oder der Standard, ohne Platz null — dann gilt die
 * normale Regel. `hoefe` ist die Liste der Platzvergabe; steht der Hof nicht
 * darin, hat er keinen Platz.
 */
export function bestimmeGruendungBis(hof: HofMitGruendungBis, hoefe: readonly HofFuerPlatz[]): Date | null {
  return istGruendungshof(hof.id, hoefe) ? wirksamesGruendungBis(hof.gruendungBis) : null
}

/**
 * Das Ende eines Hofs MIT Platz: sein gespeichertes oder der Standard. Eine
 * Regel für Konditionen (`bestimmeGruendungBis`) und Gründungs-Nachricht
 * (`zusageBeiFreischaltung`) — sonst nennte die Nachricht ein anderes Datum,
 * als „Dein Stand“ zeigt (K1).
 */
function wirksamesGruendungBis(gruendungBis: Date | null): Date {
  return gruendungBis ?? GRUENDUNG_BIS_STANDARD
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
  /** Das Standard-Ende als Kalendertag — ein leeres Feld im Dialog heißt „Standard“. */
  standardTag: string
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
export function baueGruendungAnzeige(hof: HofMitGruendungBis, hoefe: readonly HofFuerPlatz[]): GruendungAnzeige | null {
  const bis = bestimmeGruendungBis(hof, hoefe)
  if (bis === null) return null
  return { bisTag: kalendertagInWien(bis), bisText: formatDatumLang(bis), abweichend: hof.gruendungBis !== null, standardTag: GRUENDUNG_BIS_STANDARD_TAG }
}

// === GRÜNDUNGSHÖFE SICHTBAR (Register K2-Ergänzung, Nr. 93) ===

/**
 * Was die Fachregeln aus Admin › Einstellungen brauchen: Plätze gesamt, das
 * Standard-Ende (Wert der DATE-Spalte, Mitternacht UTC) und ob die Seiten es
 * zeigen; seit Nr. 116 die Aktion: Monate je neuer Zusage, Stichtag „Aktion
 * bis“ (Wiener Kalendertag, null = ohne) und wann festgeschrieben wurde (null
 * = noch nicht). Die Abfrage baut sie aus der Zeile (gruendungEinstellungAus
 * in src/lib/plattform-einstellung.ts).
 */
export type GruendungEinstellung = {
  plaetze: number
  bis: Date
  anzeige: boolean
  monate: number
  aktionBisTag: string | null
  festAm: Date | null
}

/** Monate ohne Grundgebühr je neuer Zusage, solange niemand etwas anderes einträgt (Spalten-Standard). */
export const GRUENDUNG_MONATE_STANDARD = 24

/** Ohne Einstellung gelten die Konstanten — wie vor Nr. 93; nicht festgeschrieben. */
export const GRUENDUNG_EINSTELLUNG_STANDARD: GruendungEinstellung = {
  plaetze: MAX_GRUENDUNGSHOEFE,
  bis: GRUENDUNG_BIS_STANDARD,
  anzeige: true,
  monate: GRUENDUNG_MONATE_STANDARD,
  aktionBisTag: null,
  festAm: null,
}

/** Ab so vielen vergebenen Plätzen zeigen die Seiten den Zähler „Noch n von m“ (Register K2, Änderung Nr. 116). */
export const GRUENDUNG_ZAEHLER_AB = 10

/**
 * Was Startseite, /fuer-hoefe, Registrieren und die Hofseite zeigen — fertig
 * vom Server, nur Zahlen und Text, damit es auch an eine Client-Komponente
 * gehen darf. `bisTag` ist der Wiener Kalendertag JJJJ-MM-TT des
 * Standard-Endes (Sätze vor dem Festschreiben). `art` sagt, welche Sätze
 * gelten: 'bisher' vor dem Festschreiben, 'aktion' danach.
 */
export type GruendungSeiten = {
  zeigen: boolean
  frei: number
  gesamt: number
  bisTag: string
  /** „Du wärst voraussichtlich Gründungshof Nr. k" — null, wenn der Satz nicht stimmen könnte. */
  voraussichtlicherPlatz: number | null
  art: 'bisher' | 'aktion'
  /** Der Zähler „Noch n von m“ — bisher immer mit `zeigen`, in der Aktion erst ab GRUENDUNG_ZAEHLER_AB vergebenen. */
  zaehler: boolean
  monate: number
  /** Stichtag der Aktion als Wiener Kalendertag, null = ohne. */
  aktionBisTag: string | null
  /** Läuft die Aktion (`aktionLaeuft`) — unabhängig von der Anzeige; vor dem Festschreiben immer false. */
  aktionLaeuft: boolean
}

/** Die Zahlen der Seiten ohne den Satz beim Registrieren. */
export type GruendungZahlen = Omit<GruendungSeiten, 'voraussichtlicherPlatz'>

/** Die Plätze, die schon vergeben sind (festgeschrieben: die gespeicherten Nummern). */
function vergebeneNummern(hoefe: readonly HofFuerPlatz[]): Set<number> {
  return new Set(gruendungsplaetze(hoefe).values())
}

/**
 * Die Zahlen der Seiten (Register K2-Ergänzung): frei = Plätze gesamt −
 * vergeben. Vor dem Festschreiben gezeigt nur mit Anzeige an, mindestens einem
 * freien Platz und einem Ende, das heute (Wiener Tag) noch nicht vorbei ist —
 * sonst nichts, nie „0 von 12" (Punkt 5 der Entscheidung). Danach nur, solange
 * die Aktion läuft (`aktionLaeuft`) und die Anzeige an ist.
 */
export function fuerSeiten(einstellung: GruendungEinstellung, hoefe: readonly HofFuerPlatz[], jetzt: Date): GruendungZahlen {
  return seitenZahlen(einstellung, gruendungsplaetze(hoefe).size, jetzt)
}

/**
 * Dieselbe Regel aus der Zahl der vergebenen Plätze (vor dem Festschreiben:
 * Höfe im Rennen, freigeschaltet und nicht stillgelegt) — für die Vorschau in
 * Admin › Einstellungen, die keine Hofliste in den Browser schickt. Der
 * Schalter „Anzeige“ steuert nur `zeigen`, nie die Vergabe.
 */
export function seitenZahlen(einstellung: GruendungEinstellung, vergeben: number, jetzt: Date): GruendungZahlen {
  const gesamt = Math.max(einstellung.plaetze, 0)
  const frei = gesamt - Math.min(vergeben, gesamt)
  const bisTag = kalendertagInWien(einstellung.bis)
  const gemeinsam = { frei, gesamt, bisTag, monate: einstellung.monate, aktionBisTag: einstellung.aktionBisTag }
  if (einstellung.festAm === null) {
    const zeigen = einstellung.anzeige && frei > 0 && kalendertagInWien(jetzt) <= bisTag
    return { ...gemeinsam, zeigen, art: 'bisher', zaehler: zeigen, aktionLaeuft: false }
  }
  const laeuft = aktionLaeuft(jetzt, einstellung, vergeben)
  const zeigen = einstellung.anzeige && laeuft
  return { ...gemeinsam, zeigen, art: 'aktion', zaehler: zeigen && vergeben >= GRUENDUNG_ZAEHLER_AB, aktionLaeuft: laeuft }
}

/**
 * Der voraussichtliche Platz einer Registrierenden: vergeben + Höfe, die vor
 * ihr auf die Freischaltung warten, + 1 (Register K2-Ergänzung, Punkt 3) —
 * festgeschrieben die so vielte freie Nummer (Lücken nach dem Ausnehmen
 * zuerst). Läge er hinter dem letzten Platz, gibt es keinen Satz (null) —
 * „voraussichtlich Nr. 13" bei 12 Plätzen wäre falsch. Die Zusage kommt erst
 * mit der Freischaltung; warten Höfe länger oder schaltet der Betreiber in
 * anderer Reihenfolge frei, verschiebt sich die Nummer.
 */
export function voraussichtlicherPlatz(einstellung: GruendungEinstellung, hoefe: readonly HofFuerPlatz[], wartendVorDir: number): number | null {
  const gesamt = Math.max(einstellung.plaetze, 0)
  if (vergabeFest(hoefe)) return freieNummer(vergebeneNummern(hoefe), gesamt, Math.max(wartendVorDir, 0) + 1)
  const platz = vergebeneGruendungsplaetze(hoefe, gesamt) + Math.max(wartendVorDir, 0) + 1
  return platz <= gesamt ? platz : null
}

/** Beides für die Seiten in einem — der Satz beim Registrieren nur, wenn auch die übrigen Bausteine stehen. */
export function gruendungSeitenDaten(
  einstellung: GruendungEinstellung,
  hoefe: readonly HofFuerPlatz[],
  wartendVorDir: number,
  jetzt: Date
): GruendungSeiten {
  const seiten = fuerSeiten(einstellung, hoefe, jetzt)
  return { ...seiten, voraussichtlicherPlatz: seiten.zeigen ? voraussichtlicherPlatz(einstellung, hoefe, wartendVorDir) : null }
}

/** Nichts zeigen — wenn die Daten fehlen (Ladefehler, Bau ohne Datenbank). */
export const KEINE_GRUENDUNG_SEITEN: GruendungSeiten = {
  zeigen: false,
  frei: 0,
  gesamt: MAX_GRUENDUNGSHOEFE,
  bisTag: GRUENDUNG_BIS_STANDARD_TAG,
  voraussichtlicherPlatz: null,
  art: 'bisher',
  zaehler: false,
  monate: GRUENDUNG_MONATE_STANDARD,
  aktionBisTag: null,
  aktionLaeuft: false,
}

/**
 * Die Zusage bei der Freischaltung vor dem Festschreiben (Punkt 4): Platz und
 * Ende, wenn der eben freigeschaltete Hof einen der Plätze belegt — sein
 * eigenes Ende oder das Standard-Ende der Einstellung —, sonst null (dann
 * keine Nachricht). `hoefe` ist die Liste der Platzvergabe NACH der
 * Freischaltung. Festgeschrieben gilt `zusageBeiFreischaltung`.
 */
export function gruendungsZusageBeiFreigabe(
  hof: HofMitGruendungBis,
  hoefe: readonly HofFuerPlatz[],
  einstellung: GruendungEinstellung
): { platz: number; bis: Date } | null {
  const platz = gruendungsplatzVon(hof.id, hoefe)
  if (platz === null || platz > einstellung.plaetze) return null
  return { platz, bis: hof.gruendungBis ?? einstellung.bis }
}

/** „31.12.2027" — der Kalendertag in Ziffern, wie in der Hofladen-Karte; ohne Intl, damit es überall gleich aussieht. */
export function gruendungTagKurz(kalendertag: string): string {
  const [jahr, monat, tag] = kalendertag.split('-')
  return `${tag}.${monat}.${jahr}`
}

/** „31. Dezember 2027" aus dem Kalendertag — über den gemeinsamen Formatierer. */
export function gruendungTagLang(kalendertag: string): string {
  return formatDatumLang(bildeGruendungBis(kalendertag))
}

// === AKTION „100 GRÜNDUNGSHÖFE“ (Register K2, Änderung 19.10.2026, Nr. 116) ===

function zweistellig(n: number): string {
  return String(n).padStart(2, '0')
}

/** Der spätere von zwei Kalendertagen JJJJ-MM-TT (als Text vergleichbar wie als Datum). */
export function spaetererTag(a: string, b: string): string {
  return a > b ? a : b
}

/**
 * Das Ende einer neuen Zusage als Wiener Kalendertag: Beginn = der spätere Tag
 * von Tarifstart (`TARIFE_AB_TAG`) und Freischaltung, Ende = der Tag vor
 * (Beginn + `monate` Monate) — ab dem Tarifstart also der letzte Jänner zwei
 * Jahre später, ab einem 15. März der 14. März (Beispiele im Test).
 * Fehlt der Tag im Zielmonat (31. eines kurzen Monats, 29. des Februars ohne
 * Schaltjahr), endet die Zusage am letzten Tag dieses Monats: volle Monate,
 * nie einen Tag weniger (K1). Reine Kalenderrechnung ohne Uhrzeit.
 */
export function zusageEnde(freischaltungTag: string, einstellung: Pick<GruendungEinstellung, 'monate'>): string {
  const [jahr, monat, tag] = spaetererTag(freischaltungTag, TARIFE_AB_TAG).split('-').map(Number)
  const monatsIndex = monat - 1 + einstellung.monate
  const zielJahr = jahr + Math.floor(monatsIndex / 12)
  const zielMonat = (monatsIndex % 12) + 1
  const tageImZielmonat = new Date(Date.UTC(zielJahr, zielMonat, 0)).getUTCDate()
  if (tag > tageImZielmonat) return `${zielJahr}-${zweistellig(zielMonat)}-${zweistellig(tageImZielmonat)}`
  return new Date(Date.UTC(zielJahr, zielMonat - 1, tag - 1)).toISOString().slice(0, 10)
}

/**
 * Läuft die Aktion? Nur festgeschrieben (`festAm` gesetzt), vor oder am
 * Stichtag „Aktion bis“ (Wiener Tag; ohne Stichtag immer) und solange Plätze
 * frei sind. Der Schalter „Anzeige“ spielt hier keine Rolle — er steuert nur
 * die Sätze der Werbung, nie die Vergabe (Register K2).
 */
export function aktionLaeuft(heute: Date, einstellung: GruendungEinstellung, vergeben: number): boolean {
  return (
    einstellung.festAm !== null &&
    (einstellung.aktionBisTag === null || kalendertagInWien(heute) <= einstellung.aktionBisTag) &&
    vergeben < einstellung.plaetze
  )
}

/** Die `rang`-te freie Nummer von 1 bis `plaetze` (1 = die kleinste) — null, wenn es so viele nicht gibt. */
export function freieNummer(vergeben: ReadonlySet<number>, plaetze: number, rang = 1): number | null {
  let gezaehlt = 0
  for (let nummer = 1; nummer <= plaetze; nummer++) {
    if (vergeben.has(nummer)) continue
    gezaehlt++
    if (gezaehlt === rang) return nummer
  }
  return null
}

/** Die kleinste freie Nummer — so bekommt ein Hof nach dem Ausnehmen eines anderen dessen Lücke. */
export function kleinsteFreieNummer(vergeben: ReadonlySet<number>, plaetze: number): number | null {
  return freieNummer(vergeben, plaetze, 1)
}

/** Platz und Ende einer Zusage, wie die Gründungs-Nachricht sie nennt (Ende als Kalendertag). */
export type Zusage = { platz: number; bisTag: string }

/**
 * Was eine Freischaltung bzw. Wiederaufnahme nach dem Festschreiben bekommt:
 * Hat der Hof schon einen Platz (erneute Freigabe nach Entzug), bleiben Platz
 * und Ende, wie sie sind (ohne gespeichertes Ende: der Standard wie in
 * `bestimmeGruendungBis`). Sonst, wenn die Aktion läuft, die
 * kleinste freie Nummer und das Ende nach `zusageEnde` ab heute — nie kürzer
 * als ein noch gespeichertes Ende (K1). Läuft sie nicht: null (kein Platz).
 * `hoefe` ist die Liste der Platzvergabe, gelesen nach der Sperre.
 */
export function zusageBeiFreischaltung(
  hof: { id: string; gruendungPlatz: number | null; gruendungBis: Date | null },
  hoefe: readonly HofFuerPlatz[],
  einstellung: GruendungEinstellung,
  jetzt: Date
): (Zusage & { neu: boolean }) | null {
  if (hof.gruendungPlatz !== null) {
    // Nichts wird geschrieben — also nennt die Nachricht genau das Ende, das die Konditionen zeigen.
    return { platz: hof.gruendungPlatz, bisTag: kalendertagInWien(wirksamesGruendungBis(hof.gruendungBis)), neu: false }
  }
  const vergeben = vergebeneNummern(hoefe)
  if (!aktionLaeuft(jetzt, einstellung, vergeben.size)) return null
  const platz = kleinsteFreieNummer(vergeben, Math.max(einstellung.plaetze, 0))
  if (platz === null) return null
  const neuTag = zusageEnde(kalendertagInWien(jetzt), einstellung)
  const bisTag = hof.gruendungBis ? spaetererTag(kalendertagInWien(hof.gruendungBis), neuTag) : neuTag
  return { platz, bisTag, neu: true }
}

/** Der Satz zur Gründung im Freischalt-Dialog (Admin): grün mit Platz und Ende, orange ohne Platz. */
export type FreischaltHinweis = { ton: 'gruen' | 'orange'; text: string }

/**
 * Was die Freischaltung eines wartenden Hofs an Gründung bringt — dieselbe
 * Regel wie approveFarmAction (vor dem Festschreiben die Reihenfolge, danach
 * `zusageBeiFreischaltung`), mit den Plätzen der Einstellung statt der
 * Konstante. Nur ein Hinweis: Die Action rechnet nach der Sperre neu.
 */
export function freischaltHinweis(
  hof: { id: string; gruendungPlatz: number | null; gruendungBis: Date | null; gruendungAusgenommen: boolean },
  hoefe: readonly HofFuerPlatz[],
  einstellung: GruendungEinstellung,
  jetzt: Date
): FreischaltHinweis {
  const ohnePlatz = (grund: string): FreischaltHinweis => ({ ton: 'orange', text: `${grund} – dieser Hof bekommt keinen Gründungsplatz. Freischalten ist trotzdem möglich.` })
  if (hof.gruendungAusgenommen) return ohnePlatz('Der Hof ist ausgenommen')
  if (einstellung.festAm === null) {
    const platz = vergebeneGruendungsplaetze(hoefe, einstellung.plaetze) + 1
    if (platz > einstellung.plaetze) return ohnePlatz(alleGruendungsplaetzeVergeben(einstellung.plaetze))
    return { ton: 'gruen', text: `Dieser Hof belegt ${gruendungshofLabel(platz)}. ${baueGruendungsZusage(hof.gruendungBis ?? einstellung.bis)}` }
  }
  const zusage = zusageBeiFreischaltung(hof, hoefe, einstellung, jetzt)
  if (zusage === null) {
    const vergeben = gruendungsplaetze(hoefe).size
    return ohnePlatz(vergeben >= einstellung.plaetze ? alleGruendungsplaetzeVergeben(einstellung.plaetze) : 'Die Aktion ist vorbei')
  }
  const satz = zusage.neu ? `Dieser Hof belegt ${gruendungshofLabel(zusage.platz)}.` : `Dieser Hof behält ${gruendungshofLabel(zusage.platz)}.`
  return { ton: 'gruen', text: `${satz} ${baueGruendungsZusage(bildeGruendungBis(zusage.bisTag))}` }
}

/** Eine Zeile der Liste „Zusagen festschreiben“: Hof, Nummer nach heutiger Reihenfolge, Ende bisher → neu. */
export type FestschreibenZeile = {
  id: string
  name: string
  platz: number
  stillgelegt: boolean
  /** Das bisherige Ende als Kalendertag — null, wenn der Hof bisher keine Zusage hatte. */
  bisherTag: string | null
  neuTag: string
}

/**
 * Die Liste „Zusagen festschreiben“ (Register K2, Änderung Nr. 116): Einen
 * Platz bekommen alle freigeschalteten, nicht ausgenommenen Höfe in der
 * heutigen Reihenfolge bis zur Zahl der Plätze — AUCH stillgelegte (sonst
 * verlöre ein stillgelegter Hof, der heute beim Wieder-Aktivieren seinen Platz
 * zurückbekäme, ihn für immer). Neues Ende = der spätere Tag von bisherigem
 * Ende und `zusageEnde(Freischaltungstag)` — nie kürzer als bisher (K1).
 * Bisher hatte eine Zusage, wer nach der Reihenfolge einen Platz hält (sein
 * Ende oder das Standard-Ende) oder ein eigenes Ende gespeichert hat.
 */
export function festschreibenListe(hoefe: readonly HofFuerFolgen[], einstellung: GruendungEinstellung): FestschreibenZeile[] {
  const ohneFest = hoefe.map((h) => ({ ...h, gruendungFest: false }))
  const reihe = ohneFest
    .filter((h): h is HofFuerFolgen & { approvedAt: Date; gruendungFest: boolean } => h.approvedAt !== null && !h.gruendungAusgenommen)
    .sort(nachReihenfolge)
  return reihe.slice(0, Math.max(einstellung.plaetze, 0)).map((h, i) => {
    const bisher = istGruendungshof(h.id, ohneFest, einstellung.plaetze) ? (h.gruendungBis ?? einstellung.bis) : h.gruendungBis
    const bisherTag = bisher ? kalendertagInWien(bisher) : null
    const ab = zusageEnde(kalendertagInWien(h.approvedAt), einstellung)
    return { id: h.id, name: h.name, platz: i + 1, stillgelegt: h.archivedAt !== null, bisherTag, neuTag: bisherTag ? spaetererTag(bisherTag, ab) : ab }
  })
}

/**
 * Verlöre beim Festschreiben ein Hof seinen Platz? Das ginge nur, wenn
 * stillgelegte Höfe vor ihm in der Reihe stehen und die Plätze nicht reichen.
 * Dann zuerst die Plätze erhöhen (K1) — zurück kommt die nötige Zahl, sonst null.
 */
export function festschreibenBrauchtPlaetze(hoefe: readonly HofFuerFolgen[], einstellung: GruendungEinstellung): number | null {
  const ohneFest = hoefe.map((h) => ({ ...h, gruendungFest: false }))
  const reihe = ohneFest
    .filter((h): h is HofFuerFolgen & { approvedAt: Date; gruendungFest: boolean } => h.approvedAt !== null && !h.gruendungAusgenommen)
    .sort(nachReihenfolge)
  const letzterMitPlatz = reihe.reduce((letzter, h, i) => (istGruendungshof(h.id, ohneFest, einstellung.plaetze) ? i + 1 : letzter), 0)
  return letzterMitPlatz > einstellung.plaetze ? letzterMitPlatz : null
}

/** Ein Satz mit einem hervorgehobenen Teil: vor · fett · danach. */
export type GruendungSatzTeile = { vor: string; betont: string; nach: string }

/** Der Wert der Zusage: Monate × Grundgebühr des Hofladens, ganzzahlig in Cent, angezeigt in Euro („€ 456“). */
export function gruendungWertText(monate: number): string {
  return grundgebuehrText(monate * tarifText('HOFLADEN').grundgebuehrCents)
}

const HOFLADEN = tarifText('HOFLADEN')
const HOFTOR = tarifText('HOFTOR')

/** „Noch 71 von 100 Gründungsplätzen frei“ bzw. „Letzter Gründungsplatz frei“ — der Zähler im Satz. */
function zaehlerSatz(g: Pick<GruendungSeiten, 'frei' | 'gesamt'>): string {
  return g.frei === 1 ? 'Letzter Gründungsplatz frei' : `Noch ${g.frei} von ${g.gesamt} Gründungsplätzen frei`
}

/**
 * Alle Sätze der Bausteine mit Zusage — EINE Quelle (Register K2-Ergänzung,
 * Wortlaut der Entscheidung vom 15.10.2026; seit Nr. 116 die Sätze der Aktion).
 * Zahlen und Datum kommen aus den Seitendaten (`GruendungSeiten`, gebaut aus
 * der Einstellung), nie als Literal. `art` 'bisher' = vor dem Festschreiben,
 * unverändert wie vor Nr. 116 (der Deploy ändert nichts Sichtbares).
 */
export const GRUENDUNG_TEXT = {
  /** (1) Startseite, Für-Höfe-Band — „Letzter Gründungsplatz frei" beim letzten (Mockup, Zustände). */
  satz: (g: GruendungSeiten): GruendungSatzTeile => {
    if (g.art === 'bisher') return { vor: '', betont: zaehlerSatz(g), nach: ` – ${HOFLADEN.name} ${KOSTENLOS} bis ${gruendungTagLang(g.bisTag)}.` }
    const angebot = `${HOFLADEN.name} ${g.monate} Monate ${KOSTENLOS}`
    if (!g.zaehler) return { vor: '', betont: `Die ersten ${g.gesamt} Höfe`, nach: ` bekommen den ${angebot} – im Wert von ${gruendungWertText(g.monate)}.` }
    return { vor: '', betont: zaehlerSatz(g), nach: ` – ${angebot}, im Wert von ${gruendungWertText(g.monate)}.` }
  },
  /** (2) /fuer-hoefe, über der Überschrift. */
  pill: (g: GruendungSeiten): string =>
    g.zaehler ? `Gründungsphase · noch ${g.frei} von ${g.gesamt} Plätzen` : `Gründungsphase · die ersten ${g.gesamt} Höfe`,
  /** (2) Der eine orange Knopf auf /fuer-hoefe. */
  knopf: 'Gründungshof werden',
  /**
   * (2) Die Fußnote unter den Knöpfen, auch am Handy ganz (Mockup mobil-k2-fuer-hoefe-gruendung).
   * „keine Bankdaten nötig“ ist gestrichen (Register K2, Korrektur 15.10.2026): Stripe verlangt
   * beim Einrichten ein Auszahlungskonto.
   */
  fussnote: (g: GruendungSeiten): readonly string[] =>
    g.art === 'bisher'
      ? [`Kostenlos bis ${gruendungTagLang(g.bisTag)}`, 'danach Tarif nach Wahl', MONATLICH_KUENDBAR]
      : [
          `${g.monate} Monate ohne Grundgebühr ab Tarifstart am ${TARIFE_AB_TEXT} bzw. ab deiner Freischaltung`,
          'Freischaltung mit mindestens einem Produkt und Stripe',
          ...(g.aktionBisTag ? [`Aktion bis ${gruendungTagLang(g.aktionBisTag)}`] : []),
          `danach Tarif nach Wahl, ohne Wahl bleibt ${HOFTOR.name}, ${KOSTENLOS}`,
        ],
  /** (2) Die Angebotszeile direkt über den Tarifkarten. */
  preiszeile: (g: GruendungSeiten): GruendungSatzTeile =>
    g.art === 'bisher'
      ? {
          vor: '',
          betont: `Gründungshöfe zahlen bis ${gruendungTagLang(g.bisTag)} keine Grundgebühr`,
          nach: ` – auch im ${HOFLADEN.name}. Noch ${g.frei} von ${g.gesamt} Plätzen, Zusage mit der Freischaltung.`,
        }
      : {
          vor: '',
          betont: `Gründungshöfe zahlen ${g.monate} Monate keine Grundgebühr`,
          nach: ` – auch im ${HOFLADEN.name}. ${g.zaehler ? `Noch ${g.frei} von ${g.gesamt} Plätzen` : `Die ersten ${g.gesamt} Höfe`}, Zusage mit der Freischaltung.`,
        },
  /** (2) In der Hofladen-Karte unter „€ 0 / Monat". */
  hofladenPreis: (g: GruendungSeiten): string =>
    g.art === 'bisher' ? `bis ${gruendungTagKurz(g.bisTag)} · dann ${HOFLADEN.preis}` : `${g.monate} Monate, dann ${HOFLADEN.preis}`,
  /** (3) /register, über dem Formular — immer mit „voraussichtlich". */
  registrieren: (g: GruendungSeiten, platz: number): GruendungSatzTeile => ({
    vor: 'Du wärst voraussichtlich ',
    // „Nr." und Zahl bleiben in einer Zeile (geschütztes Leerzeichen) — am Handy stand die Zahl sonst allein.
    betont: gruendungshofLabel(platz).replace('Nr. ', 'Nr.\u00a0'),
    nach:
      g.art === 'bisher'
        ? ` – ${HOFLADEN.name} ${KOSTENLOS} bis ${gruendungTagLang(g.bisTag)}. Die Zusage kommt mit der Freischaltung.`
        : ` – ${HOFLADEN.name} ${g.monate} Monate ${KOSTENLOS}. Die Zusage kommt mit der Freischaltung (mindestens ein Produkt und Stripe)` +
          `${g.aktionBisTag ? `, wenn sie bis ${gruendungTagLang(g.aktionBisTag)} erfolgt` : ''}.`,
  }),
  /** (4) /konditionen, Abschnitt „Aktion“ — nur, solange die Aktion läuft, auch bei Anzeige aus: Konditionen sind keine Werbung. */
  aktion: (g: GruendungSeiten): { titel: string; saetze: readonly string[] } => ({
    titel: `Aktion ${g.gesamt} Gründungshöfe`,
    saetze: [
      `Die ersten ${g.gesamt} Höfe bekommen den ${HOFLADEN.name} ${g.monate} Monate ohne Grundgebühr – im Wert von ${gruendungWertText(g.monate)} inkl. USt.`,
      `Die ${g.monate} Monate laufen ab dem Tarifstart am ${TARIFE_AB_TEXT} bzw. ab der Freischaltung, wenn sie später ist. Das Ende steht danach für den Hof fest.`,
      'Ein Platz zählt erst mit der Freischaltung. Dafür braucht es eine bestätigte E-Mail, ein fertiges Stripe-Konto und mindestens ein Produkt im Shop.',
      g.aktionBisTag
        ? `Die Aktion läuft bis ${gruendungTagLang(g.aktionBisTag)} oder bis alle Plätze vergeben sind.`
        : 'Die Aktion läuft, bis alle Plätze vergeben sind.',
      `Danach wählt der Hof seinen Tarif – ohne Wahl bleibt ${HOFTOR.name}, ${KOSTENLOS}.`,
    ],
  }),
} as const

// === ABZEICHEN „GRÜNDUNGSHOF“ (Register K2, Änderung Nr. 116; Mockup system-k2-gruendung-abzeichen) ===

/**
 * Trägt ein Hof das Abzeichen? Mit festgeschriebenem Platz, freigeschaltet,
 * nicht ausgenommen und nicht vom Hof ausgeblendet. Die Abfragen rechnen es
 * auf dem Server; an den Browser geht nur das Ja/Nein, nie die Nummer.
 */
export function zeigtAbzeichen(hof: {
  gruendungPlatz: number | null
  approvedAt: Date | null
  gruendungAusgenommen: boolean
  gruendungAbzeichenZeigen: boolean
}): boolean {
  return hof.gruendungPlatz !== null && hof.approvedAt !== null && !hof.gruendungAusgenommen && hof.gruendungAbzeichenZeigen
}

/**
 * Was das Erklär-Blatt des Abzeichens an Zahlen braucht: die Plätze (fürs „die
 * ersten 100 Höfe“) und — nur solange der Zähler sichtbar ist — die freien,
 * sonst null (dann kein „Du hast selbst einen Hof?“). Nie eine Nummer.
 */
export type AbzeichenBlatt = { plaetze: number; frei: number | null }

/** Aus den Zahlen der Seiten — dieselbe Regel wie der Zähler auf der Startseite. */
export function abzeichenBlattAus(seiten: Pick<GruendungSeiten, 'gesamt' | 'frei' | 'zaehler'>): AbzeichenBlatt {
  return { plaetze: seiten.gesamt, frei: seiten.zaehler ? seiten.frei : null }
}

const SEIT_FORMAT = new Intl.DateTimeFormat('de-AT', { month: 'long', year: 'numeric', timeZone: 'Europe/Vienna' })

/** „Oktober 2026“ — der Monat der Freischaltung, in Wiener Zeit. */
export function abzeichenSeit(approvedAt: Date): string {
  return SEIT_FORMAT.format(approvedAt)
}

/** Alle Sätze rund um das Abzeichen — EINE Quelle (Wortliste: Abzeichen, Aktion). */
export const ABZEICHEN_TEXT = {
  wort: 'Gründungshof',
  /** Name des Knopfs auf der Hofseite für Screenreader. */
  knopf: 'Gründungshof – was heißt das?',
  titel: (hof: string): string => `Der ${hof} ist ein Gründungshof`,
  satz: (hof: string, plaetze: number, seit: string): string =>
    `Gründungshöfe sind die ersten ${plaetze} Höfe, die auf ${MARKE} verkaufen. Der ${hof} ist seit ${seit} dabei.`,
  keinSiegel: 'Das Abzeichen ist kein Prüf- oder Gütesiegel. Was ein Produkt auszeichnet, zum Beispiel Bio, steht beim Produkt.',
  selbstHof: 'Du hast selbst einen Hof?',
  frei: (frei: number, gesamt: number): string => `Noch ${frei} von ${gesamt} Plätzen frei.`,
  mehr: 'Mehr erfahren',
  mehrHref: '/fuer-hoefe',
  /** Konditionen und Tarif, Block „Dein Stand“. */
  schalter: 'Abzeichen zeigen',
  schalterZeile: 'Über deinem Namen auf der Hofseite, in der Höfe-Liste und auf geteilten Bildern.',
  schalterSatz: 'Deine Konditionen bleiben gleich, auch wenn du es ausblendest. Du kannst es jederzeit wieder einschalten.',
  fehler: 'Wir konnten das Abzeichen gerade nicht umstellen. Lade die Seite neu und versuch es noch einmal.',
} as const

// === AUSGENOMMENE HÖFE (Register K2, Ergänzung 16.10.2026, Nr. 109) ===

/**
 * Die Kennung der Advisory-Sperre um die Vergabe der Gründungsplätze
 * („gruendungsplaetze“: „K2“ in ASCII und Nr. 109). Freischalten, Ausnehmen und
 * Wiederaufnehmen nehmen sie in ihrer Transaktion
 * (`SELECT pg_advisory_xact_lock(...)`), bevor sie die Höfe lesen — so
 * können zwei Wege nie gleichzeitig denselben letzten Platz vergeben. EINE
 * Stelle, damit alle drei dieselbe Sperre nehmen; als bigint, weil Postgres
 * die Sperre über int8 führt. Andere Advisory-Sperren gibt es im Code nicht.
 */
export const GRUENDUNGSPLAETZE_SPERRE: bigint = BigInt(0x4b32_0109)

/** Die Marke in der Spalte Gründungshof (Wortliste: „ausgenommen“) — seit Nr. 119 ohne „Testhof“: Ausgenommen heißt nur „zählt nicht für die Plätze“. */
export const GRUENDUNG_AUSGENOMMEN_MARKE = 'ausgenommen'

/** Die Marke eines Testhofs (Register N21, Wortliste: „Testhof“) — seine Zeile zeigt nur sie, nie zusätzlich „ausgenommen“. */
export const TESTHOF_MARKE = 'Testhof'

/** Der Grund am ausgegrauten „Wieder als Gründungshof zählen“ und der Satz der Action (Register N21: ein Testhof ist immer ausgenommen). */
export const TESTHOF_ZAEHLT_NIE = 'Ein Testhof zählt nie als Gründungshof.'

/** Wie viele freigeschaltete, nicht stillgelegte Höfe ausgenommen sind — „· k ausgenommen“ in Admin › Höfe und Einstellungen. */
export function zaehleAusgenommene(hoefe: readonly HofFuerPlatz[]): number {
  return hoefe.filter((h) => h.approvedAt !== null && h.archivedAt === null && h.gruendungAusgenommen).length
}

/** „Alle Plätze vergeben“ – der EINE Wortlaut, aus dem der Freischalt-Hinweis, die Sperre im Menü und die Action ihren Satz bauen (Nr. 121). */
export function alleGruendungsplaetzeVergeben(plaetze: number): string {
  return `Alle ${plaetze} Gründungsplätze sind vergeben`
}

/** Alle Plätze vergeben — Satz der Action und Grund am ausgegrauten Menüeintrag. */
export function gruendungAlleVergeben(plaetze: number): string {
  return `${alleGruendungsplaetzeVergeben(plaetze)} – erst muss ein Platz frei werden.`
}

/**
 * Darf ein ausgenommener Hof wieder in die Vergabe? Nur, wenn danach höchstens
 * `plaetze` Höfe im Rennen sind (Register K2) — so verliert nie ein anderer
 * Hof seine Zusage. EINE Regel für Action (in der Sperre) und Menü.
 */
export function wiederAufnahmeMoeglich(hofId: string, hoefe: readonly HofFuerPlatz[], plaetze: number): boolean {
  // Festgeschrieben: ein freier Platz genügt (die Aktion selbst prüft die Action, aktionLaeuft).
  if (vergabeFest(hoefe)) return kleinsteFreieNummer(vergebeneNummern(hoefe.filter((h) => h.id !== hofId)), Math.max(plaetze, 0)) !== null
  const nachher = gruendungsplaetze(hoefe.map((h) => (h.id === hofId ? { ...h, gruendungAusgenommen: false } : h)))
  return nachher.size <= Math.max(plaetze, 0)
}

export type GruendungRichtung = 'ausnehmen' | 'aufnehmen'

/** Ein Hof, wie die Folgen ihn brauchen: Platzvergabe, Name und eigenes Ende (null = Standard). */
export type HofFuerFolgen = HofFuerPlatz & { name: string; gruendungBis: Date | null }

/** Ein anderer Hof, dessen Nummer sich ändert. `von`/`nach` sind Ränge, ein Platz nur bis `plaetze`. */
export type PlatzWechsel = { id: string; name: string; von: number; nach: number; gruendungBis: Date | null }

export type GruendungFolgen = {
  richtung: GruendungRichtung
  /** Der Gründungsplatz des Hofs vor der Änderung, null ohne Platz. */
  platzVorher: number | null
  /** Sein Gründungsplatz danach, null ohne Platz. */
  platzNachher: number | null
  /** Höfe mit Platz vorher und nachher, deren Nummer sich verschiebt — nach der neuen Nummer. */
  verschoben: PlatzWechsel[]
  /** Höfe, die dadurch NEU Gründungshof werden (nur beim Ausnehmen möglich). */
  neu: PlatzWechsel[]
  /** Höfe, die ihren Platz verlören — nur bei einer Wiederaufnahme, die nicht geht. */
  verlieren: PlatzWechsel[]
  freiNachher: number
  /** Ausnehmen geht immer; Wiederaufnahme nur, wenn danach höchstens `plaetze` Höfe im Rennen sind. */
  moeglich: boolean
  /** Nach dem Festschreiben gerechnet (Nr. 116): Niemand rückt auf, eine Wiederaufnahme bekommt ein neues Ende ab heute. */
  fest?: boolean
}

function mitFlag<T extends HofFuerPlatz>(hoefe: readonly T[], hof: T, ausgenommen: boolean): T[] {
  const andere = hoefe.filter((h) => h.id !== hof.id)
  return [...andere, { ...hof, gruendungAusgenommen: ausgenommen }]
}

/**
 * Was das Aus- bzw. Wiederaufnehmen eines Hofs an den Plätzen ändert — für die
 * Bestätigung im Admin, in Zahlen. Gerechnet mit derselben Regel wie die Vergabe
 * (`gruendungsplaetze`): vorher mit dem Hof im Rennen bzw. ausgenommen, nachher
 * umgekehrt; ein Platz zählt nur bis `plaetze` (aus der Einstellung).
 *
 * Wiederaufnehmen geht nur, wenn danach höchstens `plaetze` Höfe im Rennen sind
 * (Register K2) — so verliert nie ein anderer Hof seine Zusage; die Nummern der
 * Höfe dahinter verschieben sich dann um eins.
 */
export function folgenDerAenderung<T extends HofFuerFolgen>(
  hof: T,
  hoefe: readonly T[],
  plaetze: number,
  richtung: GruendungRichtung
): GruendungFolgen {
  if (vergabeFest(hoefe)) return folgenFestgeschrieben(hof, hoefe, plaetze, richtung)
  const vorher = gruendungsplaetze(mitFlag(hoefe, hof, richtung === 'aufnehmen'))
  const nachher = gruendungsplaetze(mitFlag(hoefe, hof, richtung === 'ausnehmen'))
  const platz = (rang: number | undefined): number | null => (rang !== undefined && rang <= plaetze ? rang : null)

  const verschoben: PlatzWechsel[] = []
  const neu: PlatzWechsel[] = []
  const verlieren: PlatzWechsel[] = []
  for (const h of hoefe) {
    const von = vorher.get(h.id)
    const nach = nachher.get(h.id)
    if (h.id === hof.id || von === undefined || nach === undefined || von === nach) continue
    const wechsel: PlatzWechsel = { id: h.id, name: h.name, von, nach, gruendungBis: h.gruendungBis }
    if (platz(von) !== null && platz(nach) !== null) verschoben.push(wechsel)
    else if (platz(nach) !== null) neu.push(wechsel)
    else if (platz(von) !== null) verlieren.push(wechsel)
  }
  const nachNummer = (a: PlatzWechsel, b: PlatzWechsel) => a.nach - b.nach
  const gesamt = Math.max(plaetze, 0)
  return {
    richtung,
    platzVorher: platz(vorher.get(hof.id)),
    platzNachher: platz(nachher.get(hof.id)),
    verschoben: verschoben.sort(nachNummer),
    neu: neu.sort(nachNummer),
    verlieren: verlieren.sort(nachNummer),
    freiNachher: gesamt - Math.min(nachher.size, gesamt),
    moeglich: richtung === 'ausnehmen' || wiederAufnahmeMoeglich(hof.id, mitFlag(hoefe, hof, true), plaetze),
  }
}

/**
 * Dieselben Folgen nach dem Festschreiben (Nr. 116): Niemand rückt auf, keine
 * Nummer verschiebt sich. Ausnehmen gibt den Platz des Hofs frei; eine
 * Wiederaufnahme bekommt die kleinste freie Nummer, wenn eine frei ist.
 */
function folgenFestgeschrieben<T extends HofFuerFolgen>(hof: T, hoefe: readonly T[], plaetze: number, richtung: GruendungRichtung): GruendungFolgen {
  const gesamt = Math.max(plaetze, 0)
  const andere = vergebeneNummern(hoefe.filter((h) => h.id !== hof.id))
  const eigener = hof.gruendungAusgenommen ? null : (hof.gruendungPlatz ?? null)
  const platzNachher = richtung === 'aufnehmen' ? kleinsteFreieNummer(andere, gesamt) : null
  const belegtNachher = andere.size + (platzNachher !== null ? 1 : 0)
  return {
    richtung,
    platzVorher: richtung === 'ausnehmen' ? eigener : null,
    platzNachher,
    verschoben: [],
    neu: [],
    verlieren: [],
    freiNachher: gesamt - Math.min(belegtNachher, gesamt),
    moeglich: richtung === 'ausnehmen' || platzNachher !== null,
    fest: true,
  }
}
