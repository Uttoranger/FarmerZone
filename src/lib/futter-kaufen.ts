/**
 * Region › Futter kaufen (Nachtlauf Nr. 22c, Gate 8; Mockup
 * web-h5-region-futter-kaufen) — rein, ohne Datenbank prüfbar
 * (tests/futter-kaufen.test.ts). Die Abfrage steht in
 * src/server/queries/futter-kaufen.ts und beschafft nur, was öffentliche
 * Hofseiten ohnehin zeigen; hier wird entschieden:
 *
 *   - welcher Hof als „registrierter Futtermittelbetrieb" gilt: eine
 *     eingetragene Nummer (hatRegistrierung 'LFBIS' — dieselbe Regel wie die
 *     Sperre je Gebinde, Nr. 20). Die Plattform prüft die Nummer nicht (E9);
 *     „registriert" heißt hier wie überall „der Hof hat sie eingetragen".
 *   - welche Größe erscheint: Futtermittel, kaufbar (istKaufbar, wie /hoefe)
 *     und NICHT gesperrt (gebindeSperre mit dem Stand des Hofs, Nr. 20/S7).
 *   - wie Größen zu Karten werden: je Familie eine Karte (E3), sonst je Produkt.
 *   - das Schild: futterSchild aus produktdetail.ts, also genau der Wortlaut
 *     der Produktseite „Futtermittelbetrieb · LFBIS <Nummer>" (E9, ohne
 *     Prüfvermerk) — kein zweiter Wortlaut.
 *
 * Die Sichtbarkeit fremder Höfe (öffentlich, aktiv, freigeschaltet, nicht
 * pausiert) steht in der WHERE-Klausel der Abfrage — dieselbe Regel wie das
 * Umfeld, keine zweite.
 */
import { formatEuro, formatKilopreis, mitAnzahl } from '@/lib/format'
import { istKaufbar, grundpreisAusKennzeichnung, type Grundpreis } from '@/lib/bereiche-anzeige'
import { gebindeSperre, hatRegistrierung, type VerpackungValue } from '@/lib/futter-registrierung'
import { formatiereAbholung, formatiereEntfernung, naechsteAbholung, type AbholFenster, type OrtsZeit } from '@/lib/hofuebersicht'
import { futterSchild, gemeinsamerAnfang, produktPfad } from '@/lib/produktdetail'
import {
  KATEGORIE_LABEL,
  istFuttermittel,
  istGrossgebinde,
  type BetriebsstatusValue,
  type NettoEinheitValue,
  type ProductCategoryValue,
} from '@/lib/taxonomie'
import { UMFELD_KM, type UmfeldKm } from '@/lib/umfeld'
import { mitKaeuferVorbelegung } from '@/schemas/kaeufer-vorbelegung'
import { FUTTER_ART_VALUES, type FutterArt, type FutterKaufenFilter, type FutterMenge } from '@/schemas/region'

// ─── Eingabe ────────────────────────────────────────────────────────────────

/** Ein fremder Hof im Umkreis — nur, was seine öffentliche Hofseite auch zeigt (keine Adresse, kein Kontakt). */
export type FutterHof = {
  id: string
  slug: string
  name: string
  entfernungKm: number
  betriebsnummer: string | null
  betriebsstatus: BetriebsstatusValue | null
  /** Die aktiven Abholzeiten — für „Abholung Samstag 08:00–12:00". */
  abholfenster: AbholFenster[]
}

/** Eine Größe, so schmal, wie die Karte sie braucht. Der Preis ist Anzeige (Decimal → Zahl an der Servergrenze, wie das Umfeld). */
export type FutterProdukt = {
  id: string
  farmId: string
  name: string
  familieId: string | null
  category: ProductCategoryValue | null
  price: number
  isAvailable: boolean
  stock: number
  reservedStock: number
  verpackung: VerpackungValue | null
  futter: { nettoMenge: number; nettoEinheit: NettoEinheitValue; betriebsnummer: string | null } | null
}

