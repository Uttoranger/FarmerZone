/**
 * Die Produktseite /[farmSlug]/produkt/[id] (Nachtlauf Nr. 11, Gate 4;
 * Mockups web-k2-futter-groesse-waehlen, web-k2-brennmaterial-brennholz,
 * mobil-k2-futter-groesse-waehlen, mobil-k2-brennmaterial-brennholz) — was
 * sie zeigt und wie sie es nennt, rein und ohne Browser prüfbar
 * (tests/produktdetail.test.ts). Die Komponenten in
 * src/components/produktdetail/ zeigen nur an.
 *
 * Sichtbarkeit, Kartenzustand und Kennzeichnung kommen aus denselben Regeln
 * wie auf der Hofseite (bereiche-anzeige.ts) — die Produktseite ist die eine
 * Darstellung der Produktdetails, das Blatt der Hofseite gibt es nicht mehr.
 */
import {
  einheitLabel,
  formatEuro,
  formatGrundpreis,
  formatGrundpreisNetto,
  formatGrundpreisZeile,
  formatMenge,
  formatZahl,
  gebindeGroesse,
  istMassEinheit,
} from '@/lib/format'
import {
  kartenZustand,
  kennzeichnungsZeilen,
  zeigeKaufknopf,
  type KartenZustand,
  type KennzeichnungsEingabe,
  type KennzeichnungsZeile,
} from '@/lib/bereiche-anzeige'
import { calcLineTotal, decimalZuCents } from '@/lib/order-totals'
import { vorschauLink } from '@/lib/hofseite-vorschau'
import { reiterAdresse } from '@/lib/hofseite-kunde'
import {
  NETTO_EINHEIT_LABEL,
  TROCKNUNG_LABEL,
  bereichVon,
  type BetriebsstatusValue,
  type NettoEinheitValue,
  type ProductCategoryValue,
  type TrocknungValue,
} from '@/lib/taxonomie'
import { MONTH_SHORT } from '@/schemas/product'
import { GROESSE_PARAMETER } from '@/schemas/produktdetail'

// ─── Formen ─────────────────────────────────────────────────────────────────

/** Was die Regeln dieser Datei von einem Produkt brauchen — PublicProduct erfüllt es. */
export type DetailProdukt = {
  id: string
  name: string
  description: string | null
  category: ProductCategoryValue | null
  price: number
  unit: string
  unitSize: number | null
  stock: number
  isAvailable: boolean
  unavailableReason: string | null
  allergens: string[]
  requiresCool: boolean
  requiresFreezer: boolean
  seasonStart: number | null
  seasonEnd: number | null
  familieId: string | null
  futter: (KennzeichnungsEingabe & { nettoMenge: number; nettoEinheit: NettoEinheitValue }) | null
}

export type DetailHof = { name: string; address: string; postalCode: string; city: string }

export type Angabe = KennzeichnungsZeile

// ─── Links ──────────────────────────────────────────────────────────────────

/** Der Pfad der Produktseite — sie hängt am Hof, die ID allein öffnet nichts (Seite prüft den Slug). */
export function produktPfad(slug: string, id: string): string {
  return `/${slug}/produkt/${encodeURIComponent(id)}`
}

/** Der Link zur Produktseite; aus der Vorschau des Hofs bleibt er in der Vorschau. */
export function produktLink(slug: string, id: string, alsVorschau: boolean): string {
  return alsVorschau ? vorschauLink(slug, `produkt/${encodeURIComponent(id)}`) : produktPfad(slug, id)
}

/** „‹ Alle Produkte": der Reiter Produkte der Hofseite, in der Vorschau die Vorschau. */
export function alleProdukteLink(slug: string, alsVorschau: boolean): string {
  const [pfad, suche = ''] = (alsVorschau ? vorschauLink(slug) : `/${slug}`).split('?')
  return reiterAdresse(pfad ?? `/${slug}`, suche, 'produkte')
}

