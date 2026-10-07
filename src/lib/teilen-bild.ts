/**
 * Das Teilen-Bild eines Hofs (Gate 7 Aufgabe 1; S9) — was hineinkommt, rein
 * und ohne Datenbank entschieden. Gezeichnet wird es in
 * `src/app/(public)/[farmSlug]/opengraph-image/route.tsx` (next/og); dasselbe
 * Bild ist die Open-Graph-Vorschau der Hofseite (DESIGN_SYSTEM „Teilen").
 *
 * Regeln:
 *  - Nur öffentliche Hofdaten: Name, Ort, Adresse der Hofseite, bis zu drei
 *    Produkte, die man JETZT kaufen kann, nächste Abholung.
 *  - Nie ein ausverkauftes, ausgeblendetes oder gesperrtes Produkt (Sperre je
 *    Gebinde, Nr. 20 — `istGebindeGesperrt`), nie bei pausiertem Hof.
 *  - Hof- und Produktnamen sind Fremdtext: gereinigt (Steuer- und
 *    Richtungszeichen weg, einzeilig, gekürzt) und im Bild nur als Text —
 *    Satori kennt kein HTML, ein `<script>` im Namen bleibt Buchstaben.
 */
import type { BetriebsstatusValue, ProductCategoryValue } from '@/lib/taxonomie'
import { istGebindeGesperrt, type VerpackungValue } from '@/lib/futter-registrierung'
import { einzeiligerFremdtext } from '@/lib/fremdtext'
import { HOFNAME_MAX, PRODUKTNAME_MAX } from '@/lib/eingabegrenzen'
import { centsAlsEuro, formatEuro } from '@/lib/format'
import { gemeinsamerAnfang } from '@/lib/produktdetail'
import { abholungText, naechstesAbholfenster, type HeuteFenster } from '@/lib/heute'
import type { TeilenBildFormat } from '@/lib/teilen-kanal'

/** Höchstens so viele Produkte im Bild (Gate 7: „bis zu drei"). */
export const TEILEN_BILD_PRODUKTE_MAX = 3


export const TEILEN_BILD_MASSE: Record<TeilenBildFormat, { width: number; height: number }> = {
  quadrat: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
}

export type TeilenBildProdukt = {
  id: string
  name: string
  /** Preis je Gebinde in Cent (Servergrenze wandelt Decimal einmal). */
  preisCents: number
  isAvailable: boolean
  stock: number
  familieId: string | null
  category: ProductCategoryValue | null
  verpackung: VerpackungValue | null
}

export type TeilenBildHof = {
  name: string
  slug: string
  city: string
  isPaused: boolean
  betriebsnummer: string | null
  betriebsstatus: BetriebsstatusValue | null
}

/** Ein Eintrag im Bild und in der Auswahl des Teilen-Fensters — eine Familie zählt als einer. */
export type TeilenBildEintrag = {
  /** Kennung des Eintrags: das erste kaufbare Produkt der Familie. */
  id: string
  name: string
  /** „€ 4,50" oder „ab € 2,50" bei mehreren Größen. */
  preis: string
}

export type TeilenAuswahlEintrag = TeilenBildEintrag & { ausverkauft: boolean }

/** Kann man das Produkt jetzt kaufen? Im Shop, Bestand da, nicht gesperrt. */
function kaufbar(p: TeilenBildProdukt, hof: TeilenBildHof): boolean {
  return p.isAvailable && p.stock > 0 && !istGebindeGesperrt(p, hof)
}

/** Familien zusammenfassen, in der Reihenfolge des Hofs (erstes Vorkommen zählt). */
function gruppen(produkte: readonly TeilenBildProdukt[]): TeilenBildProdukt[][] {
  const reihe: TeilenBildProdukt[][] = []
  const jeFamilie = new Map<string, TeilenBildProdukt[]>()
  for (const p of produkte) {
    if (p.familieId === null) {
      reihe.push([p])
      continue
    }
    const vorhanden = jeFamilie.get(p.familieId)
    if (vorhanden) vorhanden.push(p)
    else {
      const neu = [p]
      jeFamilie.set(p.familieId, neu)
      reihe.push(neu)
    }
  }
  return reihe
}

function eintragAus(gruppe: readonly TeilenBildProdukt[]): TeilenBildEintrag {
  const [erstes] = gruppe
  if (gruppe.length === 1) {
    return {
      id: erstes.id,
      name: einzeiligerFremdtext(erstes.name, PRODUKTNAME_MAX),
      preis: formatEuro(centsAlsEuro(erstes.preisCents)),
    }
  }
  // Mehrere Größen: der Name, den alle teilen („Bergwiesen-Heu"), und der kleinste Preis.
  const anfang = gemeinsamerAnfang(gruppe.map((p) => p.name))
  const name = anfang > 0 ? erstes.name.trim().split(/\s+/).slice(0, anfang).join(' ') : erstes.name
  const kleinster = Math.min(...gruppe.map((p) => p.preisCents))
  return {
    id: erstes.id,
    name: einzeiligerFremdtext(name, PRODUKTNAME_MAX),
    preis: `ab ${formatEuro(centsAlsEuro(kleinster))}`,
  }
}

