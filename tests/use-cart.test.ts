/**
 * Der Korb bei Aufrufen hintereinander (Nr. 71, gefunden in Bericht 63).
 *
 * Fehler: addItem rechnete mit `items` aus dem Render, aus dem die Funktion
 * stammt. Der Nachbestell-Link ruft addItem in einer Schleife aus EINEM Render
 * auf — jeder Aufruf setzte auf denselben leeren Korb auf, nur das letzte
 * Produkt blieb. Reserviert wurden trotzdem alle: Die übrigen lagen 15 Minuten
 * gesperrt, ohne im Korb zu sein.
 *
 * Ohne DOM (TESTING_GUIDELINES §1) spielt ein kleiner Prüfstand die Hooks von
 * React nach, so weit es hier zählt: Zustand je Aufrufstelle, Setzen mit Wert
 * oder Updater, neues Rendern nach einer Änderung (danach, nicht mitten im
 * Aufruf), Effekte nach dem Rendern, wenn sich ihre Abhängigkeiten ändern. Die
 * Komponente läuft als Funktion, Kinder rendert er nicht. /api/reserve ist
 * gemockt, der Browser-Speicher eine Map.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PublicProduct } from '@/server/queries/farm'
import type { CartItem, Warenkorb } from '@/lib/use-cart'
import { useCart } from '@/lib/use-cart'
import { ProductGrid } from '@/components/farm/product-grid'
import { WARENKORB_SCHLUESSEL, leseWarenkorb } from '@/lib/warenkorb-speicher'

const pruefstand = vi.hoisted(() => {
  type Setzer<T> = (wert: T | ((vorher: T) => T)) => void
  type Effekt = { deps: readonly unknown[] | undefined; aufraeumen: void | (() => void) }
  let zellen: unknown[] = []
  let faellig: Array<() => void> = []
  let zeiger = 0
  let rendernd = false
  let schmutzig = false
  let geplant = false
  let komponente: () => unknown = () => null

  function geaendert(): void {
    schmutzig = true
    if (rendernd || geplant) return
    // Wie React: Eine Änderung von außen rendert danach, nicht mitten im Aufruf.
    geplant = true
    setTimeout(() => {
      geplant = false
      rendere()
    }, 0)
  }

  function rendere(): void {
    for (let runde = 1; ; runde++) {
      if (runde > 25) throw new Error('Der Prüfstand rendert ohne Ende.')
      schmutzig = false
      faellig = []
      zeiger = 0
      rendernd = true
      try {
        komponente()
      } finally {
        rendernd = false
      }
      // Eine Änderung beim Rendern (Zustand an neue Props anpassen) rendert
      // sofort neu; Effekte gibt es nur aus dem letzten Lauf.
      if (!schmutzig) break
    }
    const laeufe = faellig
    faellig = []
    for (const lauf of laeufe) lauf()
  }

  function gleich(a: readonly unknown[] | undefined, b: readonly unknown[] | undefined): boolean {
    return a !== undefined && b !== undefined && a.length === b.length && a.every((d, k) => Object.is(d, b[k]))
  }

  return {
    starte(neu: () => unknown): void {
      zellen = []
      geplant = false
      komponente = neu
      rendere()
    },
    /** Wartet, bis nichts mehr zu rendern ansteht — die Antworten kommen ohne Netz, also in derselben Runde. */
    async zuRuhe(): Promise<void> {
      do {
        await new Promise((weiter) => setTimeout(weiter, 0))
      } while (geplant)
    },
    useState<T>(anfang: T | (() => T)): [T, Setzer<T>] {
      const i = zeiger++
      if (!(i in zellen)) {
        const neu: { wert: T; setze: Setzer<T> } = {
          wert: typeof anfang === 'function' ? (anfang as () => T)() : anfang,
          setze: (wert) => {
            neu.wert = typeof wert === 'function' ? (wert as (vorher: T) => T)(neu.wert) : wert
            geaendert()
          },
        }
        zellen[i] = neu
      }
      const zelle = zellen[i] as { wert: T; setze: Setzer<T> }
      return [zelle.wert, zelle.setze]
    },
    useRef<T>(anfang: T): { current: T } {
      const i = zeiger++
      if (!(i in zellen)) zellen[i] = { current: anfang }
      return zellen[i] as { current: T }
    },
    useEffect(wirkung: () => void | (() => void), deps?: readonly unknown[]): void {
      const i = zeiger++
      const alt = zellen[i] as Effekt | undefined
      if (alt && gleich(alt.deps, deps)) return
      faellig.push(() => {
        if (typeof alt?.aufraeumen === 'function') alt.aufraeumen()
        zellen[i] = { deps, aufraeumen: wirkung() }
      })
    },
    useMemo<T>(rechne: () => T): T {
      return rechne()
    },
    // Wie im Browser nach der Hydration: Der Speicher ist da.
    useSyncExternalStore<T>(_abonnieren: unknown, lies: () => T): T {
      return lies()
    },
    useTransition(): [boolean, (rueckruf: () => void) => void] {
      return [false, (rueckruf) => rueckruf()]
    },
    useOptimistic<T>(stand: T): [T, () => void] {
      return [stand, () => {}]
    },
    // Der Weg in den Korb nach außen (Nr. 128) — hier ohne Abnehmer, er zählt keine Zelle.
    useImperativeHandle(): void {},
  }
})

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useState: pruefstand.useState,
  useRef: pruefstand.useRef,
  useEffect: pruefstand.useEffect,
  useMemo: pruefstand.useMemo,
  useSyncExternalStore: pruefstand.useSyncExternalStore,
  useTransition: pruefstand.useTransition,
  useOptimistic: pruefstand.useOptimistic,
  useImperativeHandle: pruefstand.useImperativeHandle,
}))