/**
 * Die Adresse nach einer Größenwahl — reload-fest: `?groesse=` nur, wenn es
 * nicht die Größe aus dem Pfad ist; die übrigen Parameter (Vorschau) bleiben.
 * Geschrieben wird sie per replaceState(null, …), wie die Reiter der Hofseite.
 */
export function groesseAdresse(pfad: string, suche: string, gewaehltId: string, einstiegId: string): string {
  const params = new URLSearchParams(suche)
  if (gewaehltId === einstiegId) params.delete(GROESSE_PARAMETER)
  else params.set(GROESSE_PARAMETER, gewaehltId)
  const query = params.toString()
  return query ? `${pfad}?${query}` : pfad
}

// ─── Sichtbarkeit und Familie ───────────────────────────────────────────────

/**
 * Das Produkt der Adresse — nur, wenn es zu DIESEM Hof gehört (die Liste
 * kommt aus der Abfrage des Hofs zum Slug) und im Shop steht: dieselbe Regel
 * wie die Hofseite (`isAvailable`). Ausverkauft bleibt es sichtbar, wie dort.
 * Sonst null — die Seite antwortet mit 404.
 */
export function sichtbaresProdukt<P extends { id: string; isAvailable: boolean }>(produkte: readonly P[], id: string): P | null {
  return produkte.find((p) => p.id === id && p.isAvailable) ?? null
}

/**
 * Die Größen einer Produktfamilie (E3): alle sichtbaren Produkte dieses Hofs
 * mit derselben familieId, in der Reihenfolge des Hofs. Kacheln gibt es erst
 * ab zwei Größen — eine Auswahl aus einer ist keine. Ohne familieId: keine.
 */
export function produktFamilie<P extends { id: string; isAvailable: boolean; familieId: string | null }>(
  produkte: readonly P[],
  produkt: P
): P[] {
  if (!produkt.familieId) return []
  const familie = produkte.filter((p) => p.isAvailable && p.familieId === produkt.familieId)
  return familie.length >= 2 ? familie : []
}

/** Die gewählte Größe: ?groesse= gilt nur innerhalb der Familie, sonst das Produkt aus der Adresse. */
export function gewaehlteGroesse<P extends { id: string }>(familie: readonly P[], einstieg: P, groesse: string | null): P {
  return (groesse ? familie.find((p) => p.id === groesse) : undefined) ?? einstieg
}

// ─── Preis und Vorrat ───────────────────────────────────────────────────────

/** Die zweite Preiszeile: Kilopreis aus der Nettomenge bei Futter, sonst der Grundpreis — null bei Stück und Paket. */
export function zweitePreiszeile(p: Pick<DetailProdukt, 'price' | 'unit' | 'unitSize' | 'futter'>): string | null {
  if (p.futter) return formatGrundpreisNetto(p.price, p.futter.nettoMenge, p.futter.nettoEinheit)
  return formatGrundpreisZeile(p.price, p.unit, p.unitSize)
}

/**
 * Der Vorrat in einer Zeile — aus dem echten Bestand, mit derselben Schwelle
 * wie die Hofseiten-Karte (kartenZustand, knapp ≤ 5): „noch 20 Stück",
 * „nur noch 3 Stück", „ausverkauft". Pausiert: nichts — gekauft wird gerade
 * ohnehin nicht. Gebinde zählen als Gebinde („nur noch 4 × 2 kg").
 */
export function vorratText(p: Pick<DetailProdukt, 'stock' | 'unit' | 'unitSize'>, zustand: KartenZustand): string | null {
  switch (zustand.art) {
    case 'kaufbar':
      return `noch ${formatMenge(p.stock, p.unit, p.unitSize)}`
    case 'knapp':
      return `nur noch ${formatMenge(zustand.bestand, p.unit, p.unitSize)}`
    case 'ausverkauft':
      return 'ausverkauft'
    case 'pausiert':
    case 'nicht-verfuegbar':
      return null
  }
}

