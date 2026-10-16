/**
 * Die ganze Kasse, wie die Kundin sie bekommt (Register N10, Nr. 82; Mockups
 * web-/mobil-k3-kasse-glatt, system-k3-kasse-bezahlen-bar) — das echte
 * CheckoutForm, serverseitig gerendert.
 *
 * Auf dem Server zeigt die Kasse nur ihr Skelett: Den Korb liest sie erst im
 * Effekt aus dem localStorage. Ein Prüfstand lässt deshalb jeden Effekt der
 * eigenen Dateien EINMAL sofort beim Rendern laufen (React rendert dann mit
 * dem neuen Zustand noch einmal); localStorage, fetch und die Uhr sind
 * gestellt. Bibliotheken (react-hook-form, react-dom) behalten das echte React.
 *
 * Beweist:
 *  - Reihenfolge im DOM und damit für die Tastatur: Korb, Abholung, Deine
 *    Daten (E-Mail, Name, Telefon, Notiz), Betrieb, Bezahlen, Übersicht,
 *    Angaben zum Hof, Kaufknopf.
 *  - „Ein Korb pro Hof" und der lose Bar-Absatz unter den Zahlarten sind weg;
 *    Bar trägt seinen Vorteil an der eigenen Option.
 *  - Online ist vorbelegt, auch im Testbetrieb: Knopf, Stripe-Satz und die
 *    Zeile unter dem Knopf folgen der Zahlart des Formulars.
 *  - Bar: „entfällt", „Zahlungspflichtig bestellen", kein Stripe-Satz,
 *    „bar am Hof · Bestätigung per E-Mail".
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
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
// Stripes Zahlungsfeld braucht ein DOM; der Zahlungsschritt kommt hier nicht vor.
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children?: ReactNode }) => children,
  PaymentElement: () => null,
  useStripe: () => null,
  useElements: () => null,
}))
vi.mock('@/lib/stripe-client', () => ({ getStripePromise: () => null }))

import { CheckoutForm } from '@/components/checkout/checkout-form'
import { barGuenstiger } from '@/lib/kasse'
import { BAR_OHNE_GEBUEHR_HINWEIS, BAR_OHNE_GEBUEHR_ZAHLART } from '@/lib/konditionen'
import { ANGABEN_ZUM_HOF_TITEL } from '@/lib/stripe-konto'
import { TESTBETRIEB_TEXT } from '@/lib/stripe-modus'
import { SITZUNG_SCHLUESSEL, WARENKORB_SCHLUESSEL } from '@/lib/warenkorb-speicher'
import type { PublicFarm } from '@/server/queries/farm'

// Montag, 5. Oktober 2026, 10:00 Uhr in Wien — vor dem Bar-Stichtag (Register B1).
const JETZT = new Date('2026-10-05T08:00:00.000Z')
const STRIPE_SATZ = 'Im nächsten Schritt bezahlst du sicher über Stripe.'

const HOF: PublicFarm = {
  id: 'farm_test',
  slug: 'hof-test',
  name: 'Hof Test',
  ownerName: 'Max Mustermann',
  description: '',
  address: 'Feldweg 1',
  postalCode: '4910',
  city: 'Ried',
  phone: '+43 660 0000000',
  email: 'hof@example.com',
  logoUrl: null,
  logoAusschnitt: null,
  bannerUrl: null,
  tagline: null,
  foundedYear: null,
  aboutText: null,
  bannerType: 'GRADIENT',
  bannerValue: null,
  bannerFocusY: 50, bannerAusschnitt: null,
  sectionsConfig: [],
  farmValues: [],
  farmPhotos: [],
  acceptsOnline: true,
  acceptsOnsite: true,
  stripeAccountReady: true,
  isPaused: false,
  pauseMessage: null,
  serviceFeePercent: 5,
  serviceFeeMinCents: 50,
  serviceFeeActiveFrom: '2026-01-01T00:00:00.000Z',
  betriebsstatus: null,
  products: [],
  pickupSlots: [{ dayOfWeek: 6, startTime: '14:00', endTime: '16:00' }],
}

// Zwei Eier-Packungen à € 4,90: Warenpreis € 9,80, online mind. € 0,50 Gebühr.
const SPEICHER: Record<string, string> = {
  [SITZUNG_SCHLUESSEL]: 'sid_test',
  [WARENKORB_SCHLUESSEL]: JSON.stringify({
    farmId: 'farm_test',
    farmSlug: 'hof-test',
    items: [{ productId: 'eier', name: 'Freilandeier 10er', price: 4.9, unit: 'STUECK', unitSize: null, quantity: 2, imageUrl: null }],
  }),
}

/** Ein frischer Aufbau der Kasse — jeder Effekt läuft dafür wieder einmal. */
function kasse(hof: PublicFarm, optionen: { testbetrieb?: boolean; nurBetriebeIds?: string[] } = {}): string {
  pruefstand.gelaufen.clear()
  return renderToStaticMarkup(
    createElement(CheckoutForm, {
      farm: hof,
      nurBetriebeIds: optionen.nurBetriebeIds ?? [],
      vorbelegung: null,
      ausgebuchteAbholfenster: [],
      testbetrieb: optionen.testbetrieb,
    })
  )
}

