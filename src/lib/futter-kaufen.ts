/**
 * Region › Futter kaufen (Nachtlauf Nr. 22c, Gate 8; seit Nr. 123 nach Board
 * system-h5-region-v2 §3 und system-h5-region-eigene-teile §3/§4, Register
 * N23 und E9) — rein, ohne Datenbank prüfbar (tests/futter-kaufen.test.ts).
 * Die Abfrage steht in src/server/queries/futter-kaufen.ts und beschafft nur,
 * was öffentliche Hofseiten ohnehin zeigen; hier wird entschieden:
 *
 *   - welcher Hof erscheint: einer mit LFBIS-Nummer — eine eingetragene
 *     Nummer genügt (hatRegistrierung 'LFBIS', dieselbe Regel wie die Sperre
 *     je Gebinde, Nr. 20). Die Plattform prüft die Nummer nicht (E9); die
 *     Texte sagen deshalb „Höfe mit LFBIS-Nummer", nie „registriert".
 *   - welche Größe erscheint: Futtermittel, im Shop und NICHT gesperrt
 *     (gebindeSperre mit dem Stand des Hofs, Nr. 20/S7); kaufbar (istKaufbar,
 *     wie /hoefe) oder „derzeit aus". Ein Angebot steht nur da, wenn
 *     mindestens eine Größe kaufbar ist.
 *   - wie Größen zu Karten werden: je Familie eine Karte (E3), sonst je
 *     Produkt; die Größen in der Reihenfolge des Hofs — der Reihenfolge der
 *     Abfrage, dieselbe wie auf der Produktseite (PRODUCT_ORDER_BY), hier wird
 *     nicht sortiert.
 *   - Umkreis und Abholung: Die Abfrage lädt einmal 50 km; gezählt wird je
 *     Stufe (zaehleJeStufe) mit den übrigen Filtern, gezeigt der gewählte
 *     Umkreis. Abholung rechnet mit holtAbAnTagen/tageDerAbholwahl wie /hoefe.
 *   - das Schild: futterSchild aus produktdetail.ts, also genau der Wortlaut
 *     der Produktseite (E9) — kein zweiter Wortlaut.
 *
 * Leitplanken (N23): keine Sortierung nach Preis, kein Text, der einen Preis
 * wertet; „günstigster Kilopreis" gilt nur innerhalb EINES Angebots.
 */
import { MARKE } from '@/lib/marke'
import { formatEuro, formatKilopreis, mitAnzahl } from '@/lib/format'
import { alsCents } from '@/lib/order-totals'
import { istKaufbar, grundpreisAusKennzeichnung, type Grundpreis } from '@/lib/bereiche-anzeige'
import { gebindeSperre, hatRegistrierung, type VerpackungValue } from '@/lib/futter-registrierung'
import { holtAbAnTagen, tageDerAbholwahl, type AbholFenster, type AbholHof } from '@/lib/hofuebersicht'
import { ABHOLUNG_TEXT, ABHOLUNG_ZEIGEN, abholungLeerSaetze, naechsterAbholtag } from '@/lib/hoefe-entdecken'
import { futterSchild, gemeinsamerAnfang, produktPfad } from '@/lib/produktdetail'
import {
  KATEGORIE_LABEL,
  illustrationPfad,
  istFuttermittel,
  istGrossgebinde,
  type BetriebsstatusValue,
  type NettoEinheitValue,
  type ProductCategoryValue,
  type ProductSubcategoryValue,
} from '@/lib/taxonomie'
import { UMFELD_KM, type UmfeldKm } from '@/lib/umfeld'
import { ohneStandortHinweis, zaehleJeStufe } from '@/lib/region'
import { ordneAbholhinweise, type AbholhinweisValue } from '@/lib/abholhinweise'
import { PRODUKTE_HREF } from '@/lib/bauern-navigation'
import { mitKaeuferVorbelegung } from '@/schemas/kaeufer-vorbelegung'
import type { BildAusschnitt } from '@/schemas/bild-ausschnitt'
import { ABHOLUNG_VALUES, type AbholungWahl } from '@/schemas/hoefe-filter'
import { FUTTER_ART_VALUES, type FutterArt, type FutterKaufenFilter, type FutterMenge } from '@/schemas/region'

// ─── Eingabe ────────────────────────────────────────────────────────────────