export type FutterKaufenEingabe = {
  hoefe: readonly FutterHof[]
  produkte: readonly FutterProdukt[]
  /** Sichtbare Höfe ohne Standort — gezählt (nur registrierte mit Angebot), nie gezeigt. Ihre Größen stehen in `produkte`. */
  ohneStandort: readonly Pick<FutterHof, 'id' | 'betriebsnummer' | 'betriebsstatus'>[]
  abgeschnitten: boolean
  filter: FutterKaufenFilter
  /** „Jetzt" in Wiener Ortszeit, für die nächste Abholung. */
  jetzt: OrtsZeit
}

// ─── Ausgabe ────────────────────────────────────────────────────────────────

export type FutterGroesse = {
  id: string
  /** „5 kg-Sack" — der Name ohne den Teil, den alle Größen teilen. */
  name: string
  preis: string
  /** Die Produktseite dieser Größe mit `?kaeufer=betrieb` (Nr. 29); dort wird gekauft. */
  href: string
}

export type FutterAngebot = {
  schluessel: string
  name: string
  hofName: string
  /** „Bergbauernhof · 6,0 km · Abholung Samstag 08:00–12:00" ohne den Hofnamen — der steht eigens. */
  entfernung: string
  abholung: string | null
  /** „Futtermittelbetrieb · LFBIS 1234567" (E9) oder null (Wortlaut für andere Status nicht entschieden). */
  schild: string | null
  /** „ab € 0,18 / kg" bei mehreren Größen, sonst „€ 0,17 / kg"; null ohne Kennzeichnung. */
  grundpreis: string | null
  groessen: FutterGroesse[]
  /** „Bestellen" führt zur ersten Größe — die Produktseite bietet die übrigen zur Wahl; mit `?kaeufer=betrieb`. */
  bestellenHref: string
}

export type FutterChip<T extends string> = { wert: T | null; label: string; anzahl: number; aktiv: boolean }

export type FutterKaufenAnsicht = {
  angebote: FutterAngebot[]
  /** „Alle" und die Arten, die es im Umkreis gibt (bzw. die gewählte). */
  artChips: FutterChip<FutterArt>[]
  /** „Alle Mengen", „Kleinmengen", „Ballen & mehr" — nur, was es gibt (bzw. das gewählte). */
  mengeChips: FutterChip<FutterMenge>[]
  hinweise: string[]
  /** null, wenn es Angebote gibt. */
  leer: { satz: string; weiterUmkreis: UmfeldKm | null; auswahlZuruecksetzen: boolean } | null
}

// ─── Regeln ─────────────────────────────────────────────────────────────────

export const FUTTER_KAUFEN_HINWEIS = 'Hier siehst du nur registrierte Futtermittelbetriebe – du kaufst für deine Tiere.'
export const FUTTER_SELBST_VERKAUFEN =
  'Du verkaufst selbst Futter? Leg es unter Futtermittel an – mit Verkaufsgrößen vom Sackerl bis zum Rundballen. Dann finden es Höfe hier und Kleintierhalter im Entdecken.'

const MENGE_LABEL: Record<FutterMenge, string> = { klein: 'Kleinmengen', gross: 'Ballen & mehr' }

/**
 * Der Weg zur Produktseite eines anderen Hofs. Wer hier kauft, ist ein Hof und
 * kauft für seine Tiere: `?kaeufer=betrieb` belegt in der Kasse den Haken
 * „Betrieb" vor (Nr. 29, Gate 8) — nur vor, prüfen tut /api/checkout.
 */
function kaufLink(slug: string, id: string): string {
  return mitKaeuferVorbelegung(produktPfad(slug, id), 'betrieb')
}

/** Gilt der Hof als registrierter Futtermittelbetrieb? Eine eingetragene Nummer genügt (LFBIS, E9: ungeprüft). */
export function istRegistrierterBetrieb(hof: Pick<FutterHof, 'betriebsnummer' | 'betriebsstatus'>): boolean {
  return hatRegistrierung('LFBIS', hof)
}

