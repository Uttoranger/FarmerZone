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
import { describe, it, expect, vi, beforeAll } from 'vitest'
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
  produkteKopfzeile,
  sichtbareProdukteFilter,
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
import { formatGebinde } from '@/lib/format'
import { leseAuftrag, auftragsSchluessel, ohneAuftrag } from '@/lib/url-auftrag'
import { HOF_NEU_ANDERES_TITEL, HOF_NEU_TITEL, hofNavigation } from '@/lib/bauern-navigation'
import type { ProductCategoryValue } from '@/lib/taxonomie'
import type { ProductData } from '@/server/queries/products'
import { dialogTitel, speichernText } from '@/components/products/produkt-abschnitte'

const quelle = (pfad: string) => readFileSync(join(process.cwd(), pfad), 'utf8')

type P = { isAvailable: boolean; stock: number; category: ProductCategoryValue | null; name: string }
const p = (teil: Partial<P> = {}): P => ({ isAvailable: true, stock: 20, category: 'EIER', name: 'Freilandeier', ...teil })

describe('produktStatus — vier Zustände wie im Mockup', () => {
  it('Sichtbar (grün), Nur noch N (orange), Ausverkauft und Nicht im Shop (neutral)', () => {
    expect(produktStatus(p({ stock: 24 }))).toEqual({ text: 'Sichtbar', ton: 'fertig' })
    expect(produktStatus(p({ stock: 3 }))).toEqual({ text: 'Nur noch 3', ton: 'offen' })
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
    // „Meine Hof-Seite" (Zähler und Satz über der Kundenansicht) nimmt dasselbe Wort aus der Quelle.
    const editor = quelle('src/components/farm/farm-page-view.tsx')
    expect(editor).not.toMatch(/ausgeblendete? Produkte|\d* ?ausgeblendet[`']/)
    expect(editor.match(/\$\{NICHT_IM_SHOP_IM_SATZ\}/g)?.length).toBeGreaterThanOrEqual(2)
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

describe('Kopfzeile und Gebinde', () => {
  it('„6 Produkte · 5 sichtbar" zählt isAvailable, nicht den Bestand', () => {
    expect(produkteKopfzeile([p(), p({ stock: 0 }), p({ isAvailable: false })])).toBe('3 Produkte · 2 sichtbar')
    expect(produkteKopfzeile([p()])).toBe('1 Produkt · 1 sichtbar')
    expect(produkteKopfzeile([])).toBe('Noch keine Produkte')
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
    expect(seite).not.toMatch(/from '@\/components\/shells\//)
  })
})

// ─── Darstellung (serverseitig gerendert, ohne DOM — TESTING_GUIDELINES §1) ──

describe('Ansicht /products — vier Zustände, lange Namen, Tokens', () => {
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
    for (const marke of ['Sichtbar', 'Nur noch 3', 'Ausverkauft', 'Nicht im Shop']) expect(html).toContain(`>${marke}<`)
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

  it('lange Namen: höchstens zwei Zeilen, der volle Name im title', async () => {
    const html = await rendere(liste)
    expect(html).toContain(`title="${lang}"`)
    expect(html).toContain('line-clamp-2')
  })

  it('Filter aus der Adresse (alter Wert entwuerfe): nur, was nicht im Shop steht', async () => {
    navigation.filter = 'entwuerfe'
    const html = await rendere(liste)
    navigation.filter = null
    expect(html).toContain('Vorrat Bergwiesen')
    expect(html).not.toContain('Vorrat Karotten')
  })

  it('leer: EmptyState mit Ausweg „Neues Produkt"; kein Treffer: Ausweg „Alle Produkte zeigen"', async () => {
    const leer = await rendere([])
    expect(leer).toContain('Noch keine Produkte')
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