/** Ein fremder Hof im Umkreis — nur, was seine öffentliche Hofseite und /hoefe auch zeigen (keine Adresse, kein Kontakt). */
export type FutterHof = {
  id: string
  slug: string
  name: string
  postalCode: string
  city: string
  /** Kartenpunkt — wie auf /hoefe öffentlich; nur für die Pins. */
  latitude: number
  longitude: number
  entfernungKm: number
  betriebsnummer: string | null
  betriebsstatus: BetriebsstatusValue | null
  /** Die aktiven Abholzeiten — wie auf /hoefe; bestellbar ist ein Fenster nur vor seinem Beginn (abholfenster.ts). */
  abholfenster: AbholFenster[]
  /** Fotostreifen und Kategorien wie auf /hoefe (baueHofUebersicht) — Bild der Karte am Pin. */
  fotos: string[]
  kategorien: ProductCategoryValue[]
}

/** Eine Größe, so schmal, wie die Karte sie braucht. Der Preis ist Anzeige (Decimal → Zahl an der Servergrenze, wie das Umfeld). */
export type FutterProdukt = {
  id: string
  farmId: string
  name: string
  familieId: string | null
  category: ProductCategoryValue | null
  subcategory: ProductSubcategoryValue | null
  price: number
  isAvailable: boolean
  stock: number
  reservedStock: number
  verpackung: VerpackungValue | null
  futter: { nettoMenge: number; nettoEinheit: NettoEinheitValue; betriebsnummer: string | null } | null
  abholhinweise: AbholhinweisValue[]
  /** Produktfoto samt Ausschnitt; sonst die Illustration (product-image.ts, auf dem Server aufgelöst). */
  foto: string | null
  fotoAusschnitt: BildAusschnitt | null
  illustration: string | null
}

/** Der eigene Hof: Mittelpunkt, „Du" auf der Karte und die Zeile „Selbst verkaufen". */
export type EigenerFutterHof = {
  name: string
  latitude: number
  longitude: number
  /** In Listen sichtbar (IN_LISTEN_SICHTBAR, kein Testhof) und nicht pausiert. */
  sichtbar: boolean
  betriebsnummer: string | null
  betriebsstatus: BetriebsstatusValue | null
  /** Die eigenen Futter-Produkte im Shop (isAvailable), in der Reihenfolge des Hofs. */
  futter: FutterProdukt[]
}

export type FutterKaufenEingabe = {
  /** Alle sichtbaren Höfe mit Standort bis 50 km — gefiltert wird hier. */
  hoefe: readonly FutterHof[]
  produkte: readonly FutterProdukt[]
  /** Sichtbare Höfe ohne Standort — gezählt (nur solche mit Nummer und Angebot), nie gezeigt. Ihre Größen stehen in `produkte`. */
  ohneStandort: readonly Pick<FutterHof, 'id' | 'betriebsnummer' | 'betriebsstatus'>[]
  abgeschnitten: boolean
  eigen: EigenerFutterHof
  filter: FutterKaufenFilter
  jetzt: Date
}

// ─── Ausgabe ────────────────────────────────────────────────────────────────

export type FutterGroesse = {
  id: string
  /** „5 kg-Sack" — der Name ohne den Teil, den alle Größen teilen. */
  name: string
  preis: string
  /** „€ 1,60 / kg" — centgenau aus Preis und Nettomenge; null ohne Kennzeichnung. */
  kilopreis: string | null
  /** false = „derzeit aus", nicht wählbar. */
  kaufbar: boolean
  /** Die Produktseite genau dieser Größe mit `?kaeufer=betrieb` (Nr. 29); dort wird gekauft. */
  kaufLink: string
  /** „günstigster Kilopreis" — nur innerhalb dieses Angebots, nie gegen andere Höfe. */
  guenstigster: boolean
}

/** Ein Abholhinweis als Kennzeichen; `groessen` nur, wenn nicht alle Größen ihn tragen („Rundballen: Anhänger nötig"). */
export type FutterAbholKennzeichen = { hinweis: AbholhinweisValue; groessen: string | null }

export type FutterAngebot = {
  schluessel: string
  name: string
  hof: { slug: string; name: string; postalCode: string; city: string; entfernungKm: number }
  abholfenster: AbholFenster[]
  /** 48 px: das Produktfoto, sonst die Illustration der Futterart. */
  bild: { foto: string | null; ausschnitt: BildAusschnitt | null; illustration: string }
  /** „Futtermittelbetrieb · LFBIS 1234567 · laut Hof" (E9) oder null (Wortlaut für andere Status nicht entschieden). */
  schild: string | null
  /** „ab € 0,18 / kg" bei mehreren kaufbaren Größen, sonst „€ 0,17 / kg"; null ohne Kennzeichnung. */
  grundpreis: string | null
  abholhinweise: FutterAbholKennzeichen[]
  groessen: FutterGroesse[]
  /** Die erste kaufbare Größe — ohne JavaScript gilt sie. */
  vorgewaehlt: string
}

