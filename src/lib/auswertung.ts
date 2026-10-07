/**
 * Auswertung (/analytics) im neuen Design (Nachtlauf Nr. 22c, Gate 8; Mockup
 * web-h5-auswertung-abrechnung-teilen-wirkung) — rein, ohne Datenbank
 * prüfbar (tests/auswertung.test.ts). Die Abfragen stehen in
 * src/server/queries/auswertung.ts; die Seite zeigt nur an.
 *
 * Drei Dinge werden hier entschieden:
 *   - die Kennzahlen eines Zeitraums (abgeholte Bestellungen nach der EINEN
 *     Umsatzregel, src/lib/umsatz.ts; nicht abgeholte nach Abholtag),
 *   - die „Servicegebühren dieses Monats" — nur lesend, aus den an den
 *     Bestellungen gespeicherten Beträgen, gezählt nach der Abrechnungsregel
 *     `topfVonBestellung` (src/lib/finanzen.ts, dieselbe wie /admin/finanzen),
 *   - die Zeilen der Karte „Über deine geteilten Links" (Teilen-Wirkung, Nr. 21).
 *
 * Geld in ganzen Cent (CODING_STANDARDS §2), Tage und Monate in Wiener Zeit.
 */
import { topfVonBestellung, type BestellungFuerFinanzen } from '@/lib/finanzen'
import { istVorOrtZahlung, monatsschluesselInWien, type Monatsschluessel, type Zahlungsart } from '@/lib/servicegebuehr'
import { BAR_OHNE_GEBUEHR_SATZ, barGebuehrSepaSatz, vorBarStichtag } from '@/lib/konditionen'
import { mitAnzahl } from '@/lib/format'
import { wienKalendertag } from '@/lib/kalender'
import { wienerTag, type Zeitraum } from '@/lib/heute'
import type { Periode, Periodenfenster } from '@/lib/umsatz'
import type { TeilenWirkung, TeilenZeitraum } from '@/lib/teilen-wirkung'

// ─── Kennzahlen ─────────────────────────────────────────────────────────────

/** Eine abgeholte Bestellung, so weit die Kennzahlen sie brauchen (Warenpreis in Cent). */
export type KennzahlBestellung = { paymentMethod: Zahlungsart; warenCents: number }

export type Kennzahlen = {
  /** Abgeholte Bestellungen im Zeitraum. */
  bestellungen: number
  online: number
  /** Bar bzw. vor Ort bezahlt (bar, Altbestand Karte beim Hof). */
  vorOrt: number
  /** Warenpreis aller abgeholten Bestellungen in Cent. */
  warenCents: number
  /** Ø Warenpreis je abgeholter Bestellung in Cent; null ohne Bestellung. */
  durchschnittCents: number | null
  /** Als „nicht abgeholt" markierte Bestellungen mit Abholtag im Zeitraum. */
  nichtAbgeholt: number
}

/**
 * Die Kennzahlen eines Zeitraums. Der Durchschnitt rundet einmal am Ende
 * kaufmännisch auf ganze Cent — er ist Anzeige, keine Abrechnung.
 */
export function kennzahlen(abgeholt: readonly KennzahlBestellung[], nichtAbgeholt: number): Kennzahlen {
  const warenCents = abgeholt.reduce((summe, b) => summe + Math.max(0, Math.round(b.warenCents)), 0)
  const online = abgeholt.filter((b) => b.paymentMethod === 'ONLINE').length
  const vorOrt = abgeholt.filter((b) => istVorOrtZahlung(b.paymentMethod)).length
  return {
    bestellungen: abgeholt.length,
    online,
    vorOrt,
    warenCents,
    durchschnittCents: abgeholt.length === 0 ? null : Math.round(warenCents / abgeholt.length),
    nichtAbgeholt: Math.max(0, nichtAbgeholt),
  }
}

/** „30 online · 28 bar" — ohne die Hälfte, die null ist; ohne Bestellung null. */
export function zahlartZeile(k: Pick<Kennzahlen, 'online' | 'vorOrt'>): string | null {
  const teile: string[] = []
  if (k.online > 0) teile.push(`${k.online} online`)
  if (k.vorOrt > 0) teile.push(`${k.vorOrt} bar`)
  return teile.length ? teile.join(' · ') : null
}

