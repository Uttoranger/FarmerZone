/**
 * Abgleich des Gesamtbetrags in der Kasse (Nr. 287, Register N10): die Kundin zahlt nie einen Betrag, den sie
 * nicht gesehen hat. Die Route prüft echt in tests/integration/kasse-gesamtbetrag.int.test.ts; hier Schema und
 * Kasse im Browser.
 *
 * Beweist:
 *  - Schema: `gesamtCents` ist optional (alter Tab), ganze Cent zwischen 0 und 100 000 000.
 *  - Absenden: die Kasse schickt den Gesamtbetrag mit, den sie zeigt; auf GESAMT_GEAENDERT lädt sie die Seite nach.
 *  - Nach GESAMT_GEAENDERT zeigt die Kasse den Betrag des Servers — in der Zusammenfassung, auf „Weiter zur
 *    Zahlung“ und auf „Zahlungspflichtig bestellen“; nach einer Mengenänderung oder mit anderer Zahlart wieder den
 *    eigenen (Gegenprobe).
 *
 * Prüfstand wie tests/kasse-zustaende.test.ts (TESTING_GUIDELINES §1): `useEffect` läuft je Quelltext einmal sofort
 * (die Kasse liest den Korb im Effekt); `useState` gibt dem Zustand mit dem Anfang `keinServerBetrag` auf Wunsch
 * einen Betrag des Servers — gesetzt wird er im Browser erst nach der Antwort, auf dem Server verpufft das. Zum
 * Absenden hält eine Hülle um `useForm` den Absende-Griff fest, den die Kasse selbst baut, und `useTransition`
 * lässt den Rückruf laufen (TESTING_GUIDELINES §1, „Ein Formular absenden geht auch ohne DOM“).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const pruefstand = vi.hoisted(() => ({
  gelaufen: new Set<string>(),
  serverBetrag: null as null | { betrag: { amountCents: number; serviceFeeCents: number }; fuer: string },
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
    const paar = echt.useState(start)
    if (typeof start === 'function' && start.name === 'keinServerBetrag' && pruefstand.serverBetrag) {
      return [pruefstand.serverBetrag as S, paar[1]]
    }
    return paar
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

import { CheckoutForm, kassenStand } from '@/components/checkout/checkout-form'
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
/** Der Betrag des Servers aus der Antwort GESAMT_GEAENDERT: Ware € 9,80 und eine Gebühr von € 0,70. */
const VOM_SERVER = { amountCents: 1050, serviceFeeCents: 70 }

/** Die Kasse mit zwei Eier-Packungen (bzw. `menge`), Zahlart und Termin vorbelegt. */
function kasse(paymentMethod: 'ONLINE' | 'ONSITE_CASH', menge = 2): string {
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
  return renderToStaticMarkup(
    createElement(CheckoutForm, { farm: HOF, nurBetriebeIds: [], vorbelegung: null, ausgebuchteAbholfenster: [], sperre: null })
  )
}

/** Der Text der Zusammenfassung „Deine Bestellung“ bis zum Knopf. */
const zusammenfassung = (html: string): string => html.slice(html.indexOf('Deine Bestellung'), html.indexOf('type="submit"'))

beforeEach(() => {
  pruefstand.serverBetrag = null
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

describe('Kasse: Absenden mit dem Gesamtbetrag', () => {
  it('schickt den gezeigten Gesamtbetrag mit; auf GESAMT_GEAENDERT lädt sie die Seite nach, statt zu bestellen', async () => {
    const gesendet: unknown[] = []
    kasse('ONLINE')
    vi.stubGlobal('document', { getElementById: () => null })
    vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
      gesendet.push(JSON.parse(init.body))
      return new Response(
        JSON.stringify({ error: 'Der Gesamtbetrag hat sich geändert. Bitte prüf ihn und bestell dann noch einmal.', code: 'GESAMT_GEAENDERT', ...VOM_SERVER }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      )
    })

    await pruefstand.absenden?.({ preventDefault: () => {}, persist: () => {} })
    await Promise.all(pruefstand.laeufe)

    expect(pruefstand.absenden).not.toBeNull()
    // Online: € 9,80 Ware + € 0,50 Mindestgebühr = € 10,30, so wie die Kasse ihn zeigt.
    expect(gesendet).toEqual([expect.objectContaining({ gesamtCents: 1030, paymentMethod: 'ONLINE' })])
    expect(pruefstand.refresh).toHaveBeenCalledTimes(1)
  })
})

describe('Kasse: nach GESAMT_GEAENDERT der Betrag des Servers', () => {
  it('online: Zusammenfassung und „Weiter zur Zahlung“ zeigen € 10,50 statt der eigenen € 10,30', () => {
    const eigen = kasse('ONLINE')
    pruefstand.serverBetrag = { betrag: VOM_SERVER, fuer: kassenStand([{ productId: 'eier', quantity: 2, price: 4.9 }], 'ONLINE') }

    const html = kasse('ONLINE')

    expect(eigen).toContain('Weiter zur Zahlung · € 10,30')
    expect(html).toContain('Weiter zur Zahlung · € 10,50')
    expect(zusammenfassung(html)).toContain('€ 10,50')
    expect(zusammenfassung(html)).not.toContain('€ 10,30')
  })

  it('bar: „Zahlungspflichtig bestellen“ zeigt den Betrag des Servers', () => {
    pruefstand.serverBetrag = { betrag: VOM_SERVER, fuer: kassenStand([{ productId: 'eier', quantity: 2, price: 4.9 }], 'ONSITE_CASH') }

    const html = kasse('ONSITE_CASH')

    expect(html).toContain('Zahlungspflichtig bestellen · € 10,50')
    expect(zusammenfassung(html)).toContain('€ 10,50')
  })

  it('Gegenprobe: nach einer Mengenänderung oder mit anderer Zahlart wieder der eigene Betrag', () => {
    pruefstand.serverBetrag = { betrag: VOM_SERVER, fuer: kassenStand([{ productId: 'eier', quantity: 2, price: 4.9 }], 'ONLINE') }

    const mehr = kasse('ONLINE', 3)
    const bar = kasse('ONSITE_CASH')

    // Drei Packungen: € 14,70 + € 0,74 (5 %) = € 15,44 — die eigene Rechnung, nicht der Betrag des Servers.
    expect(mehr).toContain('Weiter zur Zahlung · € 15,44')
    expect(mehr).not.toContain('€ 10,50')
    // Bar vor dem Stichtag: ohne Gebühr, € 9,80.
    expect(bar).toContain('Zahlungspflichtig bestellen · € 9,80')
    expect(bar).not.toContain('€ 10,50')
  })
})