export type FutterChip<T extends string> = { wert: T | null; label: string; anzahl: number; aktiv: boolean }

export type FutterPin = { slug: string; nummer: number; lat: number; lon: number; name: string }

/** Was die Karte am Pin von einem Hof zeigt (HofKurzkarte, Art „region"). */
export type FutterPinKarte = {
  hof: {
    slug: string
    name: string
    postalCode: string
    city: string
    isPaused: false
    kategorien: ProductCategoryValue[]
    abholfenster: AbholFenster[]
    angebot: readonly string[]
    fotos: string[]
    entfernungKm: number
  }
  /** Das erste Angebot des Hofs in der Reihenfolge der Liste. */
  angebot: FutterAngebot
  /** Höchstens zwei Größen davon, kaufbare zuerst. */
  zeilen: { name: string; preis: string }[]
  /** „und 2 weitere Angebote in der Liste" — null bei einem. */
  weitere: string | null
}

export type FutterLeer = {
  titel: string
  satz: string
  /** Der eine Ausweg: zum nächsten Tag, zur ganzen Auswahl, zum größeren Umkreis oder zu allen Tagen. */
  ausweg:
    | { art: 'abholung'; label: string; abholung: AbholungWahl | null }
    | { art: 'auswahl'; label: string }
    | { art: 'umkreis'; label: string; km: UmfeldKm }
    | null
}

export type FutterSelbst =
  | { art: 'anlegen' }
  | { art: 'zeile'; satz: string; href: string }
  | null

export type FutterKaufenAnsicht = {
  angebote: FutterAngebot[]
  /** Wie viele Angebote jede Stufe des Umkreises mit den gewählten Filtern zeigen würde. */
  zahlenJeStufe: Record<UmfeldKm, number>
  /** „Alle" und die Arten, die es im Umkreis gibt (bzw. die gewählte). */
  artChips: FutterChip<FutterArt>[]
  /** „Alle Mengen", „Kleinmengen", „Ballen & mehr" — nur, was es gibt (bzw. das gewählte). */
  mengeChips: FutterChip<FutterMenge>[]
  /** Alle Tage · Heute · Morgen · Wochenende — immer alle vier (wie /hoefe). */
  abholungChips: FutterChip<AbholungWahl>[]
  /** Die Zeile am Handy: „2 Angebote holen heute ab · nur Höfe mit LFBIS-Nummer". */
  zahlZeile: string
  hinweise: string[]
  /** null, wenn es Angebote gibt. */
  leer: FutterLeer | null
  karte: {
    zentrum: { lat: number; lon: number; radiusKm: UmfeldKm; titel: string }
    pins: FutterPin[]
    karten: Record<string, FutterPinKarte>
  }
  selbst: FutterSelbst
}

// ─── Texte (E9-Ergänzung, N23) ──────────────────────────────────────────────

/** Der Hinweis über der Liste (E9): nie „registriert", nie „geprüft". */
export const FUTTER_KAUFEN_HINWEIS = 'Höfe mit LFBIS-Nummer – du kaufst für deine Tiere.'
/** Der Zusatz der Zeile am Handy (Board v2, Handy 3; Freigabe §1 Abweichung 5). */
export const FUTTER_NUR_LFBIS = 'nur Höfe mit LFBIS-Nummer'
/** „So rechnen wir" für Futter: der (i)-Knopf mit drei Punkten (E9-Ergänzung). */
export const FUTTER_ERKLAERUNG = {
  titel: 'Höfe mit LFBIS-Nummer',
  punkte: [
    'Hier stehen nur Höfe, die eine LFBIS-Nummer als Futtermittelbetrieb angegeben haben.',
    `Die Nummer gibt der Hof selbst an. ${MARKE} prüft sie nicht.`,
    'Bestellen und Abholen laufen wie immer über die Produktseite des Hofs.',
  ],
} as const
export const FUTTER_SELBST_VERKAUFEN =
  'Du verkaufst selbst Futter? Leg es unter Futtermittel an – mit Verkaufsgrößen vom Sackerl bis zum Rundballen. Dann finden es Höfe hier und Kleintierhalter im Entdecken.'
