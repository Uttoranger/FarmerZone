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

import { baueGruendungsZusage, KOSTENLOS, MONATLICH_KUENDBAR, ONLINE_ZAHLUNG_START_SCHRITT, tarifText } from '@/lib/konditionen'
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
  /**
   * Aus der Vergabe genommen (Register K2, Ergänzung 16.10.2026, Nr. 109) —
   * Pflichtfeld, damit kein Aufrufer es vergisst: Die Höfe kommen nur aus
   * HOF_FUER_GRUENDUNG oder dem Select von getAdminFarms (Wache
   * tests/gruendung-ausgenommen-wache.test.ts).
   */
  gruendungAusgenommen: boolean
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
export function gruendungsplaetze(hoefe: HofFuerPlatz[]): Map<string, number> {
  const imRennen = hoefe
    .filter((h): h is HofFuerPlatz & { approvedAt: Date } => h.approvedAt !== null && h.archivedAt === null && !h.gruendungAusgenommen)
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

/** true, wenn der Hof einen der Gründungsplätze belegt (Platz <= `plaetze`, Standard 12). */
export function istGruendungshof(hofId: string, hoefe: HofFuerPlatz[], plaetze: number = MAX_GRUENDUNGSHOEFE): boolean {
  const platz = gruendungsplatzVon(hofId, hoefe)
  return platz !== null && platz <= plaetze
}

/** Wie viele der Plätze vergeben sind — höchstens `plaetze` (Standard MAX_GRUENDUNGSHOEFE). */
export function vergebeneGruendungsplaetze(hoefe: HofFuerPlatz[], plaetze: number = MAX_GRUENDUNGSHOEFE): number {
  return Math.min(gruendungsplaetze(hoefe).size, plaetze)
}

/**
 * Bekäme ein noch wartender Hof bei sofortiger Freischaltung einen Platz?
 * Für den Bestätigungsdialog. Die Plätze sind eine KONDITIONS-Grenze, keine
 * Zugangsgrenze — Freischalten bleibt in jedem Fall möglich.
 */
export function bekaemePlatzBeiFreigabe(hoefe: HofFuerPlatz[], plaetze: number = MAX_GRUENDUNGSHOEFE): boolean {
  return vergebeneGruendungsplaetze(hoefe, plaetze) < plaetze
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

// === GRÜNDUNGSHÖFE SICHTBAR (Register K2-Ergänzung, Nr. 93) ===

/**
 * Was die Fachregeln aus Admin › Einstellungen brauchen: Plätze gesamt, das
 * Standard-Ende (Wert der DATE-Spalte, Mitternacht UTC) und ob die Seiten es
 * zeigen. Die Abfrage baut sie aus der Zeile (gruendungEinstellungAus in
 * src/lib/plattform-einstellung.ts).
 */
export type GruendungEinstellung = { plaetze: number; bis: Date; anzeige: boolean }

/** Ohne Einstellung gelten die Konstanten — wie vor Nr. 93. */
export const GRUENDUNG_EINSTELLUNG_STANDARD: GruendungEinstellung = {
  plaetze: MAX_GRUENDUNGSHOEFE,
  bis: GRUENDUNG_BIS_STANDARD,
  anzeige: true,
}

/**
 * Was Startseite, /fuer-hoefe und Registrieren zeigen — fertig vom Server,
 * nur Zahlen und Text, damit es auch an eine Client-Komponente gehen darf.
 * `bisTag` ist der Wiener Kalendertag JJJJ-MM-TT des Standard-Endes.
 */
export type GruendungSeiten = {
  zeigen: boolean
  frei: number
  gesamt: number
  bisTag: string
  /** „Du wärst voraussichtlich Gründungshof Nr. k" — null, wenn der Satz nicht stimmen könnte. */
  voraussichtlicherPlatz: number | null
}

/**
 * Die Zahlen der Seiten (Register K2-Ergänzung): frei = Plätze gesamt −
 * vergeben. Gezeigt wird nur mit Anzeige an, mindestens einem freien Platz
 * und einem Ende, das heute (Wiener Tag) noch nicht vorbei ist — sonst
 * nichts, nie „0 von 12" (Punkt 5 der Entscheidung).
 */
export function fuerSeiten(
  einstellung: GruendungEinstellung,
  hoefe: HofFuerPlatz[],
  jetzt: Date
): { zeigen: boolean; frei: number; gesamt: number; bisTag: string } {
  return seitenZahlen(einstellung, gruendungsplaetze(hoefe).size, jetzt)
}

/**
 * Dieselbe Regel aus der Zahl der Höfe im Rennen (freigeschaltet, nicht
 * stillgelegt) — für die Vorschau in Admin › Einstellungen, die keine
 * Hofliste in den Browser schickt.
 */
export function seitenZahlen(
  einstellung: GruendungEinstellung,
  imRennen: number,
  jetzt: Date
): { zeigen: boolean; frei: number; gesamt: number; bisTag: string } {
  const gesamt = Math.max(einstellung.plaetze, 0)
  const frei = gesamt - Math.min(imRennen, gesamt)
  const bisTag = kalendertagInWien(einstellung.bis)
  const zeigen = einstellung.anzeige && frei > 0 && kalendertagInWien(jetzt) <= bisTag
  return { zeigen, frei, gesamt, bisTag }
}

/**
 * Der voraussichtliche Platz einer Registrierenden: vergeben + Höfe, die vor
 * ihr auf die Freischaltung warten, + 1 (Register K2-Ergänzung, Punkt 3).
 * Läge er hinter dem letzten Platz, gibt es keinen Satz (null) — „voraussichtlich
 * Nr. 13" bei 12 Plätzen wäre falsch. Die Zusage kommt erst mit der
 * Freischaltung; warten Höfe länger oder schaltet der Betreiber in anderer
 * Reihenfolge frei, verschiebt sich die Nummer.
 */
export function voraussichtlicherPlatz(einstellung: GruendungEinstellung, hoefe: HofFuerPlatz[], wartendVorDir: number): number | null {
  const gesamt = Math.max(einstellung.plaetze, 0)
  const platz = vergebeneGruendungsplaetze(hoefe, gesamt) + Math.max(wartendVorDir, 0) + 1
  return platz <= gesamt ? platz : null
}

/** Beides für die Seiten in einem — der Satz beim Registrieren nur, wenn auch die übrigen Bausteine stehen. */
export function gruendungSeitenDaten(
  einstellung: GruendungEinstellung,
  hoefe: HofFuerPlatz[],
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
}

/**
 * Die Zusage bei der Freischaltung (Punkt 4): Platz und Ende, wenn der eben
 * freigeschaltete Hof einen der Plätze belegt — sein eigenes Ende oder das
 * Standard-Ende der Einstellung —, sonst null (dann keine Nachricht).
 * `hoefe` ist die Liste der Platzvergabe NACH der Freischaltung.
 */
export function gruendungsZusageBeiFreigabe(
  hof: HofMitGruendungBis,
  hoefe: HofFuerPlatz[],
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

/** Ein Satz mit einem hervorgehobenen Teil: vor · fett · danach. */
export type GruendungSatzTeile = { vor: string; betont: string; nach: string }

/**
 * Alle Sätze der Bausteine mit Zusage — EINE Quelle (Register K2-Ergänzung,
 * Wortlaut der Entscheidung vom 15.10.2026). Zahlen und Datum kommen als
 * Parameter aus der Einstellung, nie als Literal.
 */
export const GRUENDUNG_TEXT = {
  /** (1) Startseite, Für-Höfe-Band — „Letzter Gründungsplatz frei" beim letzten (Mockup, Zustände). */
  satz: (frei: number, gesamt: number, bisTag: string): GruendungSatzTeile => ({
    vor: '',
    betont: frei === 1 ? 'Letzter Gründungsplatz frei' : `Noch ${frei} von ${gesamt} Gründungsplätzen frei`,
    nach: ` – ${tarifText('HOFLADEN').name} ${KOSTENLOS} bis ${gruendungTagLang(bisTag)}.`,
  }),
  /** (2) /fuer-hoefe, über der Überschrift. */
  pill: (frei: number, gesamt: number): string => `Gründungsphase · noch ${frei} von ${gesamt} Plätzen`,
  /** (2) Der eine orange Knopf auf /fuer-hoefe. */
  knopf: 'Gründungshof werden',
  /**
   * (2) Die Fußnote unter den Knöpfen, auch am Handy ganz (Mockup mobil-k2-fuer-hoefe-gruendung).
   * „keine Bankdaten nötig“ ist gestrichen (Register K2, Korrektur 15.10.2026): Stripe verlangt
   * beim Einrichten ein Auszahlungskonto.
   */
  fussnote: (bisTag: string): readonly string[] => [
    `Kostenlos bis ${gruendungTagLang(bisTag)}`,
    'danach Tarif nach Wahl',
    MONATLICH_KUENDBAR,
  ],
  /** (2) Die Angebotszeile direkt über den Tarifkarten. */
  preiszeile: (frei: number, gesamt: number, bisTag: string): GruendungSatzTeile => ({
    vor: '',
    betont: `Gründungshöfe zahlen bis ${gruendungTagLang(bisTag)} keine Grundgebühr`,
    nach: ` – auch im ${tarifText('HOFLADEN').name}. Noch ${frei} von ${gesamt} Plätzen, Zusage mit der Freischaltung.`,
  }),
  /** (2) In der Hofladen-Karte unter „€ 0 / Monat". */
  hofladenPreis: (bisTag: string): string => `bis ${gruendungTagKurz(bisTag)} · dann ${tarifText('HOFLADEN').preis}`,
  /** (3) /register, über dem Formular — immer mit „voraussichtlich". */
  registrieren: (platz: number, bisTag: string): GruendungSatzTeile => ({
    vor: 'Du wärst voraussichtlich ',
    // „Nr." und Zahl bleiben in einer Zeile (geschütztes Leerzeichen) — am Handy stand die Zahl sonst allein.
    betont: gruendungshofLabel(platz).replace('Nr. ', 'Nr.\u00a0'),
    nach: ` – ${tarifText('HOFLADEN').name} ${KOSTENLOS} bis ${gruendungTagLang(bisTag)}. Die Zusage kommt mit der Freischaltung.`,
  }),
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

/** Die Marke in der Spalte Gründungshof (Wortliste: „ausgenommen“). */
export const GRUENDUNG_AUSGENOMMEN_MARKE = 'ausgenommen · Testhof'

/** Wie viele freigeschaltete, nicht stillgelegte Höfe ausgenommen sind — „· k ausgenommen“ in Admin › Höfe und Einstellungen. */
export function zaehleAusgenommene(hoefe: readonly HofFuerPlatz[]): number {
  return hoefe.filter((h) => h.approvedAt !== null && h.archivedAt === null && h.gruendungAusgenommen).length
}

/** Alle Plätze vergeben — Satz der Action und Grund am ausgegrauten Menüeintrag. */
export function gruendungAlleVergeben(plaetze: number): string {
  return `Alle ${plaetze} Plätze sind vergeben – erst muss ein Platz frei werden.`
}

/**
 * Darf ein ausgenommener Hof wieder in die Vergabe? Nur, wenn danach höchstens
 * `plaetze` Höfe im Rennen sind (Register K2) — so verliert nie ein anderer
 * Hof seine Zusage. EINE Regel für Action (in der Sperre) und Menü.
 */
export function wiederAufnahmeMoeglich(hofId: string, hoefe: readonly HofFuerPlatz[], plaetze: number): boolean {
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