/**
 * Wie viel noch in den Korb passt: der Bestand abzüglich dessen, was schon
 * drin liegt — die Grenze des Mengen-Steppers. Verbindlich prüft /api/reserve.
 */
export function mengeNochMoeglich(bestand: number, imKorb: number): number {
  return Math.max(0, bestand - imKorb)
}

/**
 * Der Betrag auf „In den Korb · € …" in ganzen Cent — auf demselben Weg wie
 * Korb und Checkout (calcLineTotal → decimalZuCents), nie `price * menge`.
 */
export function kaufBetragCents(price: number, menge: number): number {
  return decimalZuCents(calcLineTotal(price, menge))
}

// ─── Größenkacheln ──────────────────────────────────────────────────────────

/** Die Menge eines Gebindes: Nettomenge bei Futter, sonst die Gebindegröße bei Maßeinheiten. */
function gebindeMenge(p: Pick<DetailProdukt, 'unit' | 'unitSize' | 'futter'>): string | null {
  if (p.futter) {
    const menge = gebindeGroesse(p.futter.nettoMenge)
    return menge === null ? null : `${formatZahl(menge)} ${NETTO_EINHEIT_LABEL[p.futter.nettoEinheit]}`
  }
  const groesse = gebindeGroesse(p.unitSize)
  if (groesse === null || !istMassEinheit(p.unit)) return null
  return `${formatZahl(groesse)} ${einheitLabel(p.unit)}`
}

/** Die Wörter, mit denen alle Namen beginnen („Bergwiesen-Heu" vor „1 kg-Sackerl", „Rundballen"). */
export function gemeinsamerAnfang(namen: readonly string[]): number {
  // Ohne Vergleich kein gemeinsamer Anfang — und ohne Namen liefe die Schleife ewig (Math.min() = Infinity).
  if (namen.length < 2) return 0
  const woerter = namen.map((n) => n.trim().split(/\s+/))
  const kuerzester = Math.min(...woerter.map((w) => w.length))
  let n = 0
  while (n < kuerzester - 1 && woerter.every((w) => w[n] === woerter[0]![n])) n++
  return n
}

export type GroessenKachelDaten = {
  id: string
  /** „5 kg-Sack" — der Name ohne den Teil, den alle Größen teilen. */
  name: string
  /** „5 kg" — die Menge je Gebinde, wenn sie nicht schon im Namen steht. */
  hinweis: string | null
  /** Preis je Gebinde, fertig formatiert. */
  preis: string
  /** „€ 1,60 / kg" — zum Vergleichen, centgenau. */
  grundpreis: string | null
  vorrat: string | null
  zustand: 'normal' | 'knapp' | 'ausverkauft'
}

/**
 * Die Kacheln der Größenwahl: je Größe Name, Menge, Preis je Gebinde,
 * Grundpreis und Vorrat. Der Name ist der Produktname ohne den Anfang, den
 * alle Größen teilen — so steht „5 kg-Sack" auf der Kachel, wenn die Größen
 * „Bergwiesen-Heu 5 kg-Sack" heißen; heißen sie ganz verschieden, bleibt der
 * Name. Pausiert ist nichts ausverkauft, nur nicht kaufbar.
 */
export function groessenKacheln(familie: readonly DetailProdukt[], isPaused: boolean): GroessenKachelDaten[] {
  const anfang = gemeinsamerAnfang(familie.map((p) => p.name))
  return familie.map((p) => {
    const rest = p.name.trim().split(/\s+/).slice(anfang).join(' ')
    const name = rest || p.name
    const menge = gebindeMenge(p)
    const zustand = kartenZustand(p, isPaused)
    return {
      id: p.id,
      name,
      hinweis: menge && !name.includes(menge) ? menge : null,
      preis: formatEuro(p.price),
      grundpreis: zweitePreiszeile(p),
      vorrat: vorratText(p, zustand),
      zustand: zustand.art === 'knapp' ? 'knapp' : zustand.art === 'ausverkauft' ? 'ausverkauft' : 'normal',
    }
  })
}

