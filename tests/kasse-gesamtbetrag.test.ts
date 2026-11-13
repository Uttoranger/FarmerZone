/**
 * Abgleich des Gesamtbetrags in der Kasse (Nr. 287, Register N10): die Kundin zahlt nie einen Betrag, den sie
 * nicht gesehen hat. Die Route prüft echt in tests/integration/kasse-gesamtbetrag.int.test.ts; hier Schema und
 * Kasse im Browser.
 *
 * Beweist:
 *  - Schema: `gesamtCents` ist optional (alter Tab), ganze Cent zwischen 0 und 100 000 000.
 *  - Die Kette: Die Kasse schickt den Gesamtbetrag, den sie zeigt; auf 409 GESAMT_GEAENDERT lädt sie die Seite nach,
 *    zeigt danach den Betrag des Servers (Zusammenfassung, „Weiter zur Zahlung“, Hinweis am Korb; bar steht er seit
 *    Nr. 309 nur in der Zusammenfassung über „Zahlungspflichtig bestellen“), und der nächste Klick schickt genau ihn.
 *  - Ändern sich Menge oder Zahlart, wird der Betrag des Servers leer: auch nach dem Zurückstellen gilt wieder der
 *    eigene (Runde 1, B2).
 *
 * Prüfstand (TESTING_GUIDELINES §1): `useEffect` läuft je Quelltext einmal sofort (die Kasse liest den Korb im
 * Effekt). `useState` merkt sich für die Kasse (checkout-form.tsx) jeden gesetzten Wert je Aufrufstelle und beginnt
 * den nächsten Aufbau damit — so trägt ein Wert, den die Kasse nach der Antwort setzt, in den nächsten Aufbau, wie im
 * Browser; während des Renderns wirkt das Setzen wie gewohnt. Zum Absenden hält eine Hülle um `useForm` den
 * Absende-Griff fest, den die Kasse selbst baut, und `useTransition` lässt den Rückruf laufen („Ein Formular absenden
 * geht auch ohne DOM“). Gegenprobe: das alte Formular (ohne `gesamtCents`, ohne Zurücksetzen) macht die Fälle rot.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const pruefstand = vi.hoisted(() => ({
  gelaufen: new Set<string>(),
  /** Gesetzte Werte der Kasse je Aufrufstelle von useState (Zeile des Stapels). */
  zustand: new Map<string, unknown>(),
  rendert: false,
  vorbelegung: {} as Record<string, string>,
  absenden: null as null | ((e?: unknown) => Promise<void>),
  laeufe: [] as Array<Promise<unknown>>,
  refresh: vi.fn(),
}))

