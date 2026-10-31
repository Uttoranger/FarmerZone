import { centsAlsEuro, euroEingabeZuCent, formatDezimal, formatEuro, formatZahl } from '@/lib/format'
import type { ProductCategoryValue } from '@/lib/taxonomie'

/*
 * Rücktritt je Produkt (Register N39, Ergänzung 31.10.2026, Nr. 214): Ob eine
 * Ware vom Rücktritt ausgenommen ist (§ 18 Abs. 1 Z 4 FAGG, schnell
 * verderblich) und was die Rücksendung sperriger Ware schätzungsweise kostet
 * (§ 4 Abs. 1 Z 9 FAGG), gibt der Hof je Produkt an. Die App zeigt es vor dem
 * Bestellen (Produktseite, Kasse), in der Belehrung der Bestätigungsmail und
 * auf /widerruf — sie entscheidet nichts selbst. Ohne Angabe gilt der
 * bisherige Hinweis je Kategorie (`ausnahmeHinweis`) bzw. keine
 * Rücksendekosten für die Kundschaft.
 *
 * Alle Sätze aus EINER Quelle (Freigabe 214 Punkt 1). Ohne zod und ohne
 * Prisma: Die Kasse liest von hier (CODING_STANDARDS §3).
 */

/** Was die Anzeige vom Produkt braucht — dieselben Namen wie die Spalten. */
export type RuecktrittAngabe = { keinRuecktritt: boolean; ruecksendekostenCents: number | null }

/** Höchste Schätzung (10.000 €) — darüber ist es ein Tippfehler, keine Rücksendung. */
export const RUECKSENDEKOSTEN_MAX_CENTS = 1_000_000

export const RUECKTRITT_TEXT = {
  // Produktformular (Hof, einfache Sprache)
  abschnitt: 'Rücktritt',
  keinRuecktritt: 'Verdirbt schnell – kein Rücktritt möglich (z. B. frisches Fleisch, Milch, Brot)',
  keinRuecktrittErklaerung:
    'Kundinnen können bei schnell verderblicher Ware nicht vom Kauf zurücktreten. Wir zeigen das vor dem Bestellen bei diesem Produkt an.',
  ruecksendekosten: 'Geschätzte Kosten, wenn die Kundin die Ware zurückschickt (nur bei sperriger Ware wie Brennholz, Heu, Großgebinden)',
  ruecksendekostenErklaerung: 'In Euro. Lass das Feld leer, wenn die Ware am Hof zurückgegeben oder normal per Post geschickt werden kann.',
  // Fehler am Feld (Schema und Formular)
  betragUngueltig: 'Gib den Betrag in Euro ein, z. B. 25 oder 25,50.',
  betragNegativ: 'Der Betrag kann nicht negativ sein.',
  betragNull: 'Lass das Feld leer, wenn die Rücksendung nichts kostet.',
  betragZuHoch: 'Der Betrag ist zu hoch. Bitte prüf die Eingabe.',
  // Produktseite, Kasse, Produktliste des Hofs
  hinweisKeinRuecktritt: 'Kein Rücktritt: verdirbt schnell',
  hinweisRuecksendung: (cents: number) => `Rücksendung geschätzt ca. ${formatEuro(centsAlsEuro(cents))}`,
  // /widerruf: Vorrang vor dem Satz je Kategorie (Freigabe 214 Punkt 3)
  widerrufKeinRuecktritt:
    'Für diese Ware besteht nach Angabe des Hofs kein Rücktrittsrecht (§ 18 Abs. 1 Z 4 FAGG). Der Hof prüft das im Einzelfall.',
} as const

/**
 * Die Kategorien, bei denen der Haken beim ANLEGEN eines Produkts gesetzt
 * startet — dieselben, für die `ausnahmeHinweis` den Satz „Frische
 * Lebensmittel verderben schnell …“ zeigt (geprüft in
 * tests/ruecktritt-angaben.test.ts). Nie rückwirkend: Bestandsprodukte
 * behalten ihren gespeicherten Wert (Freigabe 214 Punkt 1).
 */
const VERDIRBT_SCHNELL: ReadonlySet<ProductCategoryValue> = new Set(['MILCH', 'EIER', 'FLEISCH', 'FISCH', 'GEMUESE', 'OBST', 'BROT'])

export function keinRuecktrittVorbelegung(kategorie: ProductCategoryValue | null): boolean {
  return kategorie !== null && VERDIRBT_SCHNELL.has(kategorie)
}