/** Die Wörter der Futterkarte und der Karte am Pin. */
export const FUTTER_KARTE_TEXT = {
  groesse: 'Größe',
  guenstigster: 'günstigster Kilopreis',
  derzeitAus: 'derzeit aus',
  bestellen: 'Bestellen',
  grundpreis: 'Grundpreis',
  ansehen: 'Ansehen',
  umkreisZahl: 'Umkreis, Zahl der Angebote je Stufe',
  leerTitel: 'Gerade kein Futter in der Nähe',
  allesFutter: 'Alles Futter zeigen',
} as const
/** Die Marke „günstigster Kilopreis" gibt es erst, wenn die günstigste Größe MEHR als so viele Prozent darunter liegt. */
export const GUENSTIGSTER_AB_PROZENT = 5

const MENGE_LABEL: Record<FutterMenge, string> = { klein: 'Kleinmengen', gross: 'Ballen & mehr' }

/** Wohin „Ansehen ›" führt: die eigene Produktliste mit dem Filter Futter (/products?filter=futter, Nr. 18). */
export const EIGENES_FUTTER_HREF = `${PRODUKTE_HREF}?filter=futter`

/** Der Knopf der Futterkarte: „Bestellen · 5 kg-Sack · € 8,00", bei nur einer Größe „Bestellen · € 42,00". */
export function bestellenText(angebot: Pick<FutterAngebot, 'groessen'>, groesse: Pick<FutterGroesse, 'name' | 'preis'>): string {
  return angebot.groessen.length > 1
    ? `${FUTTER_KARTE_TEXT.bestellen} · ${groesse.name} · ${groesse.preis}`
    : `${FUTTER_KARTE_TEXT.bestellen} · ${groesse.preis}`
}

// ─── Regeln ─────────────────────────────────────────────────────────────────

/**
 * Der Weg zur Produktseite eines anderen Hofs. Wer hier kauft, ist ein Hof und
 * kauft für seine Tiere: `?kaeufer=betrieb` belegt in der Kasse den Haken
 * „Betrieb" vor (Nr. 29, Gate 8) — nur vor, prüfen tut /api/checkout.
 */
function kaufLink(slug: string, id: string): string {
  return mitKaeuferVorbelegung(produktPfad(slug, id), 'betrieb')
}

/** Hat der Hof eine LFBIS-Nummer eingetragen? Eine eingetragene Nummer genügt (E9: ungeprüft). */
export function istRegistrierterBetrieb(hof: Pick<FutterHof, 'betriebsnummer' | 'betriebsstatus'>): boolean {
  return hatRegistrierung('LFBIS', hof)
}

/** Darf diese Größe in „Futter kaufen" stehen? Futtermittel, im Shop, nicht gesperrt — kaufbar oder „derzeit aus". */
function darfErscheinen(p: FutterProdukt, hof: Pick<FutterHof, 'betriebsnummer' | 'betriebsstatus'>): boolean {
  return istFuttermittel(p.category) && p.isAvailable && gebindeSperre(p, hof) === null
}

