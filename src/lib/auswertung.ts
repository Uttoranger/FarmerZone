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
 *   - die Zeilen der Karte „Über deine geteilten Links" (Teilen-Wirkung, Nr. 21;
 *     seit Nr. 26 nur Besuche, Register T1).
 *
 * Geld in ganzen Cent (CODING_STANDARDS §2), Tage und Monate in Wiener Zeit.
 */
import { GEZAEHLTE_TOEPFE, gebuehrWortFuerMonat, topfVonBestellung, type BestellungFuerFinanzen, type EinnahmenTopf } from '@/lib/finanzen'
import {
  einzugAbFuer,
  gebuehrModellFuer,
  gebuehrenMehrzahl,
  geldsaetzeFuer,
  hofpreisModellAb,
  letzterFreierTag,
  satzHundertstel,
  satzText,
  type GeldsatzHof,
  type HofpreisEinstellung,
} from '@/lib/plattformgebuehr'
import { istVorOrtZahlung, monatsgrenzenWien, monatsschluesselInWien, type Monatsschluessel, type Zahlungsart } from '@/lib/servicegebuehr'
import type { GezeigteSummen } from '@/lib/testzahlung'
import { BAR_OHNE_GEBUEHR_SATZ, barGebuehrSepaSatz, vorBarStichtag } from '@/lib/konditionen'
import { mitAnzahl } from '@/lib/format'
import { wienKalendertag } from '@/lib/kalender'
import { selbstEingetragenSatz, wienerTag, type Zeitraum } from '@/lib/heute'
import { umsatzfenster, type Periodenfenster } from '@/lib/umsatz'
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

/**
 * Welche Summen die Auswertung zeigt — daran misst sich die Hinweiszeile
 * (Register Z4): die Umsatzfenster der Balken samt Vorperiode (Kennzahlen,
 * Vergleich und Top-Produkte liegen darin) und des Wiener Jahres
 * (Grenzkarte), dazu der Monat der Servicegebühren. Zwei Umsatzfenster, nicht
 * eines von früh bis jetzt: Bei einem älteren Jahr läge dazwischen eine Lücke,
 * die keine Zahl der Seite zeigt.
 */