/** Darf diese Größe in „Futter kaufen" stehen? Futtermittel, kaufbar, nicht gesperrt. */
export function istAngebotenesFutter(p: FutterProdukt, hof: Pick<FutterHof, 'betriebsnummer' | 'betriebsstatus'>): boolean {
  return istFuttermittel(p.category) && istKaufbar(p) && gebindeSperre(p, hof) === null
}

function mengePasst(p: FutterProdukt, menge: FutterMenge | null): boolean {
  if (menge === null) return true
  // Ohne Kennzeichnung ist die Menge unbekannt — weder klein noch groß (wie /hoefe).
  if (!p.futter) return false
  const gross = istGrossgebinde(p.futter.nettoMenge, p.futter.nettoEinheit)
  return menge === 'gross' ? gross : !gross
}

function artPasst(p: FutterProdukt, art: FutterArt | null): boolean {
  return art === null || p.category === art
}

/** Familien zusammenfassen, je Hof, in der Reihenfolge der Eingabe. */
function familien(produkte: readonly FutterProdukt[]): FutterProdukt[][] {
  const reihe: FutterProdukt[][] = []
  const jeSchluessel = new Map<string, FutterProdukt[]>()
  for (const p of produkte) {
    const schluessel = `${p.farmId}:${p.familieId ?? p.id}`
    const vorhanden = jeSchluessel.get(schluessel)
    if (vorhanden) vorhanden.push(p)
    else {
      const neu = [p]
      jeSchluessel.set(schluessel, neu)
      reihe.push(neu)
    }
  }
  return reihe
}

function grundpreisText(gruppe: readonly FutterProdukt[]): string | null {
  const preise = gruppe
    .map((p) => grundpreisAusKennzeichnung(p.price, p.futter))
    .filter((g): g is Grundpreis => g !== null)
  if (preise.length === 0) return null
  const guenstigster = preise.reduce((a, b) => (b.wert < a.wert ? b : a))
  const text = formatKilopreis(guenstigster)
  if (text === null) return null
  return preise.length > 1 ? `ab ${text}` : text
}

function angebotAus(gruppe: readonly FutterProdukt[], hof: FutterHof, jetzt: OrtsZeit): FutterAngebot {
  const sortiert = gruppe.toSorted((a, b) => a.price - b.price)
  const erstes = sortiert[0]
  const anfang = gemeinsamerAnfang(sortiert.map((p) => p.name))
  const name = anfang > 0 ? erstes.name.trim().split(/\s+/).slice(0, anfang).join(' ') : erstes.name
  const abholung = naechsteAbholung(hof.abholfenster, jetzt)
  return {
    schluessel: `${hof.slug}:${erstes.familieId ?? erstes.id}`,
    name: sortiert.length > 1 ? name : erstes.name,
    hofName: hof.name,
    entfernung: formatiereEntfernung(hof.entfernungKm),
    abholung: abholung ? `Abholung ${formatiereAbholung(abholung)}` : null,
    schild: futterSchild(erstes, hof.betriebsstatus),
    grundpreis: grundpreisText(sortiert),
    groessen: sortiert.map((p) => {
      const rest = p.name.trim().split(/\s+/).slice(anfang).join(' ')
      return { id: p.id, name: sortiert.length > 1 ? rest || p.name : p.name, preis: formatEuro(p.price), href: kaufLink(hof.slug, p.id) }
    }),
    bestellenHref: kaufLink(hof.slug, erstes.id),
  }
}

/** Die Karten für einen Filter — Höfe nach Entfernung, je Hof in der Reihenfolge der Abfrage. */
function karten(
  hoefe: readonly FutterHof[],
  angeboten: ReadonlyMap<string, FutterProdukt[]>,
  filter: Pick<FutterKaufenFilter, 'art' | 'menge'>,
  jetzt: OrtsZeit
): FutterAngebot[] {
  const ergebnis: FutterAngebot[] = []
  for (const hof of hoefe.toSorted((a, b) => a.entfernungKm - b.entfernungKm)) {
    const passend = (angeboten.get(hof.id) ?? []).filter((p) => artPasst(p, filter.art) && mengePasst(p, filter.menge))
    for (const gruppe of familien(passend)) ergebnis.push(angebotAus(gruppe, hof, jetzt))
  }
  return ergebnis
}