// ─── Schild (E9) ────────────────────────────────────────────────────────────

/**
 * Das Schild unter einem Futtermittel: „Futtermittelbetrieb · LFBIS <Nummer>"
 * (E9). Die Plattform prüft die Nummer nicht — der Hof bestätigt sie selbst,
 * das Schild erscheint sofort, ohne „geprüft". Nur, wenn der Hof als
 * Primärproduktion eingetragen ist: Nur dann ist die Nummer eine LFBIS-Nummer
 * (BETRIEBSSTATUS in taxonomie.ts). Registrierte und zugelassene Betriebe
 * haben eine andere Nummer — deren Wortlaut ist nicht entschieden, also kein
 * Schild (die Nummer steht trotzdem in der Kennzeichnung).
 */
export function futterSchild(
  p: { category: ProductCategoryValue | null; futter: { betriebsnummer: string | null } | null },
  betriebsstatus: BetriebsstatusValue | null
): string | null {
  if (bereichVon(p.category) !== 'FUTTERMITTEL') return null
  // Höfe tippen die Nummer oft samt Kürzel ein („LFBIS 1234567") — das Kürzel steht schon im Wortlaut.
  const nummer = p.futter?.betriebsnummer?.trim().replace(/^LFBIS[\s:.-]*/i, '')
  if (!nummer || betriebsstatus !== 'PRIMAERPRODUKTION') return null
  return `Futtermittelbetrieb · LFBIS ${nummer}`
}

// ─── Gleich mit abholen ─────────────────────────────────────────────────────

/** So viele Produkte stehen unter „Gleich mit abholen" (Mockup: drei Karten). */
export const GLEICH_MIT_ABHOLEN = 3

/**
 * „Gleich mit abholen – eine Bestellung, eine Gebühr": andere sichtbare
 * Produkte desselben Hofs, nie die eigene Familie, je Familie nur eine Größe
 * (die Kachel führt zur Größenwahl), Kaufbares zuerst in der Reihenfolge des
 * Hofs. Pausiert: nichts — mitnehmen lässt sich gerade nichts.
 */
export function gleichMitAbholen<P extends { id: string; isAvailable: boolean; stock: number; familieId: string | null }>(
  produkte: readonly P[],
  produkt: P,
  isPaused: boolean,
  anzahl: number = GLEICH_MIT_ABHOLEN
): P[] {
  if (isPaused) return []
  const familien = new Set<string>()
  if (produkt.familieId) familien.add(produkt.familieId)
  const kandidaten: P[] = []
  for (const p of produkte) {
    if (!p.isAvailable || p.id === produkt.id) continue
    if (p.familieId) {
      if (familien.has(p.familieId)) continue
      familien.add(p.familieId)
    }
    kandidaten.push(p)
  }
  const kaufbar = kandidaten.filter((p) => zeigeKaufknopf(p, false))
  const rest = kandidaten.filter((p) => !zeigeKaufknopf(p, false))
  return [...kaufbar, ...rest].slice(0, anzahl)
}

// ─── Angaben ────────────────────────────────────────────────────────────────

/**
 * Was im Akkordeon „Kennzeichnung" steht. Futter: die Pflichtangaben der
 * Kennzeichnung (kennzeichnungsZeilen, mit „laut Angabe des Hofs" bei der
 * Nummer, E9). Sonst, was das Modell heute kennt: Allergene, Lagerung,
 * Saison und die Herkunft — Zutaten gibt es als Feld nicht (sie stehen, wenn
 * überhaupt, in der Beschreibung).
 */