// Das echte useCart, nur umhüllt: was der Hook zuletzt geliefert hat — auch aus dem Produktraster heraus.
const geliefert = vi.hoisted(() => ({ korb: null as Warenkorb | null }))
vi.mock('@/lib/use-cart', async (importOriginal) => {
  const echt = await importOriginal<typeof import('@/lib/use-cart')>()
  return {
    ...echt,
    useCart: (farmId: string, farmSlug: string): Warenkorb => {
      const korb = echt.useCart(farmId, farmSlug)
      geliefert.korb = korb
      return korb
    },
  }
})

vi.mock('@/server/actions/products', () => ({ updateProductImageAction: vi.fn(), reorderProductsAction: vi.fn() }))

const HOF_ID = 'farm_test'
const HOF_SLUG = 'hof-test'

function produkt(id: string, name: string): PublicProduct {
  return {
    id, name, description: null, imageUrl: null, bildAusschnitt: null, category: null, categoryImageUrl: null,
    price: 3.5, unit: 'kg', unitSize: 1, stock: 10, isAvailable: true, allergens: [],
    isOrganic: false, requiresCool: false, requiresFreezer: false, seasonStart: null, seasonEnd: null,
    unavailableReason: null, subcategory: null, labels: [], abgabe: 'ALLE', futter: null,
    familieId: null, brennmaterial: null, abholhinweise: [],
  }
}

const EIER = produkt('prod_eier', 'Eier')
const MEHL = produkt('prod_mehl', 'Mehl')
const HONIG = produkt('prod_honig', 'Honig')

function position(p: PublicProduct): Omit<CartItem, 'quantity'> {
  return { productId: p.id, name: p.name, price: p.price, unit: p.unit, unitSize: p.unitSize, imageUrl: p.imageUrl }
}

let speicher = new Map<string, string>()
let abgelehnt = new Set<string>()
const reserviere = vi.fn(async (_adresse: string, init?: RequestInit): Promise<Response> => {
  const { productId } = JSON.parse(String(init?.body)) as { productId: string }
  return (
    abgelehnt.has(productId)
      ? { ok: false, json: async () => ({ error: 'Davon ist nicht mehr genug da.' }) }
      : { ok: true, json: async () => ({ ok: true }) }
  ) as Response
})