vi.mock('react', async (importOriginal) => {
  const echt = await importOriginal<typeof import('react')>()
  function useEffect(effekt: () => void | (() => void)): void {
    const quelltext = effekt.toString()
    if (pruefstand.gelaufen.has(quelltext)) return
    pruefstand.gelaufen.add(quelltext)
    effekt()
  }
  function useState<S>(start: S | (() => S)): [S, (wert: S | ((alt: S) => S)) => void] {
    const stelle = new Error().stack?.split('\n')[2] ?? ''
    const eigen = stelle.includes('checkout-form')
    const paar = echt.useState<S>(eigen && pruefstand.zustand.has(stelle) ? (pruefstand.zustand.get(stelle) as S) : start)
    if (!eigen) return paar
    const [wert, setze] = paar
    const merkeUndSetze = (neu: S | ((alt: S) => S)): void => {
      const alt = (pruefstand.zustand.has(stelle) ? pruefstand.zustand.get(stelle) : wert) as S
      const naechster = typeof neu === 'function' ? (neu as (alt: S) => S)(alt) : neu
      pruefstand.zustand.set(stelle, naechster)
      // Nach dem Aufbau gibt es auf dem Server nichts mehr zu setzen — der nächste Aufbau beginnt mit dem Wert.
      if (pruefstand.rendert) setze(naechster)
    }
    return [wert, merkeUndSetze]
  }
  // Auf dem Server wirft startTransition — hier läuft der Rückruf, und der Test wartet auf ihn.
  function useTransition(): [boolean, (rueckruf: () => unknown) => void] {
    return [false, (rueckruf) => void pruefstand.laeufe.push(Promise.resolve(rueckruf()))]
  }
  const ersetzt = { useEffect, useState, useTransition }
  return { ...echt, ...ersetzt, default: { ...echt, ...ersetzt } }
})
vi.mock('react-hook-form', async (importOriginal) => {
  const echt = await importOriginal<typeof import('react-hook-form')>()
  return {
    ...echt,
    useForm: (optionen: Parameters<typeof echt.useForm>[0]) => {
      const form = echt.useForm({ ...optionen, defaultValues: { ...(optionen?.defaultValues as object), ...pruefstand.vorbelegung } })
      const handleSubmit = form.handleSubmit
      // Den Absende-Griff festhalten, den die Kasse selbst baut — Schema und onSubmit bleiben echt.
      form.handleSubmit = ((ok, fehler) => {
        const griff = handleSubmit(ok, fehler)
        pruefstand.absenden = griff as (e?: unknown) => Promise<void>
        return griff
      }) as typeof form.handleSubmit
      return form
    },
  }
})
vi.mock('@/lib/stripe-client', () => ({ getStripePromise: () => null }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: pruefstand.refresh }),
  usePathname: () => '/hof-test/checkout',
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('next/image', () => ({ default: (p: { src: string; alt: string }) => createElement('img', { src: p.src, alt: p.alt }) }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('@/lib/auth-client', () => ({ useSession: () => ({ data: null }), signOut: vi.fn() }))

import { CheckoutForm } from '@/components/checkout/checkout-form'
import { checkoutRequestSchema } from '@/schemas/checkout'
import { abholKacheln } from '@/lib/kasse'
import { SITZUNG_SCHLUESSEL, WARENKORB_SCHLUESSEL } from '@/lib/warenkorb-speicher'
import type { PublicFarm } from '@/server/queries/farm'
import { publicFarm } from './fabrik/public-farm'

// Montag, 5. Oktober 2026, 10:00 Uhr in Wien — vor dem Bar-Stichtag (B1): bar ohne Gebühr, online mind. € 0,50.
const JETZT = new Date('2026-10-05T08:00:00.000Z')
const HOF: PublicFarm = publicFarm({ name: 'Hof Beispiel', pickupSlots: [{ dayOfWeek: 6, startTime: '14:00', endTime: '16:00' }] })
const [KACHEL] = abholKacheln(HOF.pickupSlots, JETZT, [])
const EIER = { productId: 'eier', name: 'Freilandeier 10er', price: 4.9, unit: 'STUECK', unitSize: null, imageUrl: null }
const SATZ = 'Der Gesamtbetrag hat sich geändert. Bitte prüf ihn und bestell dann noch einmal.'
/** Der Betrag des Servers aus der Antwort GESAMT_GEAENDERT: Ware € 9,80 und eine Gebühr von € 0,70. */
const VOM_SERVER = { amountCents: 1050, serviceFeeCents: 70 }

type Zahlart = 'ONLINE' | 'ONSITE_CASH'

/** Ein Aufbau der Kasse mit `menge` Eier-Packungen, Zahlart und Termin vorbelegt — mit dem gemerkten Zustand. */
function kasse(paymentMethod: Zahlart, menge = 2): string {
  pruefstand.gelaufen.clear()
  pruefstand.vorbelegung = {
    pickupSlotKey: KACHEL?.key ?? '',
    paymentMethod,
    customerName: 'Erika Mustermann',
    customerEmail: 'erika@example.com',
    customerPhone: '+43 660 0000000',
  }
  const daten: Record<string, string> = {
    [SITZUNG_SCHLUESSEL]: 'sid_test',
    [WARENKORB_SCHLUESSEL]: JSON.stringify({ farmId: HOF.id, farmSlug: HOF.slug, items: [{ ...EIER, quantity: menge }] }),
  }
  vi.stubGlobal('localStorage', { getItem: (k: string) => daten[k] ?? null, setItem: () => {}, removeItem: () => {} })
  pruefstand.rendert = true
  try {
    return renderToStaticMarkup(
      createElement(CheckoutForm, { farm: HOF, nurBetriebeIds: [], vorbelegung: null, ausgebuchteAbholfenster: [], sperre: null })
    )
  } finally {
    pruefstand.rendert = false
  }
}

/** Den Kaufknopf des letzten Aufbaus drücken; der Server antwortet mit 409 GESAMT_GEAENDERT. Gibt den gesendeten Körper zurück. */
async function absendenMitGesamtGeaendert(): Promise<Record<string, unknown>> {
  const gesendet: Array<Record<string, unknown>> = []
  vi.stubGlobal('document', { getElementById: () => null })
  vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
    gesendet.push(JSON.parse(init.body) as Record<string, unknown>)
    return new Response(JSON.stringify({ error: SATZ, code: 'GESAMT_GEAENDERT', ...VOM_SERVER }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  expect(pruefstand.absenden).not.toBeNull()
  await pruefstand.absenden?.({ preventDefault: () => {}, persist: () => {} })
  await Promise.all(pruefstand.laeufe.splice(0))
  vi.stubGlobal('document', undefined)
  vi.stubGlobal('fetch', () => new Promise(() => {}))
  expect(gesendet).toHaveLength(1)
  return gesendet[0] ?? {}
}

/** Der Text der Zusammenfassung „Deine Bestellung“ bis zum Knopf. */
const zusammenfassung = (html: string): string => html.slice(html.indexOf('Deine Bestellung'), html.indexOf('type="submit"'))

beforeEach(() => {
  pruefstand.zustand.clear()
  pruefstand.absenden = null
  pruefstand.laeufe.length = 0
  pruefstand.refresh.mockClear()
  vi.useFakeTimers({ now: JETZT })
  vi.stubGlobal('window', globalThis)
  vi.stubGlobal('fetch', () => new Promise(() => {}))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('checkoutRequestSchema: gesamtCents', () => {
  const basis = {
    farmId: 'farm_test',
    farmSlug: 'hof-test',
    sessionId: 'sid_test',
    customerName: 'Erika Mustermann',
    customerEmail: 'erika@example.com',
    customerPhone: '+43 660 0000000',
    pickupDate: '2026-10-10',
    pickupTimeStart: '14:00',
    pickupTimeEnd: '16:00',
    paymentMethod: 'ONSITE_CASH',
    items: [{ productId: 'eier', quantity: 2, unitPrice: 4.9 }],
  }

  it('ohne Feld (alter Tab) gültig; ganze Cent von 0 bis 100 000 000 gültig', () => {
    expect(checkoutRequestSchema.safeParse(basis).success).toBe(true)
    for (const gesamtCents of [0, 980, 100_000_000]) {
      expect(checkoutRequestSchema.safeParse({ ...basis, gesamtCents }).data?.gesamtCents).toBe(gesamtCents)
    }
  })

  it('Bruchteile, negative, zu große Beträge und Text sind ungültig', () => {
    for (const gesamtCents of [9.8, -1, 100_000_001, '980']) {
      expect(checkoutRequestSchema.safeParse({ ...basis, gesamtCents }).success, String(gesamtCents)).toBe(false)
    }
  })
})

describe('Kasse: die Kette nach GESAMT_GEAENDERT', () => {
  it('online: schickt den gezeigten Betrag, zeigt nach 409 den des Servers, und der nächste Klick schickt genau ihn', async () => {
    const vorher = kasse('ONLINE')
    expect(vorher).toContain('Weiter zur Zahlung · € 10,30')

    // Online: € 9,80 Ware + € 0,50 Mindestgebühr = € 10,30, so wie die Kasse ihn zeigt.
    expect(await absendenMitGesamtGeaendert()).toMatchObject({ gesamtCents: 1030, paymentMethod: 'ONLINE' })
    expect(pruefstand.refresh).toHaveBeenCalledTimes(1)

    const danach = kasse('ONLINE')
    expect(danach).toContain('Weiter zur Zahlung · € 10,50')
    expect(zusammenfassung(danach)).toContain('€ 10,50')
    expect(zusammenfassung(danach)).not.toContain('€ 10,30')
    expect(danach).toContain(SATZ)

    // Der nächste Klick schickt den Betrag des Servers — keine Schleife.
    expect(await absendenMitGesamtGeaendert()).toMatchObject({ gesamtCents: 1050 })
  })

  it('bar: die Zusammenfassung über „Zahlungspflichtig bestellen“ zeigt danach den Betrag des Servers (Nr. 309: nicht der Knopf)', async () => {
    kasse('ONSITE_CASH')
    expect(await absendenMitGesamtGeaendert()).toMatchObject({ gesamtCents: 980, paymentMethod: 'ONSITE_CASH' })

    const danach = kasse('ONSITE_CASH')

    expect(danach).toContain('>Zahlungspflichtig bestellen</button>')
    expect(zusammenfassung(danach)).toContain('€ 10,50')
    expect(danach.indexOf('data-kauf-zusammenfassung')).toBeLessThan(danach.indexOf('>Zahlungspflichtig bestellen</button>'))
  })
})

describe('Kasse: der Betrag des Servers wird leer, sobald sich Korb oder Zahlart ändern', () => {
  it('Menge ändern und zurückstellen: wieder der eigene Betrag, nie mehr der des Servers', async () => {
    kasse('ONLINE')
    await absendenMitGesamtGeaendert()
    expect(kasse('ONLINE')).toContain('Weiter zur Zahlung · € 10,50')

    const mehr = kasse('ONLINE', 3)
    const zurueck = kasse('ONLINE', 2)

    // Drei Packungen: € 14,70 + € 0,74 (5 %) = € 15,44 — die eigene Rechnung.
    expect(mehr).toContain('Weiter zur Zahlung · € 15,44')
    expect(mehr).not.toContain('€ 10,50')
    expect(zurueck).toContain('Weiter zur Zahlung · € 10,30')
    expect(zurueck).not.toContain('€ 10,50')
  })

  it('Zahlart wechseln und zurück: wieder der eigene Betrag', async () => {
    kasse('ONLINE')
    await absendenMitGesamtGeaendert()

    const bar = kasse('ONSITE_CASH')
    const online = kasse('ONLINE')

    // Bar vor dem Stichtag: ohne Gebühr, € 9,80.
    expect(bar).toContain('>Zahlungspflichtig bestellen</button>')
    expect(zusammenfassung(bar)).toContain('€ 9,80')
    expect(bar).not.toContain('€ 10,50')
    expect(online).toContain('Weiter zur Zahlung · € 10,30')
    expect(online).not.toContain('€ 10,50')
  })
})
