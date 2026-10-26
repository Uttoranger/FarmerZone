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
 *
 * Dazu (Register N24): Mit Kaufsperre legt der Nachbestell-Link nichts in den
 * Korb — dieselbe Regel wie der Kaufknopf.
 *
 * Warenkorb ehrlich (Register N28, Nr. 169): Entfernen (`removeItem`,
 * `updateQuantity(…, 0)`) gibt den Halt über DELETE /api/reserve frei, ohne zu
 * warten; ein Fehler wird verschluckt. `ersetzeKorb` schreibt Speicher und
 * Zustand, ohne Änderung nichts. Das Produktraster gleicht den gespeicherten
 * Korb nach dem Hydrieren einmal mit seinen Produkten ab — ohne Reservierung,
 * nie mit Kaufsperre, nie in der Vorschau des Hofs — und zeigt den Satz, bis
 * sich der Korb ändert.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PublicProduct } from '@/server/queries/farm'
import { publicProduct } from './fabrik/public-product'
import type { CartItem, Warenkorb } from '@/lib/use-cart'
import { useCart, useKorbHinweis } from '@/lib/use-cart'
import { ProductGrid } from '@/components/farm/product-grid'
import type { KaufSperre } from '@/lib/bereiche-anzeige'
import { SITZUNG_SCHLUESSEL, WARENKORB_SCHLUESSEL, leseWarenkorb } from '@/lib/warenkorb-speicher'
import { NETZ_SATZ } from '@/lib/netz'

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
  return publicProduct({ id, name, category: null, price: 3.5, unit: 'kg', unitSize: 1, stock: 10 })
}

const EIER = produkt('prod_eier', 'Eier')
const MEHL = produkt('prod_mehl', 'Mehl')
const HONIG = produkt('prod_honig', 'Honig')

function position(p: PublicProduct): Omit<CartItem, 'quantity'> {
  return { productId: p.id, name: p.name, price: p.price, unit: p.unit, unitSize: p.unitSize, imageUrl: p.imageUrl }
}

let speicher = new Map<string, string>()
let abgelehnt = new Set<string>()
let freigabeScheitert = false
/** Ein Wurf beim Reservieren (POST) — Funkloch oder Programmierfehler (Register N29, Nr. 175). */
let reservierenWirft: Error | null = null
const reserviere = vi.fn(async (_adresse: string, init?: RequestInit): Promise<Response> => {
  const { productId } = JSON.parse(String(init?.body)) as { productId: string }
  if (init?.method === 'DELETE') {
    if (freigabeScheitert) throw new TypeError('Kein Netz')
    return { ok: true, json: async () => ({ ok: true }) } as Response
  }
  if (reservierenWirft) throw reservierenWirft
  return (
    abgelehnt.has(productId)
      ? { ok: false, json: async () => ({ error: 'Davon ist nicht mehr genug da.' }) }
      : { ok: true, json: async () => ({ ok: true }) }
  ) as Response
})

