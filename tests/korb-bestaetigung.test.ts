/**
 * Korb ohne Blatt-Pingpong auf der Hofseite (Register N30, Nr. 177; Board
 * system-sterne-hofseite-orientierung Punkt 4).
 *
 * Das echte Produktraster mit dem echten useCart auf dem Prüfstand aus
 * tests/use-cart.test.ts (TESTING_GUIDELINES): Zustand je Aufrufstelle,
 * Rendern nach einer Änderung, Effekte danach. Getippt wird über den Weg in
 * den Korb nach außen (`inDenKorb`, wie „Aktuell vom Hof“) und über die
 * Knöpfe der Bestätigungszeile im gerenderten Baum. /api/reserve ist
 * gemockt, localStorage und sessionStorage sind Maps.
 *
 * Beweist: Das erste „+“ einer Sitzung öffnet das Korb-Blatt, das zweite
 * nicht — dann steht „… ist im Korb“ mit „Rückgängig“ (role="status");
 * Rückgängig setzt die Menge über useCart zurück (aus dem Korb bzw. auf die
 * Menge davor); die Zeile geht beim Tipp auf die Korb-Leiste; am Netz steht
 * der Satz aus N29 mit „Nochmal“, das den Griff wiederholt; ein roher
 * Servertext erscheint nie.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactElement, ReactNode } from 'react'
import type { PublicProduct } from '@/server/queries/farm'
import { publicProduct } from './fabrik/public-product'
import type { Warenkorb } from '@/lib/use-cart'
import { ProductGrid, type InDenKorb } from '@/components/farm/product-grid'
import { CartSheet } from '@/components/farm/cart-sheet'
import { BLATT_MERKER, vergissBlattMerker } from '@/lib/hofseite-orientierung'
import { NETZ_KNOPF, NETZ_SATZ } from '@/lib/netz'


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
    // Der Weg in den Korb nach außen (Nr. 128): Der Test tippt über ihn wie „Aktuell vom Hof“ — gleich beim Rendern gesetzt.
    useImperativeHandle(ref: unknown, erzeuge: () => unknown): void {
      if (ref && typeof ref === 'object') (ref as { current: unknown }).current = erzeuge()
    },
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
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }) }))

const EIER = publicProduct({ id: 'prod_eier', name: 'Eier', category: null, price: 3.5, unit: 'kg', unitSize: 1, stock: 10 })
const MEHL = publicProduct({ id: 'prod_mehl', name: 'Mehl', category: null, price: 2.1, unit: 'kg', unitSize: 1, stock: 10 })

let speicher = new Map<string, string>()
let sitzung = new Map<string, string>()
/** Die Antwort von /api/reserve auf POST: ok, ein Fehlertext des Servers oder ein Wurf (Funkloch). */
let antwort: { art: 'ok' } | { art: 'text'; text: string } | { art: 'netz' } = { art: 'ok' }
const reserve = vi.fn(async (_adresse: string, init?: RequestInit): Promise<Response> => {
  if (init?.method === 'DELETE') return { ok: true, json: async () => ({ ok: true }) } as Response
  if (antwort.art === 'netz') throw new TypeError('Failed to fetch')
  if (antwort.art === 'text') {
    const text = antwort.text
    return { ok: false, json: async () => ({ error: text }) } as Response
  }
  return { ok: true, json: async () => ({ ok: true }) } as Response
})

function karte(map: () => Map<string, string>) {
  return {
    getItem: (k: string) => map().get(k) ?? null,
    setItem: (k: string, v: string) => void map().set(k, v),
    removeItem: (k: string) => void map().delete(k),
  }
}