export function produktAngaben(p: DetailProdukt, hof: DetailHof): Angabe[] {
  if (p.futter) return kennzeichnungsZeilen(p.futter, hof)
  const zeilen: Angabe[] = []
  if (p.allergens.length > 0) zeilen.push({ titel: 'Allergene', wert: `Enthält ${p.allergens.join(', ')}` })
  if (p.requiresFreezer) zeilen.push({ titel: 'Lagerung', wert: 'Tiefgekühlt' })
  else if (p.requiresCool) zeilen.push({ titel: 'Lagerung', wert: 'Bitte gekühlt lagern' })
  if (p.seasonStart && p.seasonEnd) {
    zeilen.push({ titel: 'Saison', wert: `${MONTH_SHORT[p.seasonStart - 1]} bis ${MONTH_SHORT[p.seasonEnd - 1]}` })
  }
  zeilen.push({ titel: 'Herkunft', wert: `${hof.name}, ${hof.postalCode} ${hof.city}` })
  return zeilen
}

export type BrennmaterialEingabe = {
  holzart: string
  scheitlaengeCm: number | null
  trocknung: TrocknungValue
  restfeuchteMax: number | null
  wassergehalt: number | null
  koernung: number | null
  ueberdacht: boolean
}

/**
 * Die Angaben zu Brennmaterial, immer sichtbar (DESIGN_SYSTEM, „Futtermittel
 * und Brennmaterial"): Holzart, Scheitlänge, Trocknung mit Restfeuchte; bei
 * Hackschnitzeln Wassergehalt (W) und Körnung (P); die Lagerung, wenn
 * überdacht. Was fehlt, fehlt — keine leeren Zeilen.
 */
export function brennmaterialZeilen(b: BrennmaterialEingabe): Angabe[] {
  const zeilen: Angabe[] = [{ titel: 'Holzart', wert: b.holzart }]
  if (b.scheitlaengeCm !== null) zeilen.push({ titel: 'Scheitlänge', wert: `${formatZahl(b.scheitlaengeCm)} cm` })
  const trocknung = TROCKNUNG_LABEL[b.trocknung]
  zeilen.push({
    titel: 'Trocknung',
    wert: b.restfeuchteMax !== null ? `${trocknung}, unter ${formatZahl(b.restfeuchteMax)} % Restfeuchte` : trocknung,
  })
  if (b.wassergehalt !== null) zeilen.push({ titel: 'Wassergehalt', wert: `W${b.wassergehalt}` })
  if (b.koernung !== null) zeilen.push({ titel: 'Körnung', wert: `P${b.koernung}` })
  if (b.ueberdacht) zeilen.push({ titel: 'Lagerung', wert: 'überdacht gelagert' })
  return zeilen
}

const WIENER_DATUM = new Intl.DateTimeFormat('de-AT', {
  timeZone: 'Europe/Vienna',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

/** „21. September 2026" — der Wiener Kalendertag, an dem der Hof die Kennzeichnung bestätigt hat. */
export function bestaetigtAmText(iso: string): string {
  return WIENER_DATUM.format(new Date(iso))
}

// ─── Metadaten ──────────────────────────────────────────────────────────────

/** So lang darf die Beschreibung im Suchergebnis und in der Teilen-Vorschau sein. */
const BESCHREIBUNG_MAX = 155

/**
 * Titel und Beschreibung für Suchmaschinen und die Teilen-Vorschau — nur aus
 * öffentlichen Daten (Produktname, Beschreibung, Preis, Hofname, Ort), nie
 * Telefon, E-Mail oder Name der Person hinter dem Hof.
 */
export function produktMetadaten(
  p: Pick<DetailProdukt, 'name' | 'description' | 'price' | 'unit' | 'unitSize'>,
  hof: Pick<DetailHof, 'name' | 'city'>
): { titel: string; beschreibung: string } {
  const text = p.description?.replace(/\s+/g, ' ').trim()
  const beschreibung = text || `${p.name} bei ${hof.name}, ${hof.city} — ${formatGrundpreis(p.price, p.unit, p.unitSize)}`
  return { titel: `${p.name} — ${hof.name}`, beschreibung: beschreibung.slice(0, BESCHREIBUNG_MAX) }
}