/** Die Größen je Hof, die überhaupt erscheinen dürfen — nur registrierte Höfe. */
export function angeboteneGroessen(
  hoefe: readonly Pick<FutterHof, 'id' | 'betriebsnummer' | 'betriebsstatus'>[],
  produkte: readonly FutterProdukt[]
): Map<string, FutterProdukt[]> {
  const hofJeId = new Map(hoefe.map((h) => [h.id, h]))
  const jeHof = new Map<string, FutterProdukt[]>()
  for (const p of produkte) {
    const hof = hofJeId.get(p.farmId)
    if (!hof || !istRegistrierterBetrieb(hof) || !istAngebotenesFutter(p, hof)) continue
    jeHof.set(p.farmId, [...(jeHof.get(p.farmId) ?? []), p])
  }
  return jeHof
}

/** Alles für den Reiter „Futter kaufen": Karten, Filter-Chips, Hinweise, Leerzustand. */
export function baueFutterKaufen(eingabe: FutterKaufenEingabe): FutterKaufenAnsicht {
  const { filter, jetzt } = eingabe
  const hoefe = eingabe.hoefe.filter(istRegistrierterBetrieb)
  const angeboten = angeboteneGroessen(hoefe, eingabe.produkte)
  const angebote = karten(hoefe, angeboten, filter, jetzt)

  // Chips zählen Karten bei der übrigen Auswahl — wie die Facetten auf /hoefe.
  const artChips: FutterChip<FutterArt>[] = [
    { wert: null, label: 'Alle', anzahl: karten(hoefe, angeboten, { art: null, menge: filter.menge }, jetzt).length, aktiv: filter.art === null },
    ...FUTTER_ART_VALUES.map((art) => ({
      wert: art,
      label: KATEGORIE_LABEL[art],
      anzahl: karten(hoefe, angeboten, { art, menge: filter.menge }, jetzt).length,
      aktiv: filter.art === art,
    })).filter((c) => c.anzahl > 0 || c.aktiv),
  ]
  const mengeChips: FutterChip<FutterMenge>[] = [
    { wert: null, label: 'Alle Mengen', anzahl: karten(hoefe, angeboten, { art: filter.art, menge: null }, jetzt).length, aktiv: filter.menge === null },
    ...(['klein', 'gross'] as const)
      .map((menge) => ({
        wert: menge,
        label: MENGE_LABEL[menge],
        anzahl: karten(hoefe, angeboten, { art: filter.art, menge }, jetzt).length,
        aktiv: filter.menge === menge,
      }))
      .filter((c) => c.anzahl > 0 || c.aktiv),
  ]

  const hinweise: string[] = []
  const ohneStandort = angeboteneGroessen(eingabe.ohneStandort, eingabe.produkte).size
  if (ohneStandort > 0) hinweise.push(`${mitAnzahl(ohneStandort, 'Hof', 'Höfe')} ohne Standort nicht berücksichtigt.`)
  if (eingabe.abgeschnitten) hinweise.push('Wir zeigen die nächsten Höfe – weiter entfernte fehlen.')

  let leer: FutterKaufenAnsicht['leer'] = null
  if (angebote.length === 0) {
    const gefiltert = filter.art !== null || filter.menge !== null
    const ohneAuswahl = gefiltert ? karten(hoefe, angeboten, { art: null, menge: null }, jetzt).length : 0
    if (gefiltert && ohneAuswahl > 0) {
      leer = { satz: 'Zu deiner Auswahl gibt es im Umkreis gerade kein Angebot.', weiterUmkreis: null, auswahlZuruecksetzen: true }
    } else {
      const weiter = UMFELD_KM.find((km) => km > filter.km) ?? null
      leer = {
        satz: `Im Umkreis von ${filter.km} km verkauft gerade kein registrierter Futtermittelbetrieb Futter.`,
        weiterUmkreis: weiter,
        auswahlZuruecksetzen: false,
      }
    }
  }

  return { angebote, artChips, mengeChips, hinweise, leer }
}