/**
 * Was das Teilen-Fenster unter „Im Bild" anbietet: jedes Produkt im Shop
 * (eine Familie als ein Eintrag); ausverkaufte stehen da, sind aber aus und
 * nicht wählbar. Gesperrte und ausgeblendete fehlen ganz — sie gibt es für
 * Kundinnen nicht.
 */
export function teilenAuswahl(produkte: readonly TeilenBildProdukt[], hof: TeilenBildHof): TeilenAuswahlEintrag[] {
  const imShop = produkte.filter((p) => p.isAvailable && !istGebindeGesperrt(p, hof))
  return gruppen(imShop).map((gruppe) => {
    const kaufbare = gruppe.filter((p) => kaufbar(p, hof))
    if (kaufbare.length === 0) return { ...eintragAus(gruppe), ausverkauft: true }
    return { ...eintragAus(kaufbare), ausverkauft: false }
  })
}

/**
 * Die Produkte im Bild: höchstens drei kaufbare, eine Familie als ein
 * Eintrag. Mit `auswahl` (Kennungen aus dem Teilen-Fenster) nur diese — aber
 * auch dann nie ein ausverkauftes oder gesperrtes. Pausiert: keins.
 */
export function bildProdukte(
  produkte: readonly TeilenBildProdukt[],
  hof: TeilenBildHof,
  auswahl: readonly string[] | null
): TeilenBildEintrag[] {
  if (hof.isPaused) return []
  const eintraege = gruppen(produkte.filter((p) => kaufbar(p, hof))).map(eintragAus)
  const gewaehlt = auswahl === null ? eintraege : eintraege.filter((e) => auswahl.includes(e.id))
  return gewaehlt.slice(0, TEILEN_BILD_PRODUKTE_MAX)
}

export type TeilenBildDaten = {
  hofName: string
  ort: string
  produkte: TeilenBildEintrag[]
  /** „Abholung Samstag, 9–12 Uhr"; null ohne Abholfenster oder bei pausiertem Hof. */
  abholung: string | null
  /** „farmerzone.at/hof-test" — so steht die Adresse im Bild. */
  adresse: string
}

export function teilenBildDaten(eingabe: {
  hof: TeilenBildHof
  produkte: readonly TeilenBildProdukt[]
  slots: readonly HeuteFenster[]
  auswahl: readonly string[] | null
  adresse: string
  jetzt: Date
}): TeilenBildDaten {
  const { hof } = eingabe
  const fenster = hof.isPaused ? null : naechstesAbholfenster(eingabe.slots, eingabe.jetzt)
  return {
    hofName: einzeiligerFremdtext(hof.name, HOFNAME_MAX),
    ort: einzeiligerFremdtext(hof.city, HOFNAME_MAX),
    produkte: bildProdukte(eingabe.produkte, hof, eingabe.auswahl),
    abholung: fenster ? abholungText(fenster) : null,
    adresse: eingabe.adresse,
  }
}

/**
 * Kurze Prüfsumme über den Inhalt des Bilds (FNV-1a). Sie hängt als `?v=` an
 * der Bildadresse in den Metadaten: Ändert sich Name, Angebot oder Abholung,
 * ändert sich die Adresse — so darf das Bild lange im Zwischenspeicher liegen
 * und ist trotzdem nie veraltet (S9 „Cache je Hof mit Invalidierung").
 */
export function teilenBildVersion(daten: TeilenBildDaten): string {
  const text = JSON.stringify(daten)
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(36)
}

/** Der Teilen-Text aus dem Angebot (Teilen-Fenster): vorgeschlagen, vom Hof frei änderbar. */
export function teilenTextVorschlag(angebot: readonly string[], abholung: string | null): string {
  const namen = angebot.slice(0, TEILEN_BILD_PRODUKTE_MAX)
  const liste =
    namen.length <= 1 ? (namen[0] ?? '') : `${namen.slice(0, -1).join(', ')} und ${namen[namen.length - 1]}`
  const was = liste ? `Frisch bei uns diese Woche: ${liste}.` : 'Frisch bei uns diese Woche.'
  return abholung ? `${was} Online bestellen, ${abholung}.` : `${was} Jetzt online bestellen.`
}

/**
 * Titel und Beschreibung der Vorschau im Chat (Mockup
 * mobil-k1-ueber-einen-geteilten-link): „Hof Test – frisch vom Hof in
 * Teststadt" und „Eier, Erdäpfel, Heu · Abholung Samstag, 9–12 Uhr". Ohne
 * Bilddaten Name und Beschreibung wie bisher.
 */
export function teilenVorschauText(
  hofName: string,
  beschreibung: string,
  daten: TeilenBildDaten | null
): { title: string; description: string } {
  if (!daten) return { title: hofName, description: beschreibung }
  const titel = daten.ort ? `${daten.hofName} – frisch vom Hof in ${daten.ort}` : `${daten.hofName} – frisch vom Hof`
  const teile = [daten.produkte.map((p) => p.name).join(', '), daten.abholung ?? ''].filter((t) => t !== '')
  return { title: titel, description: teile.length > 0 ? teile.join(' · ') : beschreibung }
}
