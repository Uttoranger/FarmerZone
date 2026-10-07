/**
 * Was die Produkttabelle des Hofs zeigt (/products im neuen Design, Nachtlauf
 * Nr. 18; Mockups web-h2-produkte, mobil-h2-produkte, web-h2-ware-wieder-da-
 * teilen). Rein und ohne Datenbank prüfbar (tests/produkte-seite.test.ts); die
 * Komponenten in src/components/produkte/ zeigen nur an.
 *
 * Der Zustand eines Produkts kommt weiter aus `produktZustand`
 * (produkt-sichtbarkeit.ts) — hier stehen nur die Wörter des Mockups dazu:
 * Sichtbar, Nur noch N, Ausverkauft, Entwurf. „Entwurf" ist ein Produkt, das
 * der Hof ausgeblendet hat (isAvailable = false); eine eigene Spalte dafür
 * gibt es nicht.
 */
import { produktZustand } from '@/lib/produkt-sichtbarkeit'
import { formatMenge, formatZahl, mitAnzahl } from '@/lib/format'
import { KATEGORIE_LABEL, istFuttermittel, type ProductCategoryValue } from '@/lib/taxonomie'
import { abholungText, type NaechstesFenster } from '@/lib/heute'
import { teilenMomenteAn } from '@/lib/teilen-momente'
import { PRODUKTE_FILTER_WERTE, type ProdukteAnsicht, type ProdukteFilter } from '@/schemas/produkte-filter'
import type { NeuBereich } from '@/schemas/url-auftrag'

// ─── Status ─────────────────────────────────────────────────────────────────

/** Die Töne der StatusBadge (components/ui/status-badge.tsx) — hier ohne Import aus den Komponenten. */
export type ProduktStatusTon = 'offen' | 'fertig' | 'neutral'

export type ProduktStatus = { text: string; ton: ProduktStatusTon }

/**
 * Die Marke einer Zeile. Reihenfolge wie produktZustand: „Entwurf" sticht
 * „Ausverkauft" — ein ausgeblendetes Produkt ist für Kunden gar nicht da.
 * „N Größen warten auf Meldung" gehört zu Gate 6 (Futter-Sperre je Gebinde)
 * und kommt mit Nr. 20.
 */
export function produktStatus(p: { isAvailable: boolean; stock: number }): ProduktStatus {
  const zustand = produktZustand(p)
  switch (zustand.art) {
    case 'nicht-im-shop':
      return { text: 'Entwurf', ton: 'neutral' }
    case 'ausverkauft':
      return { text: 'Ausverkauft', ton: 'neutral' }
    case 'knapp':
      return { text: `Nur noch ${formatZahl(zustand.bestand)}`, ton: 'offen' }
    case 'im-shop':
      return { text: 'Sichtbar', ton: 'fertig' }
  }
}

/**
 * „6 Produkte · 5 sichtbar". Gezählt wird isAvailable, NICHT der Bestand: Ein
 * ausverkauftes Produkt steht für Kunden sichtbar als „Ausverkauft" da. Wer es
 * aus der Zählung nähme, ließe den Hof glauben, er habe weniger eingestellt,
 * als die Kundin sieht.
 */
export function produkteKopfzeile(produkte: readonly { isAvailable: boolean }[]): string {
  if (produkte.length === 0) return 'Noch keine Produkte'
  const sichtbar = produkte.filter((p) => p.isAvailable).length
  return `${mitAnzahl(produkte.length, 'Produkt', 'Produkte')} · ${formatZahl(sichtbar)} sichtbar`
}

// ─── Filter und Suche ───────────────────────────────────────────────────────

export const PRODUKTE_FILTER_LABEL: Record<ProdukteFilter, string> = {
  alle: 'Alle',
  lebensmittel: 'Lebensmittel',
  futter: 'Futtermittel',
  brennmaterial: KATEGORIE_LABEL.BRENNHOLZ,
  entwuerfe: 'Entwürfe',
}

/**
 * Der Bereich einer Zeile, in den Wörtern des Neu-Menüs. Futter über die
 * Taxonomie (auch die Altlast FUTTERMITTEL), Brennholz eigen; alles andere —
 * auch Sonstiges und Produkte ohne Kategorie — steht unter Lebensmittel, wie
 * im Hofladen der Hofseite.
 */
export function produktBereich(category: ProductCategoryValue | null): NeuBereich {
  if (istFuttermittel(category)) return 'futter'
  if (category === 'BRENNHOLZ') return 'brennmaterial'
  return 'lebensmittel'
}

type FilterProdukt = { isAvailable: boolean; category: ProductCategoryValue | null }

export function passtZuProdukteFilter(p: FilterProdukt, filter: ProdukteFilter): boolean {
  switch (filter) {
    case 'alle':
      return true
    case 'entwuerfe':
      return !p.isAvailable
    default:
      return produktBereich(p.category) === filter
  }
}

/** Die Zahl hinter jedem Filter — aus der geladenen Liste, ohne eigene Abfrage. */
export function zaehleProdukteFilter(produkte: readonly FilterProdukt[]): Record<ProdukteFilter, number> {
  const zahlen = {} as Record<ProdukteFilter, number>
  for (const f of PRODUKTE_FILTER_WERTE) zahlen[f] = produkte.filter((p) => passtZuProdukteFilter(p, f)).length
  return zahlen
}

/**
 * Welche Chips stehen: die vier des Mockups immer, Brennmaterial nur, wenn der
 * Hof welches hat — oder der Filter gerade gewählt ist (sonst verschwände der
 * aktive Chip aus der Reihe).
 */