beforeEach(() => {
  speicher = new Map()
  abgelehnt = new Set()
  freigabeScheitert = false
  reservierenWirft = null
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

/** Nur die Reservierungen (POST) — Freigaben zählt `freigaben()`. */
function reservierungen(): Array<[string, number]> {
  return reserviere.mock.calls.filter(([, init]) => init?.method === 'POST').map(([adresse, init]) => {
    expect(adresse).toBe('/api/reserve')
    const { productId, quantity } = JSON.parse(String(init?.body)) as { productId: string; quantity: number }
    return [productId, quantity]
  })
}

/** Die Freigaben (DELETE /api/reserve): Produkt und Sitzung. */
function freigaben(): Array<[string, string]> {
  return reserviere.mock.calls.filter(([, init]) => init?.method === 'DELETE').map(([adresse, init]) => {
    expect(adresse).toBe('/api/reserve')
    const { productId, sessionId } = JSON.parse(String(init?.body)) as { productId: string; sessionId: string }
    return [productId, sessionId]
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
    rastereMitSperre(null, ...nachbestellt)
  }

  function rastereMitSperre(sperre: KaufSperre, ...nachbestellt: Array<[PublicProduct, number]>): void {
    // Props einmal bauen: Eine neue Produktliste je Rendern wäre ein neuer Server-Stand.
    const props = {
      products: [EIER, MEHL, HONIG],
      farmId: HOF_ID,
      farmSlug: HOF_SLUG,
      sperre,
      hofName: 'Testhof A',
      pauseMessage: null,
      initialReorderItems: nachbestellt.map(([p, quantity]) => ({ productId: p.id, productName: p.name, quantity })),
    }
    pruefstand.starte(() => ProductGrid(props))
  }

  // Register N24: Der Link liest dieselbe Regel wie der Kaufknopf (zeigeKaufknopf mit der Sperre) — bei
  // Pause, ohne Abholzeit und ausgebucht legt er nichts in den Korb und reserviert nichts.
  for (const sperre of ['pause', 'keine-abholzeit', 'ausgebucht'] as const) {
    it(`mit Kaufsperre „${sperre}“: nichts im Korb, keine Reservierung`, async () => {
      rastereMitSperre(sperre, [EIER, 2], [MEHL, 1])
      await pruefstand.zuRuhe()

      expect(reserviere).not.toHaveBeenCalled()
      expect(korb().items).toEqual([])
      expect(gespeichert()).toBeNull()
    })
  }

  it('Gegenprobe: dieselben Positionen ohne Sperre landen im Korb', async () => {
    rastereMitSperre(null, [EIER, 2], [MEHL, 1])
    await pruefstand.zuRuhe()

    expect(reservierungen()).toEqual([[EIER.id, 2], [MEHL.id, 1]])
    expect(inhalt(korb().items)).toEqual([[EIER.id, 2], [MEHL.id, 1]])
  })

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

/**
 * Nr. 139: `total` rechnet in ganzen Cent auf dem Weg des Checkouts (korbBetraege), nicht `price * quantity` in
 * Fließkomma. Geprüft wird der Zahlenwert: formatEuro zeigte auch 3,3000000000000003 als „€ 3,30“.
 */
describe('useCart: Summe in ganzen Cent (Nr. 139)', () => {
  it('3 × 1,10 € ergibt als Zahl genau 3.3', async () => {
    pruefstand.starte(NurKorb)
    const brot = publicProduct({ id: 'prod_brot', name: 'Brot', category: null, price: 1.1, unit: 'Stück', unitSize: 1, stock: 10 })
    await korb().addItem(position(brot), 3)
    await pruefstand.zuRuhe()

    expect(korb().total).toBe(3.3)
  })

  it('Gegenprobe: Die alte Rechnung in Fließkomma ergibt 3.3000000000000003', () => {
    const alt = [{ price: 1.1, quantity: 3 }].reduce((s, i) => s + i.price * i.quantity, 0)
    expect(alt).toBe(3.3000000000000003)
  })
})

describe('useCart: Entfernen gibt den Halt frei (Register N28)', () => {
  it('removeItem ruft DELETE /api/reserve mit Produkt und Sitzung', async () => {
    pruefstand.starte(NurKorb)
    await korb().addItem(position(EIER), 2)
    await pruefstand.zuRuhe()

    korb().removeItem(EIER.id)
    await pruefstand.zuRuhe()

    const sitzung = speicher.get(SITZUNG_SCHLUESSEL)
    expect(sitzung).toBeTruthy()
    expect(freigaben()).toEqual([[EIER.id, sitzung]])
    expect(korb().items).toEqual([])
  })

  it('updateQuantity(…, 0) gibt ebenso frei — ohne Reservierung', async () => {
    pruefstand.starte(NurKorb)
    await korb().addItem(position(MEHL), 1)
    await pruefstand.zuRuhe()

    expect(await korb().updateQuantity(MEHL.id, 0)).toEqual({ ok: true })
    await pruefstand.zuRuhe()

    expect(freigaben().map(([id]) => id)).toEqual([MEHL.id])
    expect(reservierungen()).toEqual([[MEHL.id, 1]])
    expect(gespeichert()).toEqual({ farmId: HOF_ID, inhalt: [] })
  })

  it('Gegenprobe: eine geänderte Menge über 0 gibt nichts frei', async () => {
    pruefstand.starte(NurKorb)
    await korb().addItem(position(MEHL), 1)
    await korb().updateQuantity(MEHL.id, 3)
    await pruefstand.zuRuhe()

    expect(freigaben()).toEqual([])
  })

  it('scheitert die Freigabe (kein Netz), bleibt das Produkt trotzdem draußen — der Halt läuft dann ab', async () => {
    freigabeScheitert = true
    pruefstand.starte(NurKorb)
    await korb().addItem(position(HONIG), 1)
    await pruefstand.zuRuhe()

    korb().removeItem(HONIG.id)
    await pruefstand.zuRuhe()

    expect(freigaben().map(([id]) => id)).toEqual([HONIG.id])
    expect(korb().items).toEqual([])
    expect(gespeichert()).toEqual({ farmId: HOF_ID, inhalt: [] })
  })
})

describe('useCart: kein Netz (Register N29, Nr. 175)', () => {
  it('addItem ohne Netz wirft nicht: ok false mit dem Netzsatz und „nochmal", der Korb bleibt, wie er war', async () => {
    pruefstand.starte(NurKorb)
    await korb().addItem(position(EIER), 1)
    await pruefstand.zuRuhe()

    reservierenWirft = new TypeError('Failed to fetch')
    expect(await korb().addItem(position(MEHL), 2)).toEqual({ ok: false, error: NETZ_SATZ, nochmal: true })
    await pruefstand.zuRuhe()

    expect(inhalt(korb().items)).toEqual([[EIER.id, 1]])
    expect(gespeichert()).toEqual({ farmId: HOF_ID, inhalt: [[EIER.id, 1]] })
  })

  it('updateQuantity ohne Netz: ok false mit dem Netzsatz, die alte Menge bleibt', async () => {
    pruefstand.starte(NurKorb)
    await korb().addItem(position(EIER), 1)
    await pruefstand.zuRuhe()

    reservierenWirft = new TypeError('Load failed')
    expect(await korb().updateQuantity(EIER.id, 3)).toEqual({ ok: false, error: NETZ_SATZ, nochmal: true })
    await pruefstand.zuRuhe()

    expect(inhalt(korb().items)).toEqual([[EIER.id, 1]])
  })

  it('ein anderer Wurf ist kein Funkloch: ok false ohne Netzsatz und ohne „nochmal", der Korb bleibt', async () => {
    pruefstand.starte(NurKorb)
    reservierenWirft = new TypeError("Cannot read properties of undefined (reading 'x')")
    const ergebnis = await korb().addItem(position(HONIG), 1)
    await pruefstand.zuRuhe()

    expect(ergebnis.ok).toBe(false)
    expect(ergebnis.error).not.toBe(NETZ_SATZ)
    expect(ergebnis.nochmal).toBeUndefined()
    expect(korb().items).toEqual([])
  })

  it('Gegenprobe: mit Netz landet dasselbe Produkt im Korb', async () => {
    pruefstand.starte(NurKorb)
    expect(await korb().addItem(position(MEHL), 2)).toEqual({ ok: true })
    await pruefstand.zuRuhe()

    expect(inhalt(korb().items)).toEqual([[MEHL.id, 2]])
  })

  it('jeder Aufruf von /api/reserve trägt ein Zeitlimit (Signal)', async () => {
    pruefstand.starte(NurKorb)
    await korb().addItem(position(EIER), 1)
    await korb().updateQuantity(EIER.id, 2)
    korb().removeItem(EIER.id)
    await pruefstand.zuRuhe()

    expect(reserviere.mock.calls.map(([, init]) => init?.signal instanceof AbortSignal)).toEqual([true, true, true])
  })
})

describe('useCart: ersetzeKorb (Register N28)', () => {
  it('schreibt Speicher und Zustand', async () => {
    pruefstand.starte(NurKorb)
    await korb().addItem(position(EIER), 2)
    await pruefstand.zuRuhe()

    korb().ersetzeKorb((vorher) => vorher.map((i) => ({ ...i, price: 4.2 })))
    await pruefstand.zuRuhe()

    expect(korb().items.map((i) => i.price)).toEqual([4.2])
    expect(leseWarenkorb(speicher.get(WARENKORB_SCHLUESSEL) ?? null)?.items.map((i) => i.price)).toEqual([4.2])
  })

  it('ohne Änderung schreibt er nichts', async () => {
    pruefstand.starte(NurKorb)
    await pruefstand.zuRuhe()

    korb().ersetzeKorb((vorher) => vorher)
    await pruefstand.zuRuhe()

    expect(speicher.has(WARENKORB_SCHLUESSEL)).toBe(false)
    expect(reserviere).not.toHaveBeenCalled()
  })
})

describe('Produktraster: Abgleich beim Laden (Register N28)', () => {
  const EIER_TEURER: PublicProduct = { ...EIER, price: 3.9 }

  function gespeicherterKorb(...positionen: CartItem[]): void {
    speicher.set(WARENKORB_SCHLUESSEL, JSON.stringify({ farmId: HOF_ID, farmSlug: HOF_SLUG, items: positionen }))
  }

  function raster(neu: { products?: PublicProduct[]; sperre?: KaufSperre; kaufen?: boolean } = {}): void {
    const props = {
      products: neu.products ?? [EIER_TEURER, MEHL],
      farmId: HOF_ID,
      farmSlug: HOF_SLUG,
      sperre: neu.sperre ?? null,
      kaufen: neu.kaufen ?? true,
      hofName: 'Testhof A',
      pauseMessage: null,
    }
    pruefstand.starte(() => {
      ProductGrid(props)
      // Wie Korb-Blatt und Mini-Warenkorb: der Satz zum Korb dieses Hofs.
      hinweis.text = useKorbHinweis(HOF_ID)
    })
  }
  const hinweis = { text: null as string | null }

  afterEach(async () => {
    // Der Satz lebt im Modul — der nächste Fall beginnt ohne (und das Rendern danach noch mit Speicher).
    korb().clearCart()
    await pruefstand.zuRuhe()
  })

  it('übernimmt den neuen Preis, nimmt Fehlendes heraus und sagt es — ohne Reservierung, ohne Freigabe', async () => {
    gespeicherterKorb({ ...position(EIER), quantity: 2 }, { ...position(HONIG), quantity: 1 })
    raster()
    await pruefstand.zuRuhe()

    expect(korb().items.map((i) => [i.productId, i.price])).toEqual([[EIER.id, 3.9]])
    expect(leseWarenkorb(speicher.get(WARENKORB_SCHLUESSEL) ?? null)?.items.map((i) => i.price)).toEqual([3.9])
    expect(hinweis.text).toBe('Eine Position ist nicht mehr verfügbar und wurde entfernt. Ein Preis hat sich geändert – der Korb zeigt den neuen.')
    // Wer nur schaut, hält nichts: kein Aufruf von /api/reserve und keiner der Kasse.
    expect(reserviere).not.toHaveBeenCalled()
  })

  it('der Satz bleibt, bis sich der Korb ändert', async () => {
    gespeicherterKorb({ ...position(EIER), quantity: 2 })
    raster()
    await pruefstand.zuRuhe()
    expect(hinweis.text).not.toBeNull()

    await korb().addItem(position(MEHL), 1)
    await pruefstand.zuRuhe()
    expect(hinweis.text).toBeNull()
  })

  it('ohne Änderung: nichts geschrieben, kein Satz', async () => {
    const roh = JSON.stringify({ farmId: HOF_ID, farmSlug: HOF_SLUG, items: [{ ...position(MEHL), quantity: 1 }] })
    speicher.set(WARENKORB_SCHLUESSEL, roh)
    raster()
    await pruefstand.zuRuhe()

    expect(speicher.get(WARENKORB_SCHLUESSEL)).toBe(roh)
    expect(hinweis.text).toBeNull()
  })

  it('mit Kaufsperre bleibt der Korb, wie er ist', async () => {
    const roh = JSON.stringify({ farmId: HOF_ID, farmSlug: HOF_SLUG, items: [{ ...position(EIER), quantity: 2 }, { ...position(HONIG), quantity: 1 }] })
    speicher.set(WARENKORB_SCHLUESSEL, roh)
    raster({ sperre: 'pause' })
    await pruefstand.zuRuhe()

    expect(speicher.get(WARENKORB_SCHLUESSEL)).toBe(roh)
    expect(hinweis.text).toBeNull()
  })

  it('in der Vorschau des Hofs (kaufen=false) gleicht es nicht ab', async () => {
    const roh = JSON.stringify({ farmId: HOF_ID, farmSlug: HOF_SLUG, items: [{ ...position(EIER), quantity: 2 }] })
    speicher.set(WARENKORB_SCHLUESSEL, roh)
    raster({ kaufen: false })
    await pruefstand.zuRuhe()

    expect(speicher.get(WARENKORB_SCHLUESSEL)).toBe(roh)
    expect(hinweis.text).toBeNull()
  })
})
