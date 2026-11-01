/**
 * Produkte (/products) und „Was legst du an?" in der HofShell (Gate 5,
 * Nachtlauf Nr. 18; Mockups web-h2-produkte, mobil-h2-produkte,
 * web-h2-neu-was-legst-du-an, mobil-h2-neu-was-legst-du-an,
 * mobil-h2-neues-produkt, web-h2-ware-wieder-da-teilen,
 * mobil-h2-gespeichert-teilen).
 *
 * Beweist:
 *  - Status einer Zeile: Sichtbar, Nur noch N, Ausverkauft, Nicht im Shop —
 *    dieselbe Reihenfolge wie produktZustand („Nicht im Shop" sticht
 *    „Ausverkauft"); das Wort kommt aus EINER Quelle (NICHT_IM_SHOP, Register B2).
 *  - Filter (Alle, Lebensmittel, Futtermittel, Brennmaterial, Nicht im Shop) und
 *    Suche: aus der Adresse über Zod, Ungültiges fällt still weg.
 *  - Kopfzeile „6 Produkte · 5 sichtbar".
 *  - Vorrat: Schema nur ganze Zahlen ≥ 0 bis VORRAT_MAX; ein Altbestand darüber
 *    darf sinken, nie steigen.
 *  - „Wieder da": nur 0 → mehr als 0, nur bei sichtbarem Hof und Produkt; je
 *    Produkt und Wiener Woche höchstens einmal je Gerät, fehlender oder
 *    werfender Speicher zeigt ihn nie.
 *  - Neu-Menü: Lebensmittel · Futtermittel · Brennmaterial, darunter Beitrag
 *    und Verkauf eintragen (E13); die Bereichswahl kommt als ?bereich= in der
 *    Adresse an.
 *  - /products liegt in (hof), der Bestand (farmer) hat es nicht mehr.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const navigation = vi.hoisted(() => ({ filter: null as string | null, suche: '' }))
vi.mock('next/navigation', () => ({
  useSearchParams: () => {
    const p = new URLSearchParams()
    if (navigation.filter) p.set('filter', navigation.filter)
    if (navigation.suche) p.set('suche', navigation.suche)
    return p
  },
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/products',
}))
vi.mock('next/link', () => ({
  // prefetch und onNavigate sind Next-Props, keine HTML-Attribute.
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode; [k: string]: unknown }) => {
    const attribute = { ...rest }
    delete attribute.prefetch
    delete attribute.onNavigate
    return createElement('a', { href, ...attribute }, children)
  },
}))
vi.mock('@/server/actions/products', () => ({
  setzeVorrat: vi.fn(),
  deleteProduct: vi.fn(),
  setzeKategorie: vi.fn(),
  produktSichtbarkeitSetzen: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
  pruefeDualUse: vi.fn(),
}))
// Seit Nr. 20 hängen die Formulare mit Verkaufsgrößen an der Ansicht.
vi.mock('@/server/actions/produktfamilie', () => ({
  legeFutterFamilieAn: vi.fn(),
  legeBrennmaterialFamilieAn: vi.fn(),
}))

import {
  PRODUKTE_FILTER_LABEL,
  filterAdresse,
  filtereProdukte,
  istWiederDa,
  passtZuProdukteFilter,
  passtZurSuche,
  produktBereich,
  produktStatus,
  produkteAbschnitte,
  PRODUKTE_LEER,
  produkteKopfzeile,
  sichtbareProdukteFilter,
  VORRAT_HINWEIS_ZEILEN,
  wiederDaMomentMoeglich,
  wiederDaTexte,
  zaehleProdukteFilter,
} from '@/lib/produkte-hof'
import {
  leseWiederDaGezeigt,
  merkeWiederDaGezeigt,
  wiederDaOeffnen,
  wiederDaSchluessel,
} from '@/lib/wieder-da-moment'
import { NICHT_IM_SHOP, SPEICHERN_NICHT_IM_SHOP } from '@/lib/produkt-sichtbarkeit'
import { produkteAnsichtAus } from '@/schemas/produkte-filter'
import { vorratSetzenSchema } from '@/schemas/vorrat'
import { VORRAT_MAX } from '@/lib/eingabegrenzen'
import { formatGebinde, hofVorratText } from '@/lib/format'
import { LOW_STOCK_THRESHOLD } from '@/lib/dashboard-hints'
import { leseAuftrag, auftragsSchluessel, ohneAuftrag } from '@/lib/url-auftrag'
import { HOF_NEU_ANDERES_TITEL, HOF_NEU_TITEL, hofNavigation } from '@/lib/bauern-navigation'
import type { ProductCategoryValue } from '@/lib/taxonomie'
import type { ProductData } from '@/server/queries/products'
import { dialogTitel, speichernText } from '@/components/products/produkt-abschnitte'

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), 'utf8')

type P = {
  isAvailable: boolean
  stock: number
  category: ProductCategoryValue | null
  name: string
  unit: string
  unitSize: number | null
}
const p = (teil: Partial<P> = {}): P => ({
  isAvailable: true,
  stock: 20,
  category: 'EIER',
  name: 'Freilandeier',
  unit: 'KG',
  unitSize: null,
  ...teil,
})

describe('hofVorratText — zählt, was der Vorrat zählt (N25)', () => {
  it('ohne Gebinde die Einheit: kg, Stück, Paket — Einzahl und Mehrzahl', () => {
    expect(hofVorratText(53, 'KG', null)).toBe('53 kg')
    expect(hofVorratText(3, 'KG', 1)).toBe('3 kg')
    expect(hofVorratText(8, 'STUECK', null)).toBe('8 Stück')
    expect(hofVorratText(1, 'PAKET', null)).toBe('1 Paket')
    expect(hofVorratText(2, 'PAKET', null)).toBe('2 Pakete')
    expect(hofVorratText(6, 'RAUMMETER', null)).toBe('6 rm')
  })

  it('mit Gebinde zählt der Vorrat Pakete — „14 Pakete", „1 Paket", „0 Pakete"', () => {
    expect(hofVorratText(14, 'G', 500)).toBe('14 Pakete')
    expect(hofVorratText(1, 'G', 500)).toBe('1 Paket')
    expect(hofVorratText(0, 'STUECK', 10)).toBe('0 Pakete')
  })

  it('Ballen und Big Bags zählen Gebinde, auch mit Gebindegröße (wie bestandLabel)', () => {
    expect(hofVorratText(6, 'BALLEN', null)).toBe('6 Ballen')
    expect(hofVorratText(1, 'BALLEN', 250)).toBe('1 Ballen')
    expect(hofVorratText(1, 'BIGBAG', null)).toBe('1 Big Bag')
    expect(hofVorratText(3, 'BIGBAG', 500)).toBe('3 Big Bags')
  })
})

describe('produktStatus — vier Zustände wie im Mockup', () => {
  it('„Nur noch …" trägt die Einheit des Vorrats, auch in der Tabelle', () => {
    expect(produktStatus({ isAvailable: true, stock: 3, unit: 'KG', unitSize: null }).text).toBe('Nur noch 3 kg')
    // Der Hof liest Pakete, die Kundin „Nur noch 2 × 500 g" — beide zählen dasselbe.
    expect(produktStatus({ isAvailable: true, stock: 2, unit: 'G', unitSize: 500 }).text).toBe('Nur noch 2 Pakete')
    expect(produktStatus({ isAvailable: true, stock: 1, unit: 'STUECK', unitSize: null }).text).toBe('Nur noch 1 Stück')
    expect(produktStatus({ isAvailable: true, stock: LOW_STOCK_THRESHOLD, unit: 'BALLEN', unitSize: null }).text).toBe('Nur noch 5 Ballen')
    // Gegenprobe: über der Grenze kein „Nur noch".
    expect(produktStatus({ isAvailable: true, stock: LOW_STOCK_THRESHOLD + 1, unit: 'KG', unitSize: null }).text).toBe('Sichtbar')
  })

  it('Sichtbar (grün), Nur noch N (orange), Ausverkauft und Nicht im Shop (neutral)', () => {
    expect(produktStatus(p({ stock: 24 }))).toEqual({ text: 'Sichtbar', ton: 'fertig' })
    expect(produktStatus(p({ stock: 3 }))).toEqual({ text: 'Nur noch 3 kg', ton: 'offen' })
    expect(produktStatus(p({ stock: 0 }))).toEqual({ text: 'Ausverkauft', ton: 'neutral' })
    expect(produktStatus(p({ isAvailable: false, stock: 24 }))).toEqual({ text: 'Nicht im Shop', ton: 'neutral' })
  })

  it('Nicht im Shop sticht Ausverkauft — ausgeblendet ist für Kunden gar nicht da', () => {
    expect(produktStatus(p({ isAvailable: false, stock: 0 })).text).toBe('Nicht im Shop')
  })

  it('B2: Marke, Filter und Speichern-Knopf nehmen das Wort aus EINER Quelle', () => {
    expect(produktStatus(p({ isAvailable: false })).text).toBe(NICHT_IM_SHOP)
    expect(PRODUKTE_FILTER_LABEL.entwuerfe).toBe(NICHT_IM_SHOP)
    expect(speichernText(0, false, false)).toBe(SPEICHERN_NICHT_IM_SHOP)
  })

  it('B2: kein „Entwurf" mehr in den Texten rund um Produkte', () => {
    const dateien = [
      'src/lib/produkte-hof.ts',
      'src/lib/produkt-sichtbarkeit.ts',
      'src/components/produkte/produkte-ansicht.tsx',
      'src/components/produkte/vorrat-feld.tsx',
      'src/components/produkte/wieder-da-moment.tsx',
      'src/components/products/product-dialog.tsx',
      'src/components/products/produkt-abschnitte.ts',
      'src/components/products/im-shop-schalter.tsx',
    ]
    for (const datei of dateien) expect(quelle(datei), datei).not.toMatch(/Entw(?:u|ü)rf/)
    // „Meine Hof-Seite" (Zähler und Satz in der Ansicht mit Stiften) ist seit Nr. 50 Runde 1 entfernt.
    expect(quelle('src/components/farm/farm-page-view.tsx')).not.toMatch(/ausgeblendete? Produkte|\d* ?ausgeblendet[`']/)
    // Gegenprobe: Die Suche schlägt bei beiden Formen an, nicht beim Filterwert der Adresse.
    expect('Entwurf Entwürfe').toMatch(/Entw(?:u|ü)rf/)
    expect('?filter=entwuerfe').not.toMatch(/Entw(?:u|ü)rf/)
  })
})

describe('Filter und Suche', () => {
  const liste = [
    p({ name: 'Freilandeier' }),
    p({ name: 'Wiesenheu', category: 'HEU_STROH' }),
    p({ name: 'Buchenscheite', category: 'BRENNHOLZ' }),
    p({ name: 'Honig', isAvailable: false }),
    p({ name: 'Ohne Kategorie', category: null }),
  ]

  it('Bereich: Futter über die Taxonomie, Brennholz eigen, der Rest Lebensmittel', () => {
    expect(produktBereich('HEU_STROH')).toBe('futter')
    expect(produktBereich('FUTTERMITTEL')).toBe('futter')
    expect(produktBereich('BRENNHOLZ')).toBe('brennmaterial')
    expect(produktBereich('EIER')).toBe('lebensmittel')
    expect(produktBereich(null)).toBe('lebensmittel')
  })

  it('Lebensmittel, Futtermittel und Brennmaterial teilen die Liste ohne Rest', () => {
    const z = zaehleProdukteFilter(liste)
    expect(z.lebensmittel + z.futter + z.brennmaterial).toBe(z.alle)
    expect(zaehleProdukteFilter([])).toEqual({ alle: 0, lebensmittel: 0, futter: 0, brennmaterial: 0, entwuerfe: 0 })
  })

  it('zählt je Filter; „Nicht im Shop" sind die ausgeblendeten', () => {
    expect(zaehleProdukteFilter(liste)).toEqual({ alle: 5, lebensmittel: 3, futter: 1, brennmaterial: 1, entwuerfe: 1 })
    expect(passtZuProdukteFilter(p({ isAvailable: false }), 'entwuerfe')).toBe(true)
    expect(passtZuProdukteFilter(p(), 'entwuerfe')).toBe(false)
  })

  it('Brennmaterial erscheint nur, wenn es eins gibt oder der Filter gewählt ist', () => {
    const ohne = zaehleProdukteFilter([p()])
    expect(sichtbareProdukteFilter(ohne, 'alle')).toEqual(['alle', 'lebensmittel', 'futter', 'entwuerfe'])
    expect(sichtbareProdukteFilter(ohne, 'brennmaterial')).toContain('brennmaterial')
    expect(sichtbareProdukteFilter(zaehleProdukteFilter(liste), 'alle')).toContain('brennmaterial')
    expect(PRODUKTE_FILTER_LABEL.futter).toBe('Futtermittel')
  })

  it('Suche ohne Groß-/Kleinschreibung, Ränder egal, leer passt immer', () => {
    expect(passtZurSuche('Freilandeier, 10 Stück', 'eier')).toBe(true)
    expect(passtZurSuche('Freilandeier', '  EIER ')).toBe(true)
    expect(passtZurSuche('Freilandeier', '')).toBe(true)
    expect(passtZurSuche('Freilandeier', 'heu')).toBe(false)
    expect(filtereProdukte(liste, { filter: 'alle', suche: 'heu' }).map((x) => x.name)).toEqual(['Wiesenheu'])
    expect(filtereProdukte(liste, { filter: 'lebensmittel', suche: '' })).toHaveLength(3)
  })

  it('Filter und Suche aus der Adresse — Ungültiges fällt still weg', () => {
    expect(produkteAnsichtAus(new URLSearchParams('filter=futter&suche=heu'))).toEqual({ filter: 'futter', suche: 'heu' })
    expect(produkteAnsichtAus(new URLSearchParams('filter=quatsch'))).toEqual({ filter: 'alle', suche: '' })
    expect(produkteAnsichtAus(new URLSearchParams(`suche=${'x'.repeat(200)}`)).suche).toBe('')
    expect(produkteAnsichtAus(new URLSearchParams(''))).toEqual({ filter: 'alle', suche: '' })
    // B2 ändert nur das Wort: Alte Links mit dem Filterwert der Adresse gelten weiter.
    expect(produkteAnsichtAus(new URLSearchParams('filter=entwuerfe'))).toEqual({ filter: 'entwuerfe', suche: '' })
  })

  it('die Adresse eines Filters behält die Suche, „Alle" ohne Parameter', () => {
    expect(filterAdresse('alle', '')).toBe('/products')
    expect(filterAdresse('futter', '')).toBe('/products?filter=futter')
    expect(filterAdresse('entwuerfe', 'honig glas')).toBe('/products?filter=entwuerfe&suche=honig+glas')
  })
})

describe('produkteAbschnitte — „Braucht dich" zuerst (N25)', () => {
  // Die Handlung kommt als Parameter aus der Ansicht (produktHinweise liegt in den Komponenten).
  const hatHandlung = (x: { name: string }) => x.name.startsWith('Hinweis')
  const alle = { filter: 'alle', suche: '' } as const
  const liste = [
    p({ name: 'Erdäpfel', stock: 120 }),
    p({ name: 'Hinweis Kürbis', stock: 25 }),
    p({ name: 'Karotten', stock: 3 }),
    p({ name: 'Freilandeier', stock: 0 }),
    p({ name: 'Brot', stock: 8 }),
    p({ name: 'Honig', stock: 1 }),
    p({ name: 'Äpfel', stock: 40, isAvailable: false }),
    p({ name: 'Heu', stock: 0, category: 'HEU_STROH' }),
    p({ name: 'Stroh', stock: 30, category: 'HEU_STROH', isAvailable: false }),
    p({ name: 'Hinweis versteckt', stock: 0, isAvailable: false }),
  ]
  const namen = (xs: readonly { name: string }[]) => xs.map((x) => x.name)

  it('erst ausverkauft, dann wenig, dann Hinweise — je in der eigenen Reihenfolge; danach „Im Shop"', () => {
    const a = produkteAbschnitte(liste, alle, hatHandlung)
    if (a.art !== 'abschnitte') throw new Error('Abschnitte erwartet')
    expect(namen(a.brauchtDich)).toEqual(['Freilandeier', 'Heu', 'Karotten', 'Honig', 'Hinweis Kürbis'])
    expect(namen(a.imShop)).toEqual(['Erdäpfel', 'Brot'])
  })

  it('kein Produkt steht zweimal, keins fällt weg', () => {
    const a = produkteAbschnitte(liste, alle, hatHandlung)
    if (a.art !== 'abschnitte') throw new Error('Abschnitte erwartet')
    const imShop = [...a.brauchtDich, ...a.imShop]
    expect(new Set(imShop).size).toBe(imShop.length)
    expect(imShop.length).toBe(liste.filter((x) => x.isAvailable).length)
  })

  it('im Filter „Alle" steht am Ende die Zeile „Nicht im Shop · n" mit der Zahl dieses Filters', () => {
    const a = produkteAbschnitte(liste, alle, hatHandlung)
    if (a.art !== 'abschnitte') throw new Error('Abschnitte erwartet')
    expect(a.nichtImShop).toEqual({ art: 'zeile', zahl: zaehleProdukteFilter(liste).entwuerfe })
    expect(a.nichtImShop).toEqual({ art: 'zeile', zahl: 3 })
  })

  it('unter einem Bereichsfilter gelten die Abschnitte im Filter, „Nicht im Shop" mit seinen Zeilen', () => {
    const a = produkteAbschnitte(liste, { filter: 'futter', suche: '' }, hatHandlung)
    if (a.art !== 'abschnitte') throw new Error('Abschnitte erwartet')
    expect(namen(a.brauchtDich)).toEqual(['Heu'])
    expect(a.imShop).toEqual([])
    expect(a.nichtImShop?.art === 'zeilen' ? namen(a.nichtImShop.produkte) : null).toEqual(['Stroh'])
  })

  it('leere Abschnitte entfallen — ohne Ausnahme kein „Braucht dich", ohne Ausgeblendetes keine Zeile', () => {
    const a = produkteAbschnitte([p({ name: 'Erdäpfel', stock: 120 })], alle, hatHandlung)
    expect(a).toEqual({ art: 'abschnitte', brauchtDich: [], imShop: [expect.objectContaining({ name: 'Erdäpfel' })], nichtImShop: null })
    const b = produkteAbschnitte(liste, { filter: 'lebensmittel', suche: '' }, hatHandlung)
    if (b.art !== 'abschnitte') throw new Error('Abschnitte erwartet')
    expect(b.nichtImShop?.art === 'zeilen' ? namen(b.nichtImShop.produkte) : null).toEqual(['Äpfel', 'Hinweis versteckt'])
    const c = produkteAbschnitte(liste.filter((x) => x.category !== 'HEU_STROH' || x.isAvailable), { filter: 'futter', suche: '' }, hatHandlung)
    expect(c).toEqual({ art: 'abschnitte', brauchtDich: [expect.objectContaining({ name: 'Heu' })], imShop: [], nichtImShop: null })
  })

  it('mit Suche und im Filter „Nicht im Shop" eine einfache Liste ohne Abschnitte', () => {
    expect(produkteAbschnitte(liste, { filter: 'alle', suche: 'hinweis' }, hatHandlung)).toEqual({
      art: 'liste',
      produkte: filtereProdukte(liste, { filter: 'alle', suche: 'hinweis' }),
    })
    const n = produkteAbschnitte(liste, { filter: 'entwuerfe', suche: '' }, hatHandlung)
    expect(n.art === 'liste' ? namen(n.produkte) : null).toEqual(['Äpfel', 'Stroh', 'Hinweis versteckt'])
    // Gegenprobe: Leerzeichen allein sind keine Suche.
    expect(produkteAbschnitte(liste, { filter: 'alle', suche: '  ' }, hatHandlung).art).toBe('abschnitte')
  })
})

describe('Kopfzeile und Gebinde', () => {
  it('„6 Produkte · 5 sichtbar" zählt isAvailable, nicht den Bestand', () => {
    expect(produkteKopfzeile([p(), p({ stock: 0 }), p({ isAvailable: false })])).toBe('3 Produkte · 2 sichtbar')
    expect(produkteKopfzeile([p()])).toBe('1 Produkt · 1 sichtbar')
    // Ohne Produkte sagt der EmptyState darunter alles; eine Kopfzeile mit demselben Satz stünde doppelt da.
    expect(produkteKopfzeile([])).toBeNull()
    // Auch der Fall, in dem alles ausgeblendet ist (aus der Bestandsliste übernommen).
    expect(produkteKopfzeile([p({ isAvailable: false }), p({ isAvailable: false })])).toBe('2 Produkte · 0 sichtbar')
  })

  it('Gebinde: „10 Stück", „500 g", ohne Gebinde „je kg"', () => {
    expect(formatGebinde('STUECK', 10)).toBe('10 Stück')
    expect(formatGebinde('G', 500)).toBe('500 g')
    expect(formatGebinde('KG', null)).toBe('je kg')
    expect(formatGebinde('KG', 1)).toBe('je kg')
  })
})

describe('vorratSetzenSchema — ganze Zahl ≥ 0, Obergrenze aus eingabegrenzen.ts', () => {
  const gut = { productId: 'clx123abc', vorher: 3, neu: 5 }

  it('nimmt eine gültige Änderung', () => {
    expect(vorratSetzenSchema.safeParse(gut).success).toBe(true)
    expect(vorratSetzenSchema.safeParse({ ...gut, neu: 0 }).success).toBe(true)
    expect(vorratSetzenSchema.safeParse({ ...gut, neu: VORRAT_MAX }).success).toBe(true)
  })

  it('lehnt negative, gebrochene, zu große und fremde Werte ab', () => {
    for (const neu of [-1, 1.5, VORRAT_MAX + 1, Number.NaN, '5']) {
      expect(vorratSetzenSchema.safeParse({ ...gut, neu }).success).toBe(false)
    }
    expect(vorratSetzenSchema.safeParse({ ...gut, vorher: -1 }).success).toBe(false)
    expect(vorratSetzenSchema.safeParse({ ...gut, productId: '<script>' }).success).toBe(false)
    expect(vorratSetzenSchema.safeParse({ ...gut, farmId: 'fremd' }).success).toBe(false)
  })

  it('ein Altbestand über der Grenze darf sinken, aber nicht steigen', () => {
    expect(vorratSetzenSchema.safeParse({ ...gut, vorher: VORRAT_MAX + 50, neu: VORRAT_MAX + 49 }).success).toBe(true)
    expect(vorratSetzenSchema.safeParse({ ...gut, vorher: VORRAT_MAX + 50, neu: VORRAT_MAX + 51 }).success).toBe(false)
  })
})

describe('„Wieder da" — Anlass und Regeln', () => {
  it('nur der Wechsel von 0 auf mehr als 0', () => {
    expect(istWiederDa(0, 12)).toBe(true)
    expect(istWiederDa(0, 0)).toBe(false)
    expect(istWiederDa(3, 12)).toBe(false)
    expect(istWiederDa(12, 0)).toBe(false)
  })

  it('nur bei sichtbarem Hof und sichtbarem Produkt', () => {
    expect(wiederDaMomentMoeglich({ hofSichtbar: true, produktSichtbar: true, wiederDa: true, teilenMomenteAus: false })).toBe(true)
    expect(wiederDaMomentMoeglich({ hofSichtbar: false, produktSichtbar: true, wiederDa: true, teilenMomenteAus: false })).toBe(false)
    expect(wiederDaMomentMoeglich({ hofSichtbar: true, produktSichtbar: false, wiederDa: true, teilenMomenteAus: false })).toBe(false)
    expect(wiederDaMomentMoeglich({ hofSichtbar: true, produktSichtbar: true, wiederDa: false, teilenMomenteAus: false })).toBe(false)
  })

  it('Texte mit Menge und nächster Abholung, ohne Abholung ohne Satzrest', () => {
    const fenster = { tag: '2026-10-10', name: 'Samstag', zeit: '9:00–12:00 Uhr' }
    const t = wiederDaTexte({ name: 'Karotten', vorrat: 12, unit: 'KG', unitSize: null }, fenster)
    expect(t.titel).toBe('Wieder da: Karotten')
    expect(t.satz).toContain('12 kg')
    expect(t.teilenText).toBe('Wieder da bei uns: Karotten. Abholung Samstag, 9:00–12:00 Uhr.')
    expect(wiederDaTexte({ name: 'Karotten', vorrat: 1, unit: 'KG', unitSize: null }, { ...fenster, name: 'Morgen' }).teilenText).toContain(
      'Abholung morgen,'
    )
    expect(wiederDaTexte({ name: 'Karotten', vorrat: 1, unit: 'KG', unitSize: null }, null).teilenText).toBe('Wieder da bei uns: Karotten.')
  })
})

describe('„Wieder da" — höchstens einmal je Produkt und Woche, je Gerät', () => {
  function speicher(start: Record<string, string> = {}) {
    const daten = new Map(Object.entries(start))
    return {
      getItem: (k: string) => daten.get(k) ?? null,
      setItem: (k: string, v: string) => void daten.set(k, v),
      daten,
    }
  }
  const woche = '2026-10-05'

  it('frischer Speicher → öffnen, danach diese Woche nicht mehr, nächste Woche wieder', () => {
    const s = speicher()
    expect(wiederDaOeffnen(leseWiederDaGezeigt(s, 'p1', woche))).toBe(true)
    merkeWiederDaGezeigt(s, 'p1', woche)
    expect(wiederDaOeffnen(leseWiederDaGezeigt(s, 'p1', woche))).toBe(false)
    expect(wiederDaOeffnen(leseWiederDaGezeigt(s, 'p2', woche))).toBe(true)
    expect(wiederDaOeffnen(leseWiederDaGezeigt(s, 'p1', '2026-10-12'))).toBe(true)
  })

  it('ohne oder mit werfendem Speicher nie (höchstens einmal)', () => {
    expect(wiederDaOeffnen(leseWiederDaGezeigt(null, 'p1', woche))).toBe(false)
    const wirft = {
      getItem: () => {
        throw new Error('gesperrt')
      },
      setItem: () => {
        throw new Error('gesperrt')
      },
    }
    expect(wiederDaOeffnen(leseWiederDaGezeigt(wirft, 'p1', woche))).toBe(false)
    expect(() => merkeWiederDaGezeigt(wirft, 'p1', woche)).not.toThrow()
  })

  it('verstümmelter Merker zählt als „nicht gezeigt" (Zod)', () => {
    const s = speicher({ [wiederDaSchluessel('p1')]: '<script>' })
    expect(leseWiederDaGezeigt(s, 'p1', woche)).toBe('nein')
  })
})

describe('Neu-Menü „Was legst du an?" (E13)', () => {
  const neu = hofNavigation({ isAdmin: false }).neu

  it('Lebensmittel · Futtermittel · Brennmaterial, darunter Beitrag und Verkauf eintragen', () => {
    expect(HOF_NEU_TITEL).toBe('Was legst du an?')
    expect(HOF_NEU_ANDERES_TITEL).toBe('Oder etwas anderes')
    expect(neu.map((x) => [x.label, x.href, x.gruppe])).toEqual([
      ['Lebensmittel', '/products?neu=1&bereich=lebensmittel', 'anlegen'],
      ['Futtermittel', '/products?neu=1&bereich=futter', 'anlegen'],
      ['Brennmaterial', '/products?neu=1&bereich=brennmaterial', 'anlegen'],
      ['Neuer Beitrag', '/status/new', 'anderes'],
      ['Verkauf eintragen', '/sales?neu=1', 'anderes'],
    ])
  })

  it('jede Bereichswahl kommt als Auftrag „neu" mit Bereich an', () => {
    for (const eintrag of neu.filter((x) => x.gruppe === 'anlegen')) {
      const auftrag = leseAuftrag(new URL(eintrag.href, 'http://x').searchParams)
      expect(auftrag?.art).toBe('neu')
      expect(auftrag && auftrag.art === 'neu' ? auftrag.bereich : null).toBe(new URL(eintrag.href, 'http://x').searchParams.get('bereich'))
    }
  })

  it('ein unbekannter Bereich ist ein Auftrag ohne Bereich; der Bereich verlässt die Adresse mit', () => {
    expect(leseAuftrag(new URLSearchParams('neu=1&bereich=quatsch'))).toEqual({ art: 'neu' })
    expect(auftragsSchluessel({ art: 'neu', bereich: 'futter' })).not.toBe(auftragsSchluessel({ art: 'neu' }))
    expect(ohneAuftrag('/products', '?neu=1&bereich=futter&filter=alle')).toBe('/products?filter=alle')
  })
})

describe('Route in der HofShell', () => {
  it('/products liegt in (hof) mit Ladeansicht, nicht mehr in (farmer)', () => {
    expect(existsSync(join(process.cwd(), 'src/app/(hof)/products/page.tsx'))).toBe(true)
    expect(existsSync(join(process.cwd(), 'src/app/(hof)/products/loading.tsx'))).toBe(true)
    expect(existsSync(join(process.cwd(), 'src/app/(farmer)/products'))).toBe(false)
  })

  it('die Seite gibt Verwaistes frei, bevor sie Bestand zeigt, und bindet keine eigene Shell ein', () => {
    const seite = quelle('src/app/(hof)/products/page.tsx')
    expect(seite).toContain('gibVerwaisteFreiOhneRisiko')
    expect(seite.indexOf('gibVerwaisteFreiOhneRisiko(')).toBeLessThan(seite.indexOf('getProdukteSeite('))
    // Auch der Kopf (Nr. 143) zählt die vollen Abholfenster erst danach — nicht im selben Promise.all.
    expect(seite).toMatch(/await gibVerwaisteFreiOhneRisiko\(farm\.id\)[\s\S]*Promise\.all\(\[[\s\S]*ladeMeinHofZustand\(farm\.id, jetzt\)/)
    expect(seite).not.toMatch(/Promise\.all\(\[[^\]]*gibVerwaisteFreiOhneRisiko/)
    expect(seite).not.toMatch(/from '@\/components\/shells\//)
  })
})

// ─── Darstellung (serverseitig gerendert, ohne DOM — TESTING_GUIDELINES §1) ──

describe('Ansicht /products — vier Zustände, lange Namen, Tokens', () => {
  // Ein Filter aus der Adresse gilt nur für seinen Fall, auch wenn rendere wirft.
  afterEach(() => {
    navigation.filter = null
  })

  // Schweres Modul (Ansicht samt Dialogen und Formularen) einmal kalt laden —
  // nicht im ersten Test, dessen 5-s-Grenze es sonst reißt (TESTING_GUIDELINES §4).
  beforeAll(async () => {
    await import('@/components/produkte/produkte-ansicht')
  }, 30_000)

  const lang = 'Bergwiesen-Heu vom ersten Schnitt aus dem oberen Mühlviertel, luftgetrocknet und lose gebündelt'

  function produkt(id: string, teil: Partial<ProductData>): ProductData {
    return {
      id,
      name: 'Freilandeier',
      description: null,
      imageUrl: null,
      bildAusschnitt: null,
      category: 'EIER',
      subcategory: null,
      labels: [],
      futter: null,
      abgabe: 'ALLE',
      categoryImageUrl: null,
      countsTowardLimit: true,
      price: 4.5,
      vatRate: 10,
      unit: 'STUECK',
      unitSize: 10,
      stock: 24,
      reservedStock: 0,
      isAvailable: true,
      allergens: [],
      isOrganic: false,
      requiresCool: false,
      requiresFreezer: false,
      seasonStart: null,
      seasonEnd: null,
      unavailableReason: null,
      familieId: null,
      verpackung: null,
      abholhinweise: [],
      keinRuecktritt: false,
      ruecksendekostenCents: null,
      sperre: null,
      ...teil,
    }
  }

  const liste: ProductData[] = [
    produkt('p1', {}),
    produkt('p2', { name: 'Karotten', category: 'GEMUESE', subcategory: null, unit: 'KG', unitSize: null, stock: 3 }),
    produkt('p3', { name: 'Blütenhonig', category: 'HONIG', stock: 0 }),
    produkt('p4', { name: lang, category: 'HEU_STROH', isAvailable: false }),
  ]

  async function rendere(produkte: ProductData[], suche = ''): Promise<string> {
    navigation.suche = suche
    const { ProdukteAnsicht } = await import('@/components/produkte/produkte-ansicht')
    return renderToStaticMarkup(
      createElement(ProdukteAnsicht, {
        products: produkte,
        hofBetriebsnummer: null,
        registrierung: { betriebsnummer: null, betriebsstatus: null },
        hof: { name: 'Hof Test', slug: 'hof-test', sichtbar: true, teilenMomenteAus: false },
        naechstesFenster: null,
      })
    )
  }

  it('gefüllt: Kopfzeile, vier Marken, Vorrat-Stepper, Schalter „Sichtbar", Hinweis unter der Tabelle', async () => {
    const html = await rendere(liste)
    expect(html).toContain('4 Produkte · 3 sichtbar')
    for (const marke of ['Sichtbar', 'Nur noch 3 kg', 'Ausverkauft', 'Nicht im Shop']) expect(html).toContain(`>${marke}<`)
    expect(html).not.toMatch(/Entw(?:u|ü)rf/)
    expect(html).toContain('aria-label="Vorrat Karotten"')
    expect(html).toContain('role="switch"')
    expect(html).toContain('aria-label="Freilandeier sichtbar"')
    expect(html).toContain('Vorrat direkt hier ändern.')
    expect(html).toContain('Neues Produkt')
    // „Alle" ist der gewählte Filter; die Chips sind echte Links.
    expect(html).toMatch(/<a[^>]*href="\/products"[^>]*aria-current="page"/)
    expect(html).toContain('href="/products?filter=entwuerfe"')
  })

  // Tabelle (ab 1024 px) und Karten-Zeilen (darunter) stehen beide im HTML; die Tabelle zuerst.
  function teile(html: string): { tabelle: string; zeilen: string } {
    const ende = html.indexOf('</table>')
    expect(ende).toBeGreaterThan(0)
    return { tabelle: html.slice(0, ende), zeilen: html.slice(ende) }
  }

  it('Zeilen unter 1024 px: Schild nur bei Ausnahmen, kein „Sichtbar"; die Tabelle behält „Sichtbar" und den Stepper', async () => {
    const { tabelle, zeilen } = teile(await rendere(liste))
    // Im Filter „Alle" steht das Ausgeblendete nur als Zeile „Nicht im Shop · 1".
    for (const marke of ['Nur noch 3 kg', 'Ausverkauft']) expect(zeilen).toContain(`>${marke}<`)
    expect(zeilen).not.toContain('>Sichtbar<')
    expect(zeilen).toContain('Braucht dich')
    expect(zeilen).toContain('Nicht im Shop · 1')
    expect(zeilen).toContain('href="/products?filter=entwuerfe"')
    // Gegenprobe aus der Komponente, die das Merkmal trägt: die Tabelle.
    expect(tabelle).toContain('>Sichtbar<')
    expect(tabelle).toContain('aria-label="Vorrat Karotten"')
    expect(tabelle).toContain('role="switch"')
  })

  it('der Vorrat ist ein Knopf mit Zahl und Einheit — Stepper nur in der Tabelle', async () => {
    const { tabelle, zeilen } = teile(await rendere(liste))
    expect(zeilen).toContain('aria-label="Vorrat Karotten: 3 kg. Ändern"')
    expect(zeilen).toContain('aria-label="Vorrat Freilandeier: 24 Pakete. Ändern"')
    expect(zeilen).toContain('aria-label="Vorrat Blütenhonig: 0 Pakete. Ändern"')
    expect(zeilen).not.toContain('data-slot="stepper"')
    expect(tabelle).toContain('data-slot="stepper"')
    expect(tabelle).not.toContain('. Ändern"')
  })

  it('„Nicht im Shop" filtert: einfache Liste, das Schild steht dann an der Zeile', async () => {
    navigation.filter = 'entwuerfe'
    const { zeilen } = teile(await rendere(liste))
    expect(zeilen).toContain('>Nicht im Shop<')
    expect(zeilen).not.toContain('Braucht dich')
  })

  it('unter 1024 px ein eigener Satz zum Vorrat, die Tabelle behält VORRAT_HINWEIS; die Lupe sucht', async () => {
    const html = await rendere(liste)
    expect(html).toContain(VORRAT_HINWEIS_ZEILEN)
    expect(html).toContain('Vorrat direkt hier ändern.')
    expect(html).toMatch(/<button[^>]*aria-label="Produkt suchen"[^>]*aria-expanded="false"/)
    // Steht schon eine Suche in der Adresse, ist das Feld offen.
    expect(await rendere(liste, 'karotten')).toMatch(/<button[^>]*aria-label="Produkt suchen"[^>]*aria-expanded="true"/)
  })

  it('die Suche steht im DOM hinter den Filtern: ab md wie vorher rechts, unter md sichtbar oben — der Fokus folgt der Lupe', async () => {
    const html = await rendere(liste, 'karotten')
    const filter = html.indexOf('aria-label="Produkte filtern"')
    const lupe = html.indexOf('aria-label="Produkt suchen"')
    const feld = html.indexOf('type="search"')
    expect(filter).toBeGreaterThan(0)
    expect(lupe).toBeGreaterThan(filter)
    expect(feld).toBeGreaterThan(lupe)
    // Sichtbar nach oben nur unter md; ab md bleibt die Reihenfolge des DOM (WCAG 2.4.3).
    expect(html).toMatch(/<label class="[^"]*max-md:order-first[^"]*">/)
    expect(html).not.toContain('md:order-last')
  })

  it('lange Namen: höchstens zwei Zeilen, der volle Name im title', async () => {
    const html = await rendere(liste)
    expect(html).toContain(`title="${lang}"`)
    expect(html).toContain('line-clamp-2')
  })

  it('Filter aus der Adresse (alter Wert entwuerfe): nur, was nicht im Shop steht', async () => {
    navigation.filter = 'entwuerfe'
    const html = await rendere(liste)
    expect(html).toContain('Vorrat Bergwiesen')
    expect(html).not.toContain('Vorrat Karotten')
  })

  it('leer: EmptyState mit Ausweg „Neues Produkt"; kein Treffer: Ausweg „Alle Produkte zeigen"', async () => {
    const leer = await rendere([])
    expect(leer.split(PRODUKTE_LEER.titel).length - 1).toBe(1)
    expect(leer).toContain(PRODUKTE_LEER.satz)
    expect(leer).toContain('Neues Produkt')
    const keinTreffer = await rendere(liste, 'gibtesnicht')
    expect(keinTreffer).toContain('Kein Produkt passt')
    expect(keinTreffer).toContain('Alle Produkte zeigen')
  })

  it('Symbole sind aria-hidden, Farben nur über Tokens', async () => {
    const html = await rendere(liste)
    for (const svg of html.match(/<svg[^>]*>/g) ?? []) expect(svg).toContain('aria-hidden="true"')
    expect((html.match(/<svg/g) ?? []).length).toBeGreaterThan(0)
    for (const datei of ['produkte-ansicht.tsx', 'vorrat-feld.tsx', 'was-legst-du-an.tsx', 'wieder-da-moment.tsx']) {
      const text = quelle(`src/components/produkte/${datei}`)
      expect(text, datei).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|\b(?:bg|text|border)-(?:white|black|amber|red|green|slate)\b/)
    }
    // Gegenprobe: Die Suche schlägt bei einem Farbliteral an.
    expect('bg-white #fff').toMatch(/#[0-9a-fA-F]{3,8}\b|\b(?:bg|text|border)-(?:white|black)\b/)
  })

  it('eine gesperrte Größe zeigt das Schloss mit dem Grund (S7, Nr. 20) — Gegenprobe ohne Sperre', async () => {
    const grund = 'Wird erst sichtbar mit BAES-Meldung für Heimtierfutter'
    const mit = await rendere([produkt('p5', { name: 'Heu 1 kg-Sackerl', category: 'HEU_STROH', isAvailable: false, sperre: grund })])
    expect(mit).toContain(grund)
    const ohne = await rendere([produkt('p5', { name: 'Heu 1 kg-Sackerl', category: 'HEU_STROH', isAvailable: false })])
    expect(ohne).not.toContain(grund)
  })
})

describe('Produktdialog im neuen Design', () => {
  it('Titel nach der Wahl, Knopf sagt, was passiert', () => {
    expect(dialogTitel(false, 'futter')).toBe('Neues Futtermittel')
    expect(dialogTitel(false, 'brennmaterial')).toBe('Neues Brennmaterial')
    expect(dialogTitel(false, null)).toBe('Neues Produkt')
    expect(dialogTitel(true, 'futter')).toBe('Produkt bearbeiten')
    expect(speichernText(0, false, true)).toBe('Produkt veröffentlichen')
    expect(speichernText(0, false, false)).toBe('Speichern (nicht im Shop)')
    expect(speichernText(2, false, true)).toBe('Noch 2 Angaben fehlen')
    expect(speichernText(0, true, true)).toBe('Speichern')
  })

  it('speichert mit dem Vorrat beim Öffnen und lädt Fotos weiter über ladeFotoHoch (Sperre 17b in der Upload-Route)', () => {
    const dialog = quelle('src/components/products/product-dialog.tsx')
    expect(dialog).toContain('updateProduct(product.id, payload, bestandBasis ?? product.stock)')
    expect(dialog).toContain('setBestandBasis(ergebnis.vorrat)')
    expect(dialog).toContain('ladeFotoHoch(selectedFile')
    expect(quelle('src/app/api/upload/token/route.ts')).toContain('emailBestaetigungOffen')
  })

  it('die Ansicht bindet keine Shell ein — Gegenprobe: das Layout von (hof) tut es', () => {
    const muster = /from '@\/components\/shells\//
    expect(quelle('src/components/produkte/produkte-ansicht.tsx')).not.toMatch(muster)
    expect(quelle('src/app/(hof)/layout.tsx')).toMatch(muster)
  })
})
