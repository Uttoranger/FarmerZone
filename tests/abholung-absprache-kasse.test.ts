/**
 * Abholung nach Absprache in der Kasse (Register N47, Nr. 257): das echte
 * CheckoutForm, serverseitig gerendert, mit dem Prüfstand aus
 * tests/kasse-formular.test.ts (jeder Effekt einmal sofort, Korb aus dem
 * gestellten localStorage).
 *
 * Beweist: Liegt ein Produkt mit „Abholung nach Absprache“ im Korb, steht der
 * Hinweis über der Terminwahl und das Notizfeld heißt „Notiz zur Abholung
 * (freiwillig)“ — Feldname customerNote und Termin-Pflicht bleiben. Ohne ein
 * solches Produkt im Korb (auch wenn der Hof eines hat) bleibt alles wie bisher.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const pruefstand = vi.hoisted(() => ({ gelaufen: new Set<string>() }))

vi.mock('react', async (importOriginal) => {
  const echt = await importOriginal<typeof import('react')>()
  // Jeder Effekt einmal (je Quelltext), sofort beim Rendern — wie nach dem
  // ersten Render im Browser. Aufräumen gibt es auf dem Server nicht.
  function useEffect(effekt: () => void | (() => void)): void {
    const quelltext = effekt.toString()
    if (pruefstand.gelaufen.has(quelltext)) return
    pruefstand.gelaufen.add(quelltext)
    effekt()
  }
  return { ...echt, useEffect, default: { ...echt, useEffect } }
})
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
  usePathname: () => '/hof-test/checkout',
  useSearchParams: () => new URLSearchParams(),
}))
// Seit Lauf 31 trägt der Kopf der Fokus-Shell im Browser die Bildmarke (next/image); der Prüfstand setzt `window`
// auf globalThis ohne `location`, an dem next/image beim Rendern liest — darum ein schlichtes <img>.
vi.mock('next/image', () => ({ default: (p: { src: string; alt: string }) => createElement('img', { src: p.src, alt: p.alt }) }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
// Stripe bleibt echt (Wache tests/paket-mock-wache.test.ts): Der Zahlungsschritt kommt hier nicht vor.
vi.mock('@/lib/stripe-client', () => ({ getStripePromise: () => null }))

import { CheckoutForm } from '@/components/checkout/checkout-form'
import { ABSPRACHE_TEXT } from '@/lib/abholhinweise'
import { SITZUNG_SCHLUESSEL, WARENKORB_SCHLUESSEL } from '@/lib/warenkorb-speicher'
import type { PublicFarm } from '@/server/queries/farm'
import type { KaufSperre } from '@/lib/bereiche-anzeige'
import { publicFarm } from './fabrik/public-farm'

// Montag, 5. Oktober 2026, 10:00 Uhr in Wien — vor dem Bar-Stichtag (Register B1).
const JETZT = new Date('2026-10-05T08:00:00.000Z')

const HOF: PublicFarm = publicFarm({
  ownerName: 'Max Mustermann',
  description: '',
  address: 'Feldweg 1',
  postalCode: '4910',
  city: 'Ried',
  pickupSlots: [{ dayOfWeek: 6, startTime: '14:00', endTime: '16:00' }],
})

// Zwei Eier-Packungen im Korb (Produkt-ID „eier“).
const SPEICHER: Record<string, string> = {
  [SITZUNG_SCHLUESSEL]: 'sid_test',
  [WARENKORB_SCHLUESSEL]: JSON.stringify({
    farmId: 'farm_test',
    farmSlug: 'hof-test',
    items: [{ productId: 'eier', name: 'Freilandeier 10er', price: 4.9, unit: 'STUECK', unitSize: null, quantity: 2, imageUrl: null }],
  }),
}

/** Ein frischer Aufbau der Kasse — jeder Effekt läuft dafür wieder einmal. */
function kasse(
  hof: PublicFarm,
  optionen: { abspracheIds?: string[]; sperre?: KaufSperre } = {}
): string {
  pruefstand.gelaufen.clear()
  return renderToStaticMarkup(
    createElement(CheckoutForm, {
      farm: hof,
      nurBetriebeIds: [],
      abspracheIds: optionen.abspracheIds,
      vorbelegung: null,
      ausgebuchteAbholfenster: [],
      sperre: optionen.sperre ?? null,
    })
  )
}


beforeEach(() => {
  vi.useFakeTimers({ now: JETZT })
  vi.stubGlobal('window', globalThis)
  vi.stubGlobal('localStorage', { getItem: (k: string) => SPEICHER[k] ?? null, setItem: () => {}, removeItem: () => {} })
  vi.stubGlobal('fetch', () => new Promise(() => {}))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('Kasse: Abholung nach Absprache (N47)', () => {
  it('mit Absprache-Produkt im Korb: Hinweis über der Terminwahl und „Notiz zur Abholung“', () => {
    const html = kasse(HOF, { abspracheIds: ['eier'] })
    expect(html).not.toContain('Kasse wird geladen')
    const hinweis = html.indexOf(ABSPRACHE_TEXT.kasseHinweis)
    expect(hinweis).toBeGreaterThan(html.indexOf('id="kasse-abholung"'))
    // Über der Terminwahl: vor den Kacheln der Abholzeit (Feld pickupSlotKey).
    expect(hinweis).toBeLessThan(html.indexOf('name="pickupSlotKey"'))
    expect(html).toContain(ABSPRACHE_TEXT.notizMitAbsprache)
    expect(html).not.toContain(ABSPRACHE_TEXT.notizOhneAbsprache)
    // Feld und Pflicht bleiben: derselbe Feldname, die Abholzeit weiter Pflicht.
    expect(html).toContain('name="customerNote"')
  })

  it('Gegenprobe: ohne Absprache-Produkt im Korb kein Hinweis, „Notiz an den Hof“', () => {
    for (const abspracheIds of [undefined, [], ['stroh']]) {
      const html = kasse(HOF, { abspracheIds })
      expect(html).toContain('name="pickupSlotKey"')
      expect(html).not.toContain(ABSPRACHE_TEXT.kasseHinweis)
      expect(html).toContain(ABSPRACHE_TEXT.notizOhneAbsprache)
      expect(html).not.toContain(ABSPRACHE_TEXT.notizMitAbsprache)
      expect(html).toContain('name="customerNote"')
    }
  })
})