/**
 * Die Abholtage eines Zeitraums für „nicht abgeholt": ganze Wiener Tage vom
 * ersten bis zum letzten Tag des Fensters. pickupDate steht um 12:00 des
 * Abholtags (src/lib/heute.ts) — mit dem laufenden Zeitpunkt als Ende fiele
 * eine heute morgen als nicht abgeholt markierte Bestellung bis Mittag weg.
 */
export function abholtageDesFensters(pf: Pick<Periodenfenster, 'aktuell'>): Zeitraum {
  return {
    von: wienerTag(wienKalendertag(pf.aktuell.von)).von,
    bis: wienerTag(wienKalendertag(pf.aktuell.bis)).bis,
  }
}

// ─── Servicegebühren dieses Monats ──────────────────────────────────────────

export type ServicegebuehrenMonat = {
  monat: Monatsschluessel
  /** Online bezahlt, Gebühr nicht erstattet — Stripe hat sie bei der Zahlung einbehalten. */
  onlineCents: number
  onlineAnzahl: number
  /** Vor Ort kassiert und der Abrechnung geschuldet — vor dem Stichtag bei Barzahlung nie (B1). */
  vorOrtCents: number
  vorOrtAnzahl: number
  summeCents: number
}

/**
 * Die Servicegebühren eines Monats aus den GESPEICHERTEN Beträgen
 * (`Order.serviceFeeCents`, nie neu berechnet, E4). Monat ist der
 * Bestelleingang in Wiener Zeit, gezählt wird nach `topfVonBestellung` —
 * derselben Regel wie die Betreiber-Finanzen, damit Hof und Betreiber für
 * denselben Monat dieselbe Zahl sehen:
 *   - online UND bezahlt, Gebühr nicht erstattet → „online" (eingezogen),
 *   - vor Ort UND abgeholt, Gebühr nicht entfallen, nicht bar vor dem
 *     SEPA-Stichtag → „vor Ort" (geschuldet),
 *   - storniert, Gebühr erstattet/entfallen, nicht abgeholt, bar vor dem
 *     Stichtag und alles noch Offene → zählt nicht.
 * Offenes (bestellt, noch nicht bezahlt bzw. abgeholt) zählt bewusst nicht:
 * Die Zahl soll nur sagen, was tatsächlich angefallen ist.
 */
export function servicegebuehrenImMonat(
  bestellungen: readonly BestellungFuerFinanzen[],
  monat: Monatsschluessel
): ServicegebuehrenMonat {
  const ergebnis: ServicegebuehrenMonat = { monat, onlineCents: 0, onlineAnzahl: 0, vorOrtCents: 0, vorOrtAnzahl: 0, summeCents: 0 }
  for (const b of bestellungen) {
    if (monatsschluesselInWien(b.createdAt) !== monat) continue
    const gebuehr = Math.max(0, Math.round(b.serviceFeeCents))
    const topf = topfVonBestellung(b)
    if (topf === 'eingezogen') {
      ergebnis.onlineCents += gebuehr
      ergebnis.onlineAnzahl++
    } else if (topf === 'geschuldet') {
      ergebnis.vorOrtCents += gebuehr
      ergebnis.vorOrtAnzahl++
    }
  }
  ergebnis.summeCents = ergebnis.onlineCents + ergebnis.vorOrtCents
  return ergebnis
}

/** Was die Servicegebühr für den Hof heißt — ohne Zahl und ohne Datum (die stehen nur in konditionen.ts). */
export const SERVICEGEBUEHREN_ERKLAERUNG =
  'Die zahlen deine Kunden zusätzlich zum Warenpreis. Online behält Stripe sie gleich beim Bezahlen ein.'