/** Ist diese Größe angeboten UND gerade kaufbar? */
export function istAngebotenesFutter(p: FutterProdukt, hof: Pick<FutterHof, 'betriebsnummer' | 'betriebsstatus'>): boolean {
  return darfErscheinen(p, hof) && istKaufbar(p)
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

/** Die Größen je Hof, die überhaupt erscheinen dürfen — nur Höfe mit Nummer; kaufbar oder „derzeit aus". */
export function angeboteneGroessen(
  hoefe: readonly Pick<FutterHof, 'id' | 'betriebsnummer' | 'betriebsstatus'>[],
  produkte: readonly FutterProdukt[]
): Map<string, FutterProdukt[]> {
  const hofJeId = new Map(hoefe.map((h) => [h.id, h]))
  const jeHof = new Map<string, FutterProdukt[]>()
  for (const p of produkte) {
    const hof = hofJeId.get(p.farmId)
    if (!hof || !istRegistrierterBetrieb(hof) || !darfErscheinen(p, hof)) continue
    jeHof.set(p.farmId, [...(jeHof.get(p.farmId) ?? []), p])
  }
  return jeHof
}

/** Ein Grundpreis in ganzen Zahlen — Cent je Tausendstel der Einheit als Bruch, für einen genauen Vergleich ohne Rundungsfehler. */
function kilopreisBruch(p: FutterProdukt): { cent: number; tausendstel: number } | null {
  if (!p.futter || p.futter.nettoMenge <= 0 || p.price <= 0) return null
  // Mengen sind Decimal(10,3) — als Tausendstel ganzzahlig; Preise über alsCents (CODING_STANDARDS §2).
  return { cent: alsCents(p.price), tausendstel: Math.round(p.futter.nettoMenge * 1000) }
}

/**
 * Welche Größe trägt „günstigster Kilopreis"? Nur bei mindestens zwei
 * kaufbaren Größen mit Kilopreis, und nur, wenn die günstigste MEHR als 5 %
 * unter der zweitgünstigsten liegt — genau 5 % geben keine Marke. Verglichen
 * wird über Kreuz in ganzen Zahlen (a/b < 0,95 · c/d ⇔ 100·a·d < 95·c·b),
 * damit die Grenze nicht an einem Rundungsfehler hängt. Nur innerhalb dieses
 * Angebots, nie gegen andere Höfe (N23).
 */
export function guenstigsteGroesse(groessen: readonly FutterProdukt[]): string | null {
  const mitPreis = groessen
    .filter(istKaufbar)
    .map((p) => ({ id: p.id, bruch: kilopreisBruch(p) }))
    .filter((g): g is { id: string; bruch: { cent: number; tausendstel: number } } => g.bruch !== null)
  if (mitPreis.length < 2) return null
  const kleiner = (a: { cent: number; tausendstel: number }, b: { cent: number; tausendstel: number }) =>
    a.cent * b.tausendstel < b.cent * a.tausendstel
  const sortiert = mitPreis.toSorted((a, b) => (kleiner(a.bruch, b.bruch) ? -1 : kleiner(b.bruch, a.bruch) ? 1 : 0))
  const [erste, zweite] = sortiert
  const faktor = 100 - GUENSTIGSTER_AB_PROZENT
  return 100 * erste.bruch.cent * zweite.bruch.tausendstel < faktor * zweite.bruch.cent * erste.bruch.tausendstel ? erste.id : null
}

function grundpreisText(gruppe: readonly FutterProdukt[]): string | null {
  const preise = gruppe
    .filter(istKaufbar)
    .map((p) => grundpreisAusKennzeichnung(p.price, p.futter))
    .filter((g): g is Grundpreis => g !== null)
  if (preise.length === 0) return null
  const guenstigster = preise.reduce((a, b) => (b.wert < a.wert ? b : a))
  const text = formatKilopreis(guenstigster)
  if (text === null) return null
  return preise.length > 1 ? `ab ${text}` : text
}

/**
 * Die Abholhinweise eines Angebots als Kennzeichen, in der Folge der Auswahl:
 * Tragen alle Größen einen Hinweis, steht er allein; sonst stehen die Größen
 * davor, die ihn tragen („Rundballen: Anhänger nötig").
 */
export function abholKennzeichen(groessen: readonly { name: string; abholhinweise: readonly AbholhinweisValue[] }[]): FutterAbholKennzeichen[] {
  const alle = ordneAbholhinweise(groessen.flatMap((g) => g.abholhinweise))
  return alle.map((hinweis) => {
    const mit = groessen.filter((g) => g.abholhinweise.includes(hinweis))
    return { hinweis, groessen: mit.length === groessen.length ? null : mit.map((g) => g.name).join(', ') }
  })
}

function angebotAus(gruppe: readonly FutterProdukt[], hof: FutterHof): FutterAngebot | null {
  const ersteKaufbare = gruppe.find(istKaufbar)
  if (!ersteKaufbare) return null
  const erstes = gruppe[0]
  const anfang = gemeinsamerAnfang(gruppe.map((p) => p.name))
  const name = gruppe.length > 1 && anfang > 0 ? erstes.name.trim().split(/\s+/).slice(0, anfang).join(' ') : erstes.name
  const guenstigste = guenstigsteGroesse(gruppe)
  const groessen: FutterGroesse[] = gruppe.map((p) => {
    const rest = p.name.trim().split(/\s+/).slice(anfang).join(' ')
    return {
      id: p.id,
      name: gruppe.length > 1 ? rest || p.name : p.name,
      preis: formatEuro(p.price),
      kilopreis: p.futter ? formatKilopreis({ preis: p.price, menge: p.futter.nettoMenge, einheit: p.futter.nettoEinheit }) : null,
      kaufbar: istKaufbar(p),
      kaufLink: kaufLink(hof.slug, p.id),
      guenstigster: p.id === guenstigste,
    }
  })
  const mitFoto = gruppe.find((p) => p.foto)
  return {
    schluessel: `${hof.slug}:${erstes.familieId ?? erstes.id}`,
    name,
    hof: { slug: hof.slug, name: hof.name, postalCode: hof.postalCode, city: hof.city, entfernungKm: hof.entfernungKm },
    abholfenster: hof.abholfenster,
    bild: {
      foto: mitFoto?.foto ?? null,
      ausschnitt: mitFoto?.fotoAusschnitt ?? null,
      illustration: erstes.illustration ?? illustrationPfad(erstes.category, erstes.subcategory),
    },
    schild: futterSchild(erstes, hof.betriebsstatus),
    grundpreis: grundpreisText(gruppe),
    abholhinweise: abholKennzeichen(gruppe.map((p, i) => ({ name: groessen[i].name, abholhinweise: p.abholhinweise }))),
    groessen,
    vorgewaehlt: ersteKaufbare.id,
  }
}

type Auswahl = Pick<FutterKaufenFilter, 'art' | 'menge' | 'abholung'> & { km: number }

/** Die Karten für eine Auswahl — Höfe nach Entfernung, je Hof in der Reihenfolge der Abfrage. */
function karten(
  hoefe: readonly FutterHof[],
  angeboten: ReadonlyMap<string, FutterProdukt[]>,
  auswahl: Auswahl,
  jetzt: Date
): FutterAngebot[] {
  const tage = auswahl.abholung ? tageDerAbholwahl(auswahl.abholung, jetzt) : null
  const ergebnis: FutterAngebot[] = []
  for (const hof of hoefe.toSorted((a, b) => a.entfernungKm - b.entfernungKm)) {
    if (hof.entfernungKm > auswahl.km) continue
    const passend = (angeboten.get(hof.id) ?? []).filter((p) => artPasst(p, auswahl.art) && mengePasst(p, auswahl.menge))
    const angebote = familien(passend)
      .map((gruppe) => angebotAus(gruppe, hof))
      .filter((a): a is FutterAngebot => a !== null)
    if (angebote.length === 0) continue
    // Abholung: dieselbe Regel wie /hoefe (holtAbAnTagen) — nur Fenster, die man noch bestellen kann.
    if (tage && !holtAbAnTagen(alsAbholHof(hof, angebote), tage, jetzt)) continue
    ergebnis.push(...angebote)
  }
  return ergebnis
}

/** Ein Hof, wie der Filter „Abholung" ihn braucht: verkauft gerade (nicht pausiert, sonst stünde er nicht hier) mit diesen Angeboten. */
function alsAbholHof(hof: FutterHof, angebote: readonly FutterAngebot[]): AbholHof {
  return { isPaused: false, angebot: angebote, abholfenster: hof.abholfenster }
}

function holenWort(anzahl: number): string {
  return anzahl === 1 ? 'holt' : 'holen'
}

/** „3 Angebote · nur Höfe mit LFBIS-Nummer" bzw. „2 Angebote holen heute ab · nur Höfe mit LFBIS-Nummer". */
function zahlZeile(anzahl: number, abholung: AbholungWahl | null): string {
  const angebote = mitAnzahl(anzahl, 'Angebot', 'Angebote')
  const wann = abholung ? ` ${holenWort(anzahl)} ${ABHOLUNG_TEXT.imSatz[abholung]} ab` : ''
  return `${angebote}${wann} · ${FUTTER_NUR_LFBIS}`
}

/**
 * Leer, und erst die Abholung hat die Liste geleert: die Sätze aus
 * abholungLeerSaetze (EINE Fassung mit /hoefe) — „Morgen holen 2 Höfe im
 * Umkreis von 25 km ab." mit „Morgen zeigen"; kommt auch morgen nichts, der
 * größere Umkreis, beim größten „Alle Tage".
 */
function abholungLeer(
  hoefe: readonly FutterHof[],
  angeboten: ReadonlyMap<string, FutterProdukt[]>,
  filter: FutterKaufenFilter & { abholung: AbholungWahl },
  jetzt: Date
): FutterLeer {
  const ohneAbholung = { ...filter, abholung: null }
  const abholHoefe = hoefe
    .map((hof) => ({ hof, angebote: karten([hof], angeboten, ohneAbholung, jetzt) }))
    .filter((h) => h.angebote.length > 0)
    .map((h) => alsAbholHof(h.hof, h.angebote))
  const { titel, satz, zeige } = abholungLeerSaetze(filter.abholung, naechsterAbholtag(abholHoefe, jetzt), {
    was: 'Futter',
    wo: `im Umkreis von ${filter.km} km`,
    bestellsatz: false,
  })
  if (zeige) return { titel, satz, ausweg: { art: 'abholung', label: ABHOLUNG_ZEIGEN[zeige], abholung: zeige } }
  const weiter = UMFELD_KM.find((km) => km > filter.km) ?? null
  if (weiter) return { titel, satz, ausweg: { art: 'umkreis', label: `Umkreis auf ${weiter} km`, km: weiter } }
  return { titel, satz, ausweg: { art: 'abholung', label: ABHOLUNG_TEXT.alle, abholung: null } }
}

function leerzustand(
  hoefe: readonly FutterHof[],
  angeboten: ReadonlyMap<string, FutterProdukt[]>,
  filter: FutterKaufenFilter,
  jetzt: Date
): FutterLeer {
  if (filter.abholung && karten(hoefe, angeboten, { ...filter, abholung: null }, jetzt).length > 0) {
    return abholungLeer(hoefe, angeboten, { ...filter, abholung: filter.abholung }, jetzt)
  }
  const gefiltert = filter.art !== null || filter.menge !== null || filter.abholung !== null
  if (gefiltert && karten(hoefe, angeboten, { km: filter.km, art: null, menge: null, abholung: null }, jetzt).length > 0) {
    return {
      titel: FUTTER_KARTE_TEXT.leerTitel,
      satz: 'Zu deiner Auswahl gibt es im Umkreis gerade kein Angebot.',
      ausweg: { art: 'auswahl', label: FUTTER_KARTE_TEXT.allesFutter },
    }
  }
  const weiter = UMFELD_KM.find((km) => km > filter.km) ?? null
  return {
    titel: FUTTER_KARTE_TEXT.leerTitel,
    satz: `Im Umkreis von ${filter.km} km verkauft gerade kein Hof mit LFBIS-Nummer Futter.`,
    ausweg: weiter ? { art: 'umkreis', label: `Umkreis auf ${weiter} km`, km: weiter } : null,
  }
}

/**
 * „Selbst verkaufen" nur ohne eigenes Futter im Shop. Mit Futter und wenn der
 * eigene Hof hier für andere erscheinen würde (sichtbar, nicht pausiert, mit
 * Nummer — den Standort hat er, sonst gäbe es diese Ansicht nicht): ein Satz
 * mit der Zahl der Angebote, die andere sehen, und „Ansehen ›". Sonst (etwa
 * als Testhof) keine Zeile.
 */
function selbstVerkaufen(eigen: EigenerFutterHof): FutterSelbst {
  const imShop = eigen.futter.filter((p) => istFuttermittel(p.category) && p.isAvailable)
  if (imShop.length === 0) return { art: 'anlegen' }
  if (!eigen.sichtbar || !istRegistrierterBetrieb(eigen)) return null
  const sichtbar = familien(imShop).filter((gruppe) => gruppe.some((p) => istAngebotenesFutter(p, eigen))).length
  if (sichtbar === 0) return null
  const satz = sichtbar === 1 ? 'Dein Futter-Angebot sehen andere Höfe hier.' : `Deine ${sichtbar} Futter-Angebote sehen andere Höfe hier.`
  return { art: 'zeile', satz, href: EIGENES_FUTTER_HREF }
}

/** Pins und Karten am Pin: die Höfe der gezeigten Angebote, nummeriert in der Reihenfolge der Liste — nie mit Preisen (N23). */
function karteAus(angebote: readonly FutterAngebot[], hoefe: readonly FutterHof[]): Pick<FutterKaufenAnsicht['karte'], 'pins' | 'karten'> {
  const hofJeSlug = new Map(hoefe.map((h) => [h.slug, h]))
  const pins: FutterPin[] = []
  const karten: Record<string, FutterPinKarte> = {}
  for (const angebot of angebote) {
    const hof = hofJeSlug.get(angebot.hof.slug)
    if (!hof) continue
    const vorhanden = karten[hof.slug]
    if (vorhanden) {
      vorhanden.hof = { ...vorhanden.hof, angebot: [...vorhanden.hof.angebot, angebot.schluessel] }
      continue
    }
    pins.push({ slug: hof.slug, nummer: pins.length + 1, lat: hof.latitude, lon: hof.longitude, name: hof.name })
    karten[hof.slug] = {
      hof: {
        slug: hof.slug,
        name: hof.name,
        postalCode: hof.postalCode,
        city: hof.city,
        isPaused: false,
        kategorien: hof.kategorien,
        abholfenster: hof.abholfenster,
        angebot: [angebot.schluessel],
        fotos: hof.fotos,
        entfernungKm: hof.entfernungKm,
      },
      angebot,
      zeilen: [...angebot.groessen.filter((g) => g.kaufbar), ...angebot.groessen.filter((g) => !g.kaufbar)]
        .slice(0, 2)
        .map((g) => ({ name: angebot.groessen.length > 1 ? `${angebot.name} ${g.name}` : angebot.name, preis: [g.preis, g.kilopreis].filter(Boolean).join(' · ') })),
      weitere: null,
    }
  }
  for (const karte of Object.values(karten)) {
    const mehr = karte.hof.angebot.length - 1
    karte.weitere = mehr > 0 ? `und ${mitAnzahl(mehr, 'weiteres Angebot', 'weitere Angebote')} in der Liste` : null
  }
  return { pins, karten }
}

/** Alles für den Reiter „Futter kaufen": Karten, Zahlen je Stufe, Filter-Chips, Hinweise, Leerzustand, Karte, „Selbst verkaufen". */
export function baueFutterKaufen(eingabe: FutterKaufenEingabe): FutterKaufenAnsicht {
  const { filter, jetzt } = eingabe
  const hoefe = eingabe.hoefe.filter(istRegistrierterBetrieb)
  const angeboten = angeboteneGroessen(hoefe, eingabe.produkte)
  const angebote = karten(hoefe, angeboten, filter, jetzt)

  // Je Stufe: dieselbe Auswahl im größten Umkreis, gezählt in der reinen Funktion von Region.
  const groesster = UMFELD_KM[UMFELD_KM.length - 1]
  const zahlenJeStufe = zaehleJeStufe(karten(hoefe, angeboten, { ...filter, km: groesster }, jetzt).map((a) => a.hof.entfernungKm))

  // Chips zählen Karten bei der übrigen Auswahl — wie die Facetten auf /hoefe.
  const artChips: FutterChip<FutterArt>[] = [
    { wert: null, label: 'Alle', anzahl: karten(hoefe, angeboten, { ...filter, art: null }, jetzt).length, aktiv: filter.art === null },
    ...FUTTER_ART_VALUES.map((art) => ({
      wert: art,
      label: KATEGORIE_LABEL[art],
      anzahl: karten(hoefe, angeboten, { ...filter, art }, jetzt).length,
      aktiv: filter.art === art,
    })).filter((c) => c.anzahl > 0 || c.aktiv),
  ]
  const mengeChips: FutterChip<FutterMenge>[] = [
    { wert: null, label: 'Alle Mengen', anzahl: karten(hoefe, angeboten, { ...filter, menge: null }, jetzt).length, aktiv: filter.menge === null },
    ...(['klein', 'gross'] as const)
      .map((menge) => ({
        wert: menge,
        label: MENGE_LABEL[menge],
        anzahl: karten(hoefe, angeboten, { ...filter, menge }, jetzt).length,
        aktiv: filter.menge === menge,
      }))
      .filter((c) => c.anzahl > 0 || c.aktiv),
  ]
  const abholungChips: FutterChip<AbholungWahl>[] = [
    { wert: null, label: ABHOLUNG_TEXT.alle, anzahl: karten(hoefe, angeboten, { ...filter, abholung: null }, jetzt).length, aktiv: filter.abholung === null },
    ...ABHOLUNG_VALUES.map((wahl) => ({
      wert: wahl,
      label: ABHOLUNG_TEXT.wahl[wahl],
      anzahl: karten(hoefe, angeboten, { ...filter, abholung: wahl }, jetzt).length,
      aktiv: filter.abholung === wahl,
    })),
  ]

  const hinweise: string[] = []
  const ohneStandort = [...angeboteneGroessen(eingabe.ohneStandort, eingabe.produkte).values()].filter((g) => g.some(istKaufbar)).length
  if (ohneStandort > 0) hinweise.push(ohneStandortHinweis(ohneStandort))
  if (eingabe.abgeschnitten) hinweise.push('Wir zeigen die nächsten Höfe – weiter entfernte fehlen.')

  return {
    angebote,
    zahlenJeStufe,
    artChips,
    mengeChips,
    abholungChips,
    zahlZeile: zahlZeile(angebote.length, filter.abholung),
    hinweise,
    leer: angebote.length === 0 ? leerzustand(hoefe, angeboten, filter, jetzt) : null,
    karte: {
      zentrum: { lat: eingabe.eigen.latitude, lon: eingabe.eigen.longitude, radiusKm: filter.km, titel: `${eingabe.eigen.name} (dein Hof)` },
      ...karteAus(angebote, hoefe),
    },
    selbst: selbstVerkaufen(eingabe.eigen),
  }
}