beforeEach(() => {
  speicher = new Map()
  sitzung = new Map()
  antwort = { art: 'ok' }
  reserve.mockClear()
  vergissBlattMerker()
  vi.stubGlobal('localStorage', karte(() => speicher))
  vi.stubGlobal('window', {
    location: { hash: '', pathname: '/hof-test', search: '' },
    dispatchEvent: () => true,
    sessionStorage: karte(() => sitzung),
  })
  vi.stubGlobal('document', { addEventListener: () => {}, removeEventListener: () => {} })
  vi.stubGlobal('fetch', reserve)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

let baum: ReactNode = null
const weg: { current: InDenKorb | null } = { current: null }

function raster(): void {
  const props = { products: [EIER, MEHL], farmId: 'farm_test', farmSlug: 'hof-test', hofName: 'Testhof A', pauseMessage: null, inDenKorb: weg }
  pruefstand.starte(() => {
    baum = ProductGrid(props)
  })
}

/** Alle Elemente des Baums (ohne Kinder von Komponenten — der Prüfstand rendert sie nicht). */
function elemente(knoten: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(knoten)) return knoten.flatMap((k) => elemente(k as ReactNode))
  if (!knoten || typeof knoten !== 'object' || !('props' in knoten)) return []
  const el = knoten as ReactElement<Record<string, unknown>>
  return [el, ...elemente(el.props.children as ReactNode)]
}

function text(knoten: ReactNode): string {
  if (typeof knoten === 'string' || typeof knoten === 'number') return String(knoten)
  if (Array.isArray(knoten)) return knoten.map((k) => text(k as ReactNode)).join('')
  if (knoten && typeof knoten === 'object' && 'props' in knoten) return text((knoten as ReactElement<{ children?: ReactNode }>).props.children)
  return ''
}

function zeile(): ReactElement<Record<string, unknown>> | undefined {
  return elemente(baum).find((e) => e.props['data-korb-zeile'] !== undefined)
}

function knopfInZeile(beschriftung: string): () => void {
  const knopf = elemente(zeile()).find((e) => e.type === 'button' && text(e.props.children as ReactNode) === beschriftung)
  if (!knopf) throw new Error(`Kein Knopf „${beschriftung}“ in der Zeile.`)
  return knopf.props.onClick as () => void
}

function blattOffen(): boolean {
  const blatt = elemente(baum).find((e) => e.type === CartSheet)
  return blatt?.props.open === true
}

function schliesseBlatt(): void {
  const blatt = elemente(baum).find((e) => e.type === CartSheet)
  ;(blatt?.props.onOpenChange as (offen: boolean) => void)(false)
}

function inhalt(): Array<[string, number]> {
  return (geliefert.korb?.items ?? []).map((i) => [i.productId, i.quantity])
}

async function tippe(p: PublicProduct): Promise<void> {
  weg.current!(p)
  await vi.waitFor(() => expect(reserve).toHaveBeenCalled())
  await pruefstand.zuRuhe()
  await pruefstand.zuRuhe()
}

describe('N30: nur das erste „In den Korb“ öffnet das Blatt', () => {
  it('erstes „+“: Blatt offen, keine Zeile — der Merker steht im sessionStorage', async () => {
    raster()
    await tippe(EIER)
    expect(blattOffen()).toBe(true)
    expect(zeile()).toBeUndefined()
    expect(sitzung.get(BLATT_MERKER)).toBe('1')
  })

  it('zweites „+“: kein Blatt, sondern „… ist im Korb“ mit Rückgängig, role="status"', async () => {
    raster()
    await tippe(EIER)
    schliesseBlatt()
    await pruefstand.zuRuhe()
    reserve.mockClear()
    await tippe(MEHL)
    expect(blattOffen()).toBe(false)
    expect(zeile()?.props.role).toBe('status')
    expect(text(zeile()?.props.children as ReactNode)).toContain('Mehl ist im Korb')
    expect(knopfInZeile('Rückgängig')).toBeTypeOf('function')
    expect(inhalt()).toEqual([['prod_eier', 1], ['prod_mehl', 1]])
  })

  it('Gegenprobe: in einer neuen Sitzung (leerer Merker) öffnet das erste „+“ wieder das Blatt', async () => {
    sitzung.set(BLATT_MERKER, '1')
    raster()
    await tippe(EIER)
    expect(blattOffen()).toBe(false)
    sitzung.clear()
    reserve.mockClear()
    await tippe(MEHL)
    expect(blattOffen()).toBe(true)
  })

  it('Rückgängig nimmt ein neues Produkt wieder heraus (Halt frei) — und setzt eine erhöhte Menge auf die von vorher', async () => {
    sitzung.set(BLATT_MERKER, '1')
    raster()
    await tippe(MEHL)
    knopfInZeile('Rückgängig')()
    await pruefstand.zuRuhe()
    expect(inhalt()).toEqual([])
    expect(reserve.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(true)
    expect(zeile()).toBeUndefined()

    reserve.mockClear()
    await tippe(EIER)
    reserve.mockClear()
    await tippe(EIER)
    expect(inhalt()).toEqual([['prod_eier', 2]])
    knopfInZeile('Rückgängig')()
    await vi.waitFor(() => expect(inhalt()).toEqual([['prod_eier', 1]]))
  })

  it('der Tipp auf die Korb-Leiste nimmt die Zeile weg und öffnet den Korb', async () => {
    sitzung.set(BLATT_MERKER, '1')
    raster()
    await tippe(EIER)
    expect(zeile()).toBeDefined()
    const leiste = elemente(baum).find((e) => e.type === 'button' && text(e.props.children as ReactNode).includes('Zum Warenkorb'))
    ;(leiste?.props.onClick as () => void)()
    await pruefstand.zuRuhe()
    expect(zeile()).toBeUndefined()
    expect(blattOffen()).toBe(true)
  })
})

describe('Fehler an der Aktion (Register N29, Übergabe aus Nr. 175)', () => {
  it('ohne Netz: der Satz aus N29 mit „Nochmal“ — „Nochmal“ wiederholt den Griff, kein Blatt', async () => {
    raster()
    antwort = { art: 'netz' }
    await tippe(EIER)
    expect(zeile()?.props['data-korb-zeile']).toBe('fehler')
    expect(text(zeile()?.props.children as ReactNode)).toContain(NETZ_SATZ)
    expect(blattOffen()).toBe(false)
    expect(inhalt()).toEqual([])

    antwort = { art: 'ok' }
    reserve.mockClear()
    knopfInZeile(NETZ_KNOPF)()
    await vi.waitFor(() => expect(inhalt()).toEqual([['prod_eier', 1]]))
    await pruefstand.zuRuhe()
    // Erst jetzt ist es das erste „In den Korb“, das gelang: das Blatt öffnet.
    expect(blattOffen()).toBe(true)
  })

  it('ein roher Servertext erscheint nie — geglättet, ohne „Nochmal“', async () => {
    raster()
    antwort = { art: 'text', text: 'Serverfehler bei der Reservierung' }
    await tippe(EIER)
    const satz = text(zeile()?.props.children as ReactNode)
    expect(satz).not.toContain('Serverfehler')
    expect(satz).toContain('Wir konnten das Produkt nicht in den Korb legen.')
    expect(() => knopfInZeile(NETZ_KNOPF)).toThrow()
  })

  it('Menge ändern ohne Netz: der Satz aus N29 statt des allgemeinen Satzes', async () => {
    sitzung.set(BLATT_MERKER, '1')
    raster()
    await tippe(EIER)
    antwort = { art: 'netz' }
    reserve.mockClear()
    // Die Karten rendert der Prüfstand nicht — die Mengenänderung geht über dieselbe Funktion wie der Stepper.
    const karte = (elemente(baum).find((e) => e.props.abschnitte !== undefined)?.props.renderKarte as (p: PublicProduct) => ReactElement<Record<string, unknown>>)(EIER)
    ;(karte.props.onMenge as (p: PublicProduct, menge: number) => void)(EIER, 3)
    await vi.waitFor(() => expect(reserve).toHaveBeenCalled())
    await pruefstand.zuRuhe()
    expect(text(zeile()?.props.children as ReactNode)).toContain(NETZ_SATZ)
    expect(knopfInZeile(NETZ_KNOPF)).toBeTypeOf('function')
    expect(inhalt()).toEqual([['prod_eier', 1]])
  })
})