beforeEach(() => {
  speicher = new Map()
  abgelehnt = new Set()
  geliefert.korb = null
  reserviere.mockClear()
  vi.stubGlobal('localStorage', {
    getItem: (schluessel: string) => speicher.get(schluessel) ?? null,
    setItem: (schluessel: string, wert: string) => {
      speicher.set(schluessel, wert)
    },
    removeItem: (schluessel: string) => {
      speicher.delete(schluessel)
    },
  })
  vi.stubGlobal('window', { location: { hash: '', pathname: `/${HOF_SLUG}`, search: '' }, dispatchEvent: () => true })
  vi.stubGlobal('document', { addEventListener: () => {}, removeEventListener: () => {} })
  vi.stubGlobal('fetch', reserviere)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function korb(): Warenkorb {
  if (!geliefert.korb) throw new Error('Der Hook hat noch nicht gerendert.')
  return geliefert.korb
}

function inhalt(items: readonly CartItem[]): Array<[string, number]> {
  return items.map((i) => [i.productId, i.quantity])
}

/** Was nach dem Neuladen im Korb stünde. */
function gespeichert(): { farmId: string; inhalt: Array<[string, number]> } | null {
  const stand = leseWarenkorb(speicher.get(WARENKORB_SCHLUESSEL) ?? null)
  return stand && { farmId: stand.farmId, inhalt: inhalt(stand.items) }
}

function reservierungen(): Array<[string, number]> {
  return reserviere.mock.calls.map(([adresse, init]) => {
    expect(adresse).toBe('/api/reserve')
    const { productId, quantity } = JSON.parse(String(init?.body)) as { productId: string; quantity: number }
    return [productId, quantity]
  })
}

/** Der Hook allein, wie ihn die Hofseite einbindet. */
function NurKorb(): null {
  useCart(HOF_ID, HOF_SLUG)
  return null
}

describe('useCart: Aufrufe hintereinander aus demselben Render', () => {
  it('nimmt drei Produkte nacheinander alle in den Korb', async () => {
    pruefstand.starte(NurKorb)
    // Alle drei aus EINEM Render — so ruft die Schleife des Nachbestell-Links.
    const { addItem } = korb()

    expect(await addItem(position(EIER), 2)).toEqual({ ok: true })
    expect(await addItem(position(MEHL), 1)).toEqual({ ok: true })
    expect(await addItem(position(HONIG), 3)).toEqual({ ok: true })
    await pruefstand.zuRuhe()

    const erwartet: Array<[string, number]> = [[EIER.id, 2], [MEHL.id, 1], [HONIG.id, 3]]
    expect(inhalt(korb().items)).toEqual(erwartet)
    expect(gespeichert()).toEqual({ farmId: HOF_ID, inhalt: erwartet })
  })

  it('zählt dasselbe Produkt zusammen und reserviert jedes Mal die ganze Menge', async () => {
    pruefstand.starte(NurKorb)
    const { addItem } = korb()

    await addItem(position(EIER), 1)
    await addItem(position(EIER), 2)
    await pruefstand.zuRuhe()

    // /api/reserve setzt die Menge, es zählt nicht dazu: Der Korb trägt, was reserviert ist.
    expect(reservierungen()).toEqual([[EIER.id, 1], [EIER.id, 3]])
    expect(inhalt(korb().items)).toEqual([[EIER.id, 3]])
  })

  it('ändert und entfernt mit Funktionen aus einem alten Render — beide Änderungen bleiben (Nr. 75)', async () => {
    pruefstand.starte(NurKorb)
    const { addItem } = korb()
    await addItem(position(EIER), 1)
    await addItem(position(MEHL), 1)
    await pruefstand.zuRuhe()

    // Zwei Aufrufe aus EINEM Render: Der zweite muss auf dem ersten aufsetzen, nicht auf `items` dieses Renders.
    const { updateQuantity, removeItem } = korb()
    expect(await updateQuantity(EIER.id, 4)).toEqual({ ok: true })
    removeItem(MEHL.id)
    await pruefstand.zuRuhe()

    expect(inhalt(korb().items)).toEqual([[EIER.id, 4]])
    expect(gespeichert()).toEqual({ farmId: HOF_ID, inhalt: [[EIER.id, 4]] })
  })
})

describe('Nachbestell-Link im Produktraster', () => {
  function rastereMit(...nachbestellt: Array<[PublicProduct, number]>): void {
    // Props einmal bauen: Eine neue Produktliste je Rendern wäre ein neuer Server-Stand.
    const props = {
      products: [EIER, MEHL, HONIG],
      farmId: HOF_ID,
      farmSlug: HOF_SLUG,
      initialReorderItems: nachbestellt.map(([p, quantity]) => ({ productId: p.id, productName: p.name, quantity })),
    }
    pruefstand.starte(() => ProductGrid(props))
  }

  it('legt zwei Produkte in den Korb — keine Reservierung ohne Position', async () => {
    rastereMit([EIER, 2], [MEHL, 1])
    await pruefstand.zuRuhe()

    const erwartet: Array<[string, number]> = [[EIER.id, 2], [MEHL.id, 1]]
    expect(reservierungen()).toEqual(erwartet)
    expect(inhalt(korb().items)).toEqual(erwartet)
    expect(gespeichert()).toEqual({ farmId: HOF_ID, inhalt: erwartet })
  })

  it('lässt ein abgelehntes Produkt aus, ohne die übrigen aufzuhalten', async () => {
    abgelehnt.add(MEHL.id)
    rastereMit([EIER, 2], [MEHL, 1], [HONIG, 1])
    await pruefstand.zuRuhe()

    expect(reservierungen()).toEqual([[EIER.id, 2], [MEHL.id, 1], [HONIG.id, 1]])
    expect(inhalt(korb().items)).toEqual([[EIER.id, 2], [HONIG.id, 1]])
  })

  it('ersetzt den Korb eines anderen Hofs, statt ihn zu ergänzen', async () => {
    speicher.set(
      WARENKORB_SCHLUESSEL,
      JSON.stringify({ farmId: 'farm_andere', farmSlug: 'hof-andere', items: [{ ...position(HONIG), productId: 'prod_fremd', quantity: 4 }] }),
    )
    rastereMit([EIER, 2], [MEHL, 1])
    await pruefstand.zuRuhe()

    expect(gespeichert()).toEqual({ farmId: HOF_ID, inhalt: [[EIER.id, 2], [MEHL.id, 1]] })
  })
})