export function auswertungSummen(pf: Pick<Periodenfenster, 'vergleichGanz' | 'aktuell'>, jetzt: Date): GezeigteSummen {
  const { von, bis } = monatsgrenzenWien(jetzt)
  return {
    umsatz: [{ von: pf.vergleichGanz.von, bis: pf.aktuell.bis }, umsatzfenster('jahr', jetzt).aktuell],
    gebuehrenMonat: { von, bis },
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
 * Welche Töpfe die Karte zählt — die gezählten der Finanzseite, „erwartet"
 * steht hier nicht. Dieselbe Konstante nimmt die Hinweiszeile
 * (`testzahlungenHinweisFuerHof`, Register Z4), damit Karte und Zeile nie
 * auseinanderlaufen.
 */
export const SERVICEGEBUEHREN_TOEPFE: readonly EinnahmenTopf[] = GEZAEHLTE_TOEPFE

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
 *     Stichtag, Testzahlungen (online vor `stripeLiveAb`, Register Z4) und
 *     alles noch Offene → zählt nicht.
 * Offenes (bestellt, noch nicht bezahlt bzw. abgeholt) zählt bewusst nicht:
 * Die Zahl soll nur sagen, was tatsächlich angefallen ist.
 */
export function servicegebuehrenImMonat(
  bestellungen: readonly BestellungFuerFinanzen[],
  monat: Monatsschluessel,
  stripeLiveAb: Date | null
): ServicegebuehrenMonat {
  const ergebnis: ServicegebuehrenMonat = { monat, onlineCents: 0, onlineAnzahl: 0, vorOrtCents: 0, vorOrtAnzahl: 0, summeCents: 0 }
  for (const b of bestellungen) {
    if (monatsschluesselInWien(b.createdAt) !== monat) continue
    const topf = topfVonBestellung(b, stripeLiveAb)
    if (!SERVICEGEBUEHREN_TOEPFE.includes(topf)) continue
    const gebuehr = Math.max(0, Math.round(b.serviceFeeCents))
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

/**
 * Was die Plattformgebühr für den Hof heißt (N38, Board s2/w2-auswertung) — ohne Zahl
 * und ohne Datum: Der Satz eines Hofs kann vom Standard abweichen, die Karte kennt ihn nicht.
 */
export const PLATTFORMGEBUEHR_KARTE_ERKLAERUNG = 'Sie wird je Stück aufgerundet und steckt im Preis der Kundin; online behält Stripe sie gleich ein.'

/** Bar im Hofpreis-Modell (N38, N44): monatlich per Lastschrift, Gründungshöfe erst nach ihrer Gründungszeit. */
export const PLATTFORMGEBUEHR_KARTE_BAR =
  'Die Gebühr aus Barverkäufen ziehen wir einmal im Monat per Lastschrift ein – als Gründungshof erst nach deiner Gründungszeit.'

/**
 * Was die Gebühren-Karte über den eigenen Hof wissen muss, um ihren Erklärsatz je Stand zu bilden (Nr. 273,
 * Liste Lauf 32 auswertung „Erklärsatz je Stand“): Satz und Einzugsbeginn aus `Farm` (`GeldsatzHof`) und das
 * WIRKSAME Gründungsende (null ohne Gründungsplatz oder mit eigenem Einzugsbeginn) — dieselben Werte, mit denen
 * `einzugFuer` beim Bestellen entscheidet (wie getProdukteSeite). Nur Anzeige.
 */
export type GebuehrHofStand = { hof: GeldsatzHof; gruendungBis: Date | null }

/** „6 % je Stück, aufgerundet – …“ — der Satz des Hofs (`satzHundertstel`), nie eine feste Zahl (Board s2-/w2-auswertung). */
export function plattformgebuehrKarteErklaerung(hundertstel: number): string {
  return `${satzText(hundertstel)} % je Stück, aufgerundet – sie steckt im Preis der Kundin; online behält Stripe sie gleich ein.`
}

/** Bar nach dem Ende der Befreiung (Board s2-/w2-auswertung Bild 4): die Monatsabrechnung zieht die Gebühr ein. */
export const PLATTFORMGEBUEHR_KARTE_BAR_EINZUG = 'Die Gebühr aus Barverkäufen ziehen wir einmal im Monat per Lastschrift ein.'

/**
 * Der Bar-Satz der Karte je Stand (Board s2-/w2-auswertung Bild 1–4): solange die Bargebühr erlassen ist
 * „Bar zahlst du als Gründungshof bis 31. Jänner 2028 keine.“ (ohne Gründungsplatz, mit eigenem Einzugsbeginn
 * ohne „als Gründungshof“), danach der Lastschrift-Satz. OB erlassen ist, sagt die Geldsatz-Hilfe
 * (`geldsaetzeFuer`, `barOhneGebuehr` des Angebots: `bezug < einzugAbFuer(…)`), den Tag `letzterFreierTag` —
 * der letzte Tag ohne Gebühr, inklusiv (Nr. 264, Register N48). Keine Rechnung, keine zweite Datumsregel.
 */
export function plattformgebuehrKarteBar(stand: GebuehrHofStand, einstellung: HofpreisEinstellung | null, bezug: Date): string {
  const angebot = geldsaetzeFuer({ art: 'angebot', positionen: [] }, stand.hof, einstellung, stand.gruendungBis, bezug)
  if (!angebot?.barOhneGebuehr) return PLATTFORMGEBUEHR_KARTE_BAR_EINZUG
  const tag = letzterFreierTag(einzugAbFuer(stand.hof, einstellung, stand.gruendungBis))
  // „als Gründungshof“ nur, wenn das Gründungsende den Tag setzt — ein eigener Einzugsbeginn aus dem Admin geht vor.
  const alsGruendungshof = stand.hof.einzugAb === null && stand.gruendungBis !== null ? ' als Gründungshof' : ''
  return `Bar zahlst du${alsGruendungshof} bis ${tag} keine.`
}

/** Titel und Sätze der Gebühren-Karte der Auswertung. */
export type GebuehrenKarteText = {
  /** „Servicegebühren dieses Monats“, „Plattformgebühren dieses Monats“ oder „Gebühren dieses Monats“. */
  titel: string
  erklaerung: string
  bar: string | null
  /** Steht die Zeile „Bar bei Abholung“ auch ohne Barbestellung da? Nur, wo bar eine Gebühr trägt. */
  barZeile: boolean
}

/**
 * Die Gebühren-Karte des laufenden Monats (V62, V63; Lauf 30, Nr. 225): Das Wort kommt
 * über `gebuehrWortFuerMonat` aus den Bestellzeitpunkten des Monats und dem Stichtag
 * „Hofpreis-Modell ab“ (`gebuehrWortFuerZeitraum` — ganz davor „Servicegebühr“, ganz
 * danach „Plattformgebühr“, über den Stichtag „Gebühren“), die Sätze aus dem Modell, das
 * jetzt gilt (`gebuehrModellFuer`) — keine zweite Datumsregel. Vor dem Stichtag bleibt
 * alles wie bisher (`servicegebuehrenSaetze`).
 */
export function gebuehrenKarteText(
  monat: Monatsschluessel,
  einstellung: HofpreisEinstellung | null,
  jetzt: Date,
  /** Der eigene Hof (Nr. 273): mit ihm nennt die Karte Satz und Bar-Stand; ohne ihn die allgemeinen Sätze. */
  stand: GebuehrHofStand | null = null
): GebuehrenKarteText {
  const titel = `${gebuehrenMehrzahl(gebuehrWortFuerMonat(monat, hofpreisModellAb(einstellung)))} dieses Monats`
  if (gebuehrModellFuer(einstellung, jetzt) === 'hofpreis') {
    if (stand) {
      return {
        titel,
        erklaerung: plattformgebuehrKarteErklaerung(satzHundertstel(stand.hof)),
        bar: plattformgebuehrKarteBar(stand, einstellung, jetzt),
        barZeile: true,
      }
    }
    return { titel, erklaerung: PLATTFORMGEBUEHR_KARTE_ERKLAERUNG, bar: PLATTFORMGEBUEHR_KARTE_BAR, barZeile: true }
  }
  return { titel, ...servicegebuehrenSaetze(jetzt), barZeile: !vorBarStichtag(jetzt) }
}

// ─── Fußsatz der Umsatzkarte ───────────────────────────────────────────────

/**
 * Der Fußsatz unter dem Diagramm (Board s2-/w2-auswertung Bild 3, Nr. 273): „Mo und Di: Verkäufe, die du selbst
 * eingetragen hast. Heute holen 4 Bestellungen ab.“ — der erste Teil wie auf Heute (`selbstEingetragenSatz`),
 * der zweite nur in der laufenden Woche und nur, wenn heute jemand abholt. Ohne beides kein Satz.
 */
export function umsatzFussSatz(selbstEingetrageneTage: readonly string[], heuteAbholen: number | null): string | null {
  const heute = heuteAbholen && heuteAbholen > 0 ? (heuteAbholen === 1 ? 'Heute holt 1 Bestellung ab.' : `Heute holen ${heuteAbholen} Bestellungen ab.`) : null
  const teile = [selbstEingetragenSatz(selbstEingetrageneTage), heute].filter((t): t is string => t !== null)
  return teile.length ? teile.join(' ') : null
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
  /** „38 Besuche" — null, wenn es keinen Besuch gab. */
  kopf: string | null
  zeilen: TeilenKartenZeile[]
}

/**
 * Die Karte „Über deine geteilten Links" aus der Zusammenfassung von
 * `getTeilenWirkung`. Nur Besuche: Seit Register T1 wird keine Bestellung
 * einem Kanal zugeordnet, deshalb steht hier weder eine Bestellzahl noch ein
 * Euro-Betrag — die Karte verspricht nichts, was nicht gezählt wird.
 */
export function teilenKarte(wirkung: TeilenWirkung): TeilenKarte {
  if (wirkung.besuche <= 0) return { kopf: null, zeilen: [] }
  const staerkster = Math.max(1, ...wirkung.kanaele.map((k) => k.besuche))
  const besuche = (anzahl: number) => mitAnzahl(anzahl, 'Besuch', 'Besuche')
  return {
    kopf: besuche(wirkung.besuche),
    zeilen: wirkung.kanaele.map((k) => ({
      kanal: k.kanal,
      name: k.name,
      anteilProzent: k.besuche > 0 ? Math.max(2, Math.round((k.besuche / staerkster) * 100)) : 0,
      text: besuche(k.besuche),
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

/**
 * Die Umsatzkarte ohne Verkauf im gewählten Zeitraum (Register N9): Titel und der Weg, einen
 * Verkauf einzutragen — `/sales?neu=1` öffnet dort gleich den Dialog.
 */
export const UMSATZ_LEER = {
  titel: 'Noch keine Verkäufe in diesem Zeitraum',
  aktion: { text: 'Verkauf eintragen', href: '/sales?neu=1' },
} as const