export function sichtbareProdukteFilter(zahlen: Record<ProdukteFilter, number>, gewaehlt: ProdukteFilter): ProdukteFilter[] {
  return PRODUKTE_FILTER_WERTE.filter((f) => f !== 'brennmaterial' || zahlen.brennmaterial > 0 || gewaehlt === f)
}

/** Suche im Namen, ohne Groß-/Kleinschreibung, Ränder egal; leer passt immer. */
export function passtZurSuche(name: string, suche: string): boolean {
  const s = suche.trim().toLocaleLowerCase('de')
  return s === '' || name.toLocaleLowerCase('de').includes(s)
}

export function filtereProdukte<T extends FilterProdukt & { name: string }>(produkte: readonly T[], ansicht: ProdukteAnsicht): T[] {
  return produkte.filter((p) => passtZuProdukteFilter(p, ansicht.filter) && passtZurSuche(p.name, ansicht.suche))
}

/** Die Adresse eines Filters — ein echter Link (DESIGN_SYSTEM „Links und Filter"); die Suche bleibt. */
export function filterAdresse(filter: ProdukteFilter, suche: string): string {
  const parameter = new URLSearchParams()
  if (filter !== 'alle') parameter.set('filter', filter)
  if (suche.trim()) parameter.set('suche', suche.trim())
  const rest = parameter.toString()
  return `/products${rest ? `?${rest}` : ''}`
}

// ─── „Wieder da" ────────────────────────────────────────────────────────────

/** Der Anlass des Moments: Der Vorrat wechselt von 0 auf mehr als 0. */
export function istWiederDa(vorher: number, jetzt: number): boolean {
  return vorher <= 0 && jetzt > 0
}

/**
 * Darf der Moment kommen? Nur, wenn Kunden die Ware auch sehen: Hof sichtbar
 * (heuteHofSichtbar — freigegeben, nicht pausiert, nicht stillgelegt) und
 * Produkt sichtbar. Ein Teilen-Aufruf zu einem Entwurf oder einem pausierten
 * Hof führte ins Leere. Seit Nr. 30 auch nicht, wenn der Hof die
 * Teilen-Momente abgeschaltet hat (Pflichtfeld, src/lib/teilen-momente.ts).
 */
export function wiederDaMomentMoeglich(m: {
  hofSichtbar: boolean
  produktSichtbar: boolean
  wiederDa: boolean
  teilenMomenteAus: boolean
}): boolean {
  return teilenMomenteAn(m) && m.wiederDa && m.hofSichtbar && m.produktSichtbar
}

export type WiederDaTexte = { titel: string; satz: string; teilenText: string }

/**
 * Was der Moment sagt. Der Teilen-Text nennt das Produkt und die nächste
 * Abholung — keine Zahl von Kunden („6 Kunden haben zuletzt … gekauft",
 * Mockup): Dafür gibt es noch keine Regel, was „zuletzt" heißt.
 */
export function wiederDaTexte(
  produkt: { name: string; vorrat: number; unit: string; unitSize: number | null },
  fenster: NaechstesFenster | null
): WiederDaTexte {
  const wann = abholungText(fenster)
  return {
    titel: `Wieder da: ${produkt.name}`,
    satz: `${formatMenge(produkt.vorrat, produkt.unit, produkt.unitSize)} im Vorrat. Sag deinen Kunden Bescheid?`,
    teilenText: wann ? `Wieder da bei uns: ${produkt.name}. ${wann}.` : `Wieder da bei uns: ${produkt.name}.`,
  }
}

// ─── „Gespeichert" (Nr. 30) ─────────────────────────────────────────────────

/**
 * Der Anlass des Moments „gespeichert": ein neu angelegtes Produkt bzw. eine
 * neue Familie mit Verkaufsgrößen (dann EIN Moment für alle Größen).
 * `online` = mindestens eine Größe steht sofort im Shop.
 */
export type ProduktAngelegt = { anlass: string; name: string; online: boolean }

/**
 * Darf der Moment „gespeichert" kommen? Wie bei „wieder da": Hof sichtbar,
 * das Neue steht im Shop (ein Entwurf oder eine gesperrte Futter-Größe führte
 * ins Leere) und die Teilen-Momente sind nicht abgeschaltet.
 */
export function gespeichertMomentMoeglich(m: { hofSichtbar: boolean; online: boolean; teilenMomenteAus: boolean }): boolean {
  return teilenMomenteAn(m) && m.hofSichtbar && m.online
}

/**
 * Was der Moment sagt (Mockup mobil-h2-gespeichert-teilen: „… ist online",
 * Zitat „Neu bei uns: …"). Statt der Beschreibung aus dem Mockup („vom
 * Sackerl bis zum Rundballen") nennt der Teilen-Text die nächste Abholung —
 * wie „wieder da"; eine Beschreibung ist kein Pflichtfeld.
 */
export function gespeichertTexte(name: string, fenster: NaechstesFenster | null): WiederDaTexte {
  const wann = abholungText(fenster)
  return {
    titel: `${name} ist online`,
    satz: 'Kunden sehen es ab jetzt auf deiner Hofseite. Sag ihnen Bescheid?',
    teilenText: wann ? `Neu bei uns: ${name}. ${wann}.` : `Neu bei uns: ${name}.`,
  }
}

/** Der Satz unter der Tabelle (Mockup). */
export const VORRAT_HINWEIS = 'Vorrat direkt hier ändern. Bei 0 wird das Produkt automatisch als ausverkauft angezeigt – nicht gelöscht.'