/** Die Sätze unter den Servicegebühren; Stichtag und Bar-Ausnahme nur aus `konditionen.ts` (K1, B1). */
export function servicegebuehrenSaetze(jetzt: Date): { erklaerung: string; bar: string | null } {
  // Vor dem SEPA-Start (B1) gibt es keine Monatsabrechnung: kein Lastschrift-Satz, dafür die Bar-Ausnahme.
  return {
    erklaerung: SERVICEGEBUEHREN_ERKLAERUNG,
    bar: vorBarStichtag(jetzt) ? BAR_OHNE_GEBUEHR_SATZ : barGebuehrSepaSatz(jetzt),
  }
}

// ─── Teilen-Wirkung ─────────────────────────────────────────────────────────

/** Der Zeitraum der Teilen-Karte: dieselben Wiener Tage wie die Kennzahlen darüber. */
export function teilenZeitraumAus(pf: Pick<Periodenfenster, 'aktuell'>): TeilenZeitraum {
  return { von: wienKalendertag(pf.aktuell.von), bis: wienKalendertag(pf.aktuell.bis) }
}

export type TeilenKartenZeile = {
  kanal: string
  name: string
  /** Breite des Balkens in Prozent des stärksten Kanals (Besuche); mindestens ein Strich, wenn etwas da ist. */
  anteilProzent: number
  text: string
}

export type TeilenKarte = {
  /** „38 Besuche · 6 Bestellungen" — null, wenn es nichts gab. */
  kopf: string | null
  zeilen: TeilenKartenZeile[]
}

/** Die Karte „Über deine geteilten Links" aus der Zusammenfassung von `getTeilenWirkung`. */
export function teilenKarte(wirkung: TeilenWirkung): TeilenKarte {
  if (wirkung.besuche <= 0 && wirkung.bestellungen <= 0) return { kopf: null, zeilen: [] }
  const staerkster = Math.max(1, ...wirkung.kanaele.map((k) => k.besuche))
  const zahlen = (besuche: number, bestellungen: number) =>
    `${mitAnzahl(besuche, 'Besuch', 'Besuche')} · ${mitAnzahl(bestellungen, 'Bestellung', 'Bestellungen')}`
  return {
    kopf: zahlen(wirkung.besuche, wirkung.bestellungen),
    zeilen: wirkung.kanaele.map((k) => ({
      kanal: k.kanal,
      name: k.name,
      anteilProzent: k.besuche > 0 ? Math.max(2, Math.round((k.besuche / staerkster) * 100)) : 0,
      text: zahlen(k.besuche, k.bestellungen),
    })),
  }
}

// ─── Grenze Be- & Verarbeitung ──────────────────────────────────────────────

export type GrenzeStand = {
  ton: 'gruen' | 'orange'
  /** „Im grünen Bereich", „Achtung: Grenze nähert sich", „Grenze fast erreicht" */
  marke: string
  /** Ab 75 % ein Satz mit Ausweg (Steuerberatung); sonst null. */
  hinweis: string | null
}

/**
 * Wie die Jahreskarte die Grenze einordnet — dieselben Schwellen wie bisher
 * (75 % und 95 %). Im neuen Design gibt es kein Rot (Register O1: Fehler und
 * Warnungen orange), deshalb beide Warnstufen orange mit eigenem Wortlaut.
 */
export function grenzeStand(prozent: number, grenzeText: string): GrenzeStand {
  if (prozent >= 95) {
    return {
      ton: 'orange',
      marke: 'Grenze fast erreicht',
      hinweis: `Du hast die ${grenzeText} Grenze für Be- & Verarbeitung fast erreicht. Bitte sprich mit deiner Steuerberatung.`,
    }
  }
  if (prozent >= 75) {
    return {
      ton: 'orange',
      marke: 'Achtung: Grenze nähert sich',
      hinweis: `Du näherst dich der ${grenzeText} Grenze für Be- & Verarbeitung. Sprich am besten mit deiner Steuerberatung.`,
    }
  }
  return { ton: 'gruen', marke: 'Im grünen Bereich', hinweis: null }
}

/** Titel der Umsatzkarte je Zeitraum — die Balken sind Tage, Wochenabschnitte (1.–7. …) bzw. Monate. */
export function umsatzKartenTitel(periode: Periode): string {
  if (periode === 'woche') return 'Umsatz pro Tag'
  if (periode === 'monat') return 'Umsatz pro Woche'
  return 'Umsatz pro Monat'
}