beforeEach(() => {
  vi.useFakeTimers({ now: JETZT })
  // Die Uhr der Kasse (window.setInterval) läuft auf den gestellten Timern.
  vi.stubGlobal('window', globalThis)
  vi.stubGlobal('localStorage', { getItem: (k: string) => SPEICHER[k] ?? null, setItem: () => {}, removeItem: () => {} })
  // Die Prüfung des Korbs beim Öffnen bleibt offen — sie ändert hier nichts.
  vi.stubGlobal('fetch', () => new Promise(() => {}))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('Kasse glätten (N10): das ganze Formular', () => {
  it('Gegenprobe: der Prüfstand rendert das fertige Formular, nicht das Skelett', () => {
    const html = kasse(HOF)
    expect(html).not.toContain('Kasse wird geladen')
    expect(html).toContain('Freilandeier 10er')
  })

  it('Reihenfolge im DOM (= Tastatur): Korb, Abholung, Deine Daten, Betrieb, Bezahlen, Übersicht, Angaben zum Hof, Kaufknopf', () => {
    const html = kasse(HOF, { nurBetriebeIds: ['eier'] })
    const merkmale = [
      'id="kasse-korb"',
      'id="kasse-abholung"',
      'id="customerEmail"',
      'id="customerName"',
      'id="customerPhone"',
      'id="customerNote"',
      'id="kasse-betrieb"',
      'id="kasse-bezahlen"',
      'id="kasse-uebersicht"',
      ANGABEN_ZUM_HOF_TITEL,
      'type="submit"',
    ]
    const stellen = merkmale.map((m) => html.indexOf(m))
    for (const [i, m] of merkmale.entries()) expect(stellen[i], m).toBeGreaterThan(-1)
    expect([...stellen].sort((a, b) => a - b)).toEqual(stellen)
  })

  it('Online ist vorbelegt, auch im Testbetrieb: Knopf, Stripe-Satz und Zeile unter dem Knopf', () => {
    const html = kasse(HOF, { testbetrieb: true })
    expect(html).toContain(TESTBETRIEB_TEXT.kasse)
    expect(html).toContain('Weiter zur Zahlung · € 10,30')
    expect(html).toContain(STRIPE_SATZ)
    expect(html).toContain('Wähl noch, wann du abholst · Bezahlung sicher über Stripe')
    expect(html).not.toContain('Zahlungspflichtig bestellen')
    expect(html).not.toContain('entfällt')
  })

  it('Bar (Hof ohne Online-Zahlung): „entfällt", verbindlicher Knopf, kein Stripe-Satz, „bar am Hof"', () => {
    const html = kasse({ ...HOF, stripeAccountReady: false })
    expect(html).toContain('Zahlungspflichtig bestellen · € 9,80')
    expect(html).toContain('entfällt')
    expect(html).toContain('Wähl noch, wann du abholst · bar am Hof · Bestätigung per E-Mail')
    expect(html).toContain(BAR_OHNE_GEBUEHR_ZAHLART)
    expect(html).not.toContain(STRIPE_SATZ)
  })

  it('Hof ganz ohne angebotene Zahlart: kein „entfällt" und kein „bar am Hof" unter dem gesperrten Knopf (N10, Ergänzung Lauf 13)', () => {
    // Gegenprobe ist der Fall darüber: Mit angebotener Barzahlung steht beides da.
    const html = kasse({ ...HOF, stripeAccountReady: false, acceptsOnsite: false })
    expect(html).not.toContain('entfällt')
    expect(html).not.toContain('bar am Hof')
    expect(html).toContain('Wähl noch, wann du abholst')
  })

  it('kein „Ein Korb pro Hof" und kein loser Bar-Absatz unter den Zahlarten', () => {
    // Gegenprobe: An diesem Tag ist bar günstiger — früher stand dann der lose Absatz da.
    expect(barGuenstiger(HOF, JETZT)).toBe(true)
    for (const html of [kasse(HOF), kasse({ ...HOF, stripeAccountReady: false })]) {
      expect(html).toContain('Dein Korb bei')
      expect(html).not.toContain('Ein Korb pro Hof')
      expect(html).not.toContain(BAR_OHNE_GEBUEHR_HINWEIS)
    }
  })
})