/**
 * Der Haken nach einem Kategoriewechsel im Formular: Beim ANLEGEN folgt er der
 * Vorbelegung der neuen Kategorie, solange er noch der Vorbelegung der alten
 * entspricht (wie der MwSt-Vorschlag) — einen selbst gesetzten oder
 * entfernten Haken fasst der Wechsel nicht an. Beim Bearbeiten bleibt er immer,
 * wie er ist: nie rückwirkend (Freigabe 214 Punkt 1).
 */
export function keinRuecktrittNachKategoriewechsel(p: {
  anlegen: boolean
  aktuell: boolean
  alt: ProductCategoryValue | null
  neu: ProductCategoryValue | null
}): boolean {
  if (!p.anlegen || p.aktuell !== keinRuecktrittVorbelegung(p.alt)) return p.aktuell
  return keinRuecktrittVorbelegung(p.neu)
}

/**
 * Der Hinweis je Position in der Kasse (Formular, Zahlungsschritt, „Zahlung
 * fortsetzen“): nur bei Verbraucherinnen — bei „Betrieb“ gibt es kein
 * Rücktrittsrecht, also keinen Hinweis (Freigabe 214 Punkt 2). Nur die zwei
 * Werte, nie das ganze Produkt.
 */
export function ruecktrittFuerPosition(produkt: RuecktrittAngabe | null | undefined, privat: boolean): RuecktrittAngabe | null {
  if (!privat || !produkt) return null
  return { keinRuecktritt: produkt.keinRuecktritt, ruecksendekostenCents: produkt.ruecksendekostenCents }
}

/** Die Hinweise unter dem Produktnamen (Produktseite, Kasse) — leer ohne Angabe. */
export function ruecktrittHinweise(angabe: RuecktrittAngabe): string[] {
  const hinweise: string[] = []
  if (angabe.keinRuecktritt) hinweise.push(RUECKTRITT_TEXT.hinweisKeinRuecktritt)
  if (angabe.ruecksendekostenCents !== null) hinweise.push(RUECKTRITT_TEXT.hinweisRuecksendung(angabe.ruecksendekostenCents))
  return hinweise
}

/**
 * Das getippte Feld → Cent für das Formular: leer = null (keine Angabe), ein
 * Betrag = ganze Cent über die Ziffern (`euroEingabeZuCent`, nie Fließkomma),
 * alles andere (auch „-5") = NaN — das Schema lehnt es mit einem Satz ab,
 * statt still „keine Angabe“ zu speichern.
 */
export function ruecksendekostenAusEingabe(text: string): number | null {
  if (text.trim() === '') return null
  return euroEingabeZuCent(text) ?? Number.NaN
}

/** Cent → Text im Feld beim Bearbeiten („25,50“). */
export function ruecksendekostenAlsEingabe(cents: number | null): string {
  return cents === null || !Number.isFinite(cents) ? '' : formatDezimal(centsAlsEuro(cents), 2)
}

/**
 * Die Schätzung für den Satz aus Gestaltungshinweis 5 b in der Belehrung
 * (Freigabe 214 Punkt 4): Summe der Schätzungen der Positionen mit Angabe ×
 * Menge, in ganzen Cent (Int), dann auf ganze Euro AUFGERUNDET — der Satz sagt
 * „höchstens etwa“. null, wenn keine Position eine Schätzung trägt; dann
 * bleibt der Satz weg.
 */
export function ruecksendekostenSchaetzungEuro(positionen: readonly { menge: number; ruecksendekostenCents: number | null }[]): number | null {
  let summeCents = 0
  let mitAngabe = false
  for (const p of positionen) {
    if (p.ruecksendekostenCents === null) continue
    mitAngabe = true
    summeCents += p.menge * p.ruecksendekostenCents
  }
  return mitAngabe ? Math.ceil(summeCents / 100) : null
}

/**
 * Anhang I FAGG, Gestaltungshinweis 5 b, mit dem Betrag in ganzen Euro
 * („Die Kosten werden auf höchstens etwa 25 EUR geschätzt.“). Die Zahl
 * schreibt `formatZahl` deutsch (Tausenderpunkt), „EUR“ bleibt wie im Muster.
 */
export function kostenSchaetzungSatz(euro: number): string {
  return `Die Kosten werden auf höchstens etwa ${formatZahl(euro)} EUR geschätzt.`
}
