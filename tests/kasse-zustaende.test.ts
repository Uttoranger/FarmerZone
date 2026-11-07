/**
 * Die Kasse je Zustand nach den Boards s1-/w1-kasse (Nr. 227, Lauf 30) — und „kein ‚Servicegebühr‘ nach dem
 * Stichtag“ auf den Seiten des Kaufs.
 *
 * Beweist (echte Komponenten, serverseitig gerendert; die Reihenfolge im HTML ist die Reihenfolge im DOM):
 *  - bar und online: Recht vor Mockup — „Deine Bestellung“ (KaufZusammenfassung, Nr. 210) unmittelbar über dem
 *    Kaufknopf, die Gewährleistungs-Grafik (Nr. 211) dazwischen, AGB- und Rücktrittssatz (Nr. 215) darunter; der
 *    Kaufknopf ist grün (Register N41 f).
 *  - abgelehnt: die orange Hinweiskarte (`HinweiskarteFehler`, V17) im Bezahlen-Block, der Knopf heißt
 *    „Erneut bezahlen“, die Sätze bleiben darunter.
 *  - Mindestbestellwert: der Hinweis mit dem Satz des Hofs (A3) unter dem gesperrten Knopf, nie
 *    `MINDESTBESTELLWERT_SATZ` (der bleibt die Meldung von /api/checkout).
 *  - Betrieb: nur der AGB-Satz, keine Gewährleistungs-Grafik, kein Rücktrittssatz.
 *  - Im Hofpreis-Modell (nach dem Stichtag) steht in Kasse und Positionen der Bestätigung nirgends
 *    „Servicegebühr“; Gegenprobe: im Modell „bisher“ steht es da.
 *
 * Prüfstand wie tests/kaufknopf-saetze.test.ts (TESTING_GUIDELINES §1): `useEffect` läuft im Formular je Quelltext
 * einmal sofort (die Kasse liest den Korb im Effekt); im Zahlungsschritt setzt `useState` auf Wunsch den Zustand
 * „abgelehnt“ — dass es der richtige ist, zeigt die Karte daneben.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const pruefstand = vi.hoisted(() => ({
  gelaufen: new Set<string>(),
  effekte: false,
  abgelehnt: false,
  zahlungsZustaende: 0,
  vorbelegung: {} as Record<string, string>,
}))

vi.mock('react', async (importOriginal) => {
  const echt = await importOriginal<typeof import('react')>()
  function useEffect(effekt: () => void | (() => void)): void {
    if (!pruefstand.effekte) return
    const quelltext = effekt.toString()
    if (pruefstand.gelaufen.has(quelltext)) return
    pruefstand.gelaufen.add(quelltext)
    effekt()
  }
  function useState<S>(start: S | (() => S)): [S, (wert: S | ((alt: S) => S)) => void] {
    const paar = echt.useState(start)
    const aufrufer = new Error().stack?.split('\n')[2] ?? ''
    if (aufrufer.includes('ZahlungsInhalt')) {
      const nummer = pruefstand.zahlungsZustaende++
      if (pruefstand.abgelehnt && nummer === 1) return [true as S, paar[1]]
    }
    return paar
  }
  return { ...echt, useEffect, useState, default: { ...echt, useEffect, useState } }
})
vi.mock('react-hook-form', async (importOriginal) => {
  const echt = await importOriginal<typeof import('react-hook-form')>()
  return {
    ...echt,
    useForm: (optionen: Parameters<typeof echt.useForm>[0]) =>
      echt.useForm({ ...optionen, defaultValues: { ...(optionen?.defaultValues as object), ...pruefstand.vorbelegung } }),
  }
})
// Kein Mock auf Stripes Paket (tests/paket-mock-wache.test.ts): Ohne Stripe.js rendert die echte Hülle ihr Feld leer.
vi.mock('@/lib/stripe-client', () => ({ getStripePromise: () => null }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
  usePathname: () => '/hof-test/checkout',
  useSearchParams: () => new URLSearchParams(),
}))
// Seit Lauf 31 trägt der Kopf der Fokus-Shell im Browser die Bildmarke (next/image); der Prüfstand setzt `window`
// auf globalThis ohne `location`, an dem next/image beim Rendern liest — darum ein schlichtes <img>.
vi.mock('next/image', () => ({ default: (p: { src: string; alt: string }) => createElement('img', { src: p.src, alt: p.alt }) }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('@/lib/auth-client', () => ({ useSession: () => ({ data: null }), signOut: vi.fn() }))

import { CheckoutForm, KaufknopfSaetze } from '@/components/checkout/checkout-form'
import { StripeZahlung } from '@/components/checkout/stripe-payment'
import { KaufZusammenfassung } from '@/components/checkout/kauf-zusammenfassung'
import { BestellPositionen } from '@/components/bestaetigung/bestaetigung-teile'
import { abholKacheln, reservierungsStand, zahlungAbgelehntText } from '@/lib/kasse'
import { MINDESTBESTELLWERT_SATZ } from '@/lib/konditionen'
import { mindestbestellwertHinweis } from '@/lib/plattformgebuehr'
import { GEWAEHRLEISTUNG_MITTEILUNG } from '@/lib/rechtstexte/gewaehrleistung-mitteilung'
import { SITZUNG_SCHLUESSEL, WARENKORB_SCHLUESSEL } from '@/lib/warenkorb-speicher'
import type { PublicFarm } from '@/server/queries/farm'
import { publicFarm } from './fabrik/public-farm'

// Montag, 5. Oktober 2026, 10:00 Uhr in Wien.
const JETZT = new Date('2026-10-05T08:00:00.000Z')
const BIS = new Date(JETZT.getTime() + 30 * 60_000).toISOString()
const HOFNAME = 'Hof Beispiel'

/** Merkmale im HTML: Zusammenfassung, Grafik, AGB-Satz, Rücktrittssatz. */
const ZUSAMMENFASSUNG = 'Deine Bestellung'
const GRAFIK = `<img src="${GEWAEHRLEISTUNG_MITTEILUNG.svgPfad}"`
const AGB = 'Es gelten die'
const RUECKTRITT = 'Du kannst vom Kauf innerhalb von 14 Tagen'

/** Das öffnende Tag des Kaufknopfs (der eine `type="submit"` der Kasse). */
const kaufknopf = (html: string): string => html.match(/<button type="submit"[^>]*>/)?.[0] ?? ''

/** Die Merkmale stehen in dieser Reihenfolge, jedes genau dort. */
function inReihenfolge(html: string, merkmale: readonly string[]): void {
  const stellen = merkmale.map((m) => html.indexOf(m))
  for (const [i, m] of merkmale.entries()) expect(stellen[i], m).toBeGreaterThan(-1)
  expect([...stellen].sort((a, b) => a - b)).toEqual(stellen)
}

beforeEach(() => {
  pruefstand.gelaufen.clear()
  pruefstand.effekte = false
  pruefstand.abgelehnt = false
  pruefstand.zahlungsZustaende = 0
  pruefstand.vorbelegung = {}
})

describe('Formular: bar, online, Mindestbestellwert, Betrieb', () => {
  // Bar und online werden angeboten; ein Samstag mit Abholzeit.
  const HOF: PublicFarm = publicFarm({ name: HOFNAME, pickupSlots: [{ dayOfWeek: 6, startTime: '14:00', endTime: '16:00' }] })
  const [KACHEL] = abholKacheln(HOF.pickupSlots, JETZT, [])
  if (!KACHEL) throw new Error('Testaufbau: keine Abholkachel')

  function kasse(
    hof: PublicFarm,
    vorbelegung: Record<string, string>,
    { menge = 2, nurBetriebeIds = [] as string[], betrieb = false } = {}
  ): string {
    pruefstand.gelaufen.clear()
    pruefstand.effekte = true
    pruefstand.vorbelegung = vorbelegung
    const daten: Record<string, string> = {
      [SITZUNG_SCHLUESSEL]: 'sid_test',
      [WARENKORB_SCHLUESSEL]: JSON.stringify({
        farmId: hof.id,
        farmSlug: hof.slug,
        items: [{ productId: 'eier', name: 'Freilandeier 10er', price: 4.9, unit: 'STUECK', unitSize: null, quantity: menge, imageUrl: null }],
      }),
    }
    vi.stubGlobal('localStorage', { getItem: (k: string) => daten[k] ?? null, setItem: () => {}, removeItem: () => {} })
    return renderToStaticMarkup(
      createElement(CheckoutForm, {
        farm: hof,
        nurBetriebeIds,
        vorbelegung: betrieb ? { kaeuferArt: 'BETRIEB', betriebsnummer: 'LFBIS-TEST' } : null,
        ausgebuchteAbholfenster: [],
        sperre: null,
      })
    )
  }

  beforeEach(() => {
    vi.useFakeTimers({ now: JETZT })
    vi.stubGlobal('window', globalThis)
    vi.stubGlobal('fetch', () => new Promise(() => {}))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('bar: Zusammenfassung → Gewährleistung → „Zahlungspflichtig bestellen“ (grün) → AGB- und Rücktrittssatz', () => {
    const html = kasse(HOF, { pickupSlotKey: KACHEL.key, paymentMethod: 'ONSITE_CASH' })
    inReihenfolge(html, [ZUSAMMENFASSUNG, GRAFIK, 'Zahlungspflichtig bestellen · € 9,80', AGB, RUECKTRITT])
    expect(kaufknopf(html)).toContain('bg-accent')
    expect(kaufknopf(html)).not.toMatch(/\bdisabled=""/)
  })

  it('online: dieselbe Reihenfolge mit „Weiter zur Zahlung“', () => {
    const html = kasse(HOF, { pickupSlotKey: KACHEL.key, paymentMethod: 'ONLINE' })
    inReihenfolge(html, [ZUSAMMENFASSUNG, GRAFIK, 'Weiter zur Zahlung · € 10,30', AGB, RUECKTRITT])
    expect(kaufknopf(html)).toContain('bg-accent')
  })

  it('Board-Aufbau: Abholung, Deine Daten und Bezahlen ohne Karte, Bezahlen mit der Frage im Titel', () => {
    const html = kasse(HOF, { pickupSlotKey: KACHEL.key, paymentMethod: 'ONLINE' })
    for (const id of ['kasse-abholung', 'kasse-daten', 'kasse-bezahlen']) {
      const tag = html.match(new RegExp(`<section aria-labelledby="${id}"[^>]*>`))?.[0] ?? ''
      expect(tag, id).not.toContain('border-border bg-card')
    }
    expect(html).toContain('Bezahlen · Wie möchtest du bezahlen?')
    // Gegenprobe: Korb und Übersicht bleiben Karten (Radius 16 px fest, Lauf 31).
    expect(html.match(/<section aria-labelledby="kasse-korb"[^>]*>/)?.[0]).toContain('rounded-[16px] border border-border bg-card')
  })

  it('Mindestbestellwert (Hofpreis-Modell, Board Bild 5, Lauf 31): die Karte mit dem Satz des Hofs, „Zurück zum Angebot“ und die Übersicht — kein Formular, kein Kaufknopf', () => {
    const html = kasse({ ...HOF, preisAnzeige: { hundertstel: 600 } }, { pickupSlotKey: KACHEL.key, paymentMethod: 'ONSITE_CASH' }, { menge: 1 })
    const titel = mindestbestellwertHinweis(0, 600)
    expect(titel).toContain('Mindestbestellwert: Waren für 10 €')
    inReihenfolge(html, [titel, 'Dir fehlen noch Waren für € 5,10. Leg noch etwas dazu.', 'Zurück zum Angebot', 'Übersicht', 'Gesamt'])
    expect(html).toMatch(/<div role="status" class="[^"]*bg-zustand-tun-grund/)
    expect(html).toContain('href="/hof-test#warenkorb"')
    expect(kaufknopf(html)).toBe('')
    expect(html).not.toContain('Abholung wählen')
    expect(html).not.toContain('data-feste-leiste')
    expect(html).not.toContain(MINDESTBESTELLWERT_SATZ)
    // Gegenprobe: ab 10 € Warenwert kein Hinweis, der Knopf frei.
    const genug = kasse({ ...HOF, preisAnzeige: { hundertstel: 600 } }, { pickupSlotKey: KACHEL.key, paymentMethod: 'ONSITE_CASH' }, { menge: 3 })
    expect(genug).not.toContain('Dir fehlen noch Waren')
    expect(kaufknopf(genug)).not.toMatch(/\bdisabled=""/)
  })

  it('Betrieb: nur der AGB-Satz — keine Gewährleistungs-Grafik, kein Rücktrittssatz', () => {
    const html = kasse(HOF, { pickupSlotKey: KACHEL.key, paymentMethod: 'ONSITE_CASH' }, { nurBetriebeIds: ['eier'], betrieb: true })
    expect(html).toContain('id="kasse-betrieb"')
    inReihenfolge(html, [ZUSAMMENFASSUNG, 'Zahlungspflichtig bestellen', AGB])
    expect(html).not.toContain(RUECKTRITT)
    expect(html).not.toContain(GRAFIK)
    // Gegenprobe: dieselbe Kasse privat trägt beides.
    const privat = kasse(HOF, { pickupSlotKey: KACHEL.key, paymentMethod: 'ONSITE_CASH' }, { nurBetriebeIds: ['eier'] })
    expect(privat).toContain(RUECKTRITT)
    expect(privat).toContain(GRAFIK)
  })

  it('nach dem Stichtag (Hofpreis-Modell) steht in der Kasse nirgends „Servicegebühr“ — Gegenprobe: bisher schon', () => {
    const nachher = kasse({ ...HOF, preisAnzeige: { hundertstel: 600 } }, { pickupSlotKey: KACHEL.key, paymentMethod: 'ONLINE' }, { menge: 3 })
    expect(nachher).toContain('Plattformgebühr')
    expect(nachher).not.toContain('Servicegebühr')
    const vorher = kasse(HOF, { pickupSlotKey: KACHEL.key, paymentMethod: 'ONLINE' }, { menge: 3 })
    expect(vorher).toContain('Servicegebühr')
  })
})

describe('Zahlungsschritt: Zahlung abgelehnt', () => {
  const schritt = (): string => {
    pruefstand.zahlungsZustaende = 0
    return renderToStaticMarkup(
      createElement(StripeZahlung, {
        clientSecret: 'pi_test_secret',
        bestaetigung: '/hof-test/confirm/o1?sig=abc',
        farmSlug: 'hof-test',
        reserviertBis: BIS,
        stand: reservierungsStand(BIS, JETZT),
        betrag: { amountCents: 1082, serviceFeeCents: 52 },
        gebuehrText: 'Servicegebühr',
        korb: null,
        angaben: null,
        zusammenfassung: createElement(KaufZusammenfassung, {
          positionen: [{ productId: 'p1', name: 'Ware 1', quantity: 1, unit: 'STUECK', unitSize: null }],
          abholung: 'Sa, 10. Okt, 09:00–12:00 Uhr',
          hofName: HOFNAME,
        }),
        privat: true,
        kaufknopfSaetze: createElement(KaufknopfSaetze, { privat: true, hofpreis: false, agbPfad: '/agb' }),
      })
    )
  }

  it('die orange Hinweiskarte steht im Bezahlen-Block, der Knopf heißt „Erneut bezahlen“, die Sätze bleiben darunter', () => {
    pruefstand.abgelehnt = true
    const html = schritt()
    const karte = html.indexOf('data-slot="hinweiskarte-fehler"')
    expect(karte).toBeGreaterThan(html.indexOf('id="kasse-bezahlen"'))
    expect(html.slice(karte - 200, karte)).toContain('role="alert"')
    expect(html).toContain(zahlungAbgelehntText(null).titel)
    inReihenfolge(html, [ZUSAMMENFASSUNG, GRAFIK, 'Erneut bezahlen · € 10,82', AGB, RUECKTRITT])
  })

  it('Gegenprobe: ohne Ablehnung keine Karte und „Jetzt bezahlen“', () => {
    const html = schritt()
    expect(html).not.toContain('data-slot="hinweiskarte-fehler"')
    expect(html).toContain('Jetzt bezahlen · € 10,82')
  })
})

describe('Positionen auf Bestätigung und Bestellseite: kein „Servicegebühr“ nach dem Stichtag', () => {
  const positionen = (gebuehrModell: string | null): string =>
    renderToStaticMarkup(
      createElement(BestellPositionen, {
        positionen: [{ text: 'Freilandeier · 2 Stück', betragCents: 980 }],
        summen: { totalAmount: '9.80', serviceFeeCents: 60, serviceFeeRefundedAt: null, paymentMethod: 'ONLINE', gebuehrModell },
        zahlung: 'Online · Bezahlt',
      })
    )

  it('Hofpreis-Modell: „Plattformgebühr“, nie „Servicegebühr“', () => {
    const html = positionen('hofpreis')
    expect(html).toContain('Plattformgebühr')
    expect(html).not.toContain('Servicegebühr')
  })

  it('Gegenprobe: eine Bestellung im Modell „bisher“ behält „Servicegebühr“', () => {
    expect(positionen(null)).toContain('Servicegebühr')
  })
})

describe('Positionen: Zahlzeile wie in den Boards (UI-Runde 3, nur Anzeige derselben Werte)', () => {
  const summen = { totalAmount: '9.80', serviceFeeCents: 60, serviceFeeRefundedAt: null as Date | null, paymentMethod: 'ONLINE', gebuehrModell: 'hofpreis' }
  const positionen = (teil: { summeInZahlzeile?: boolean; serviceFeeRefundedAt?: Date | null } = {}): string =>
    renderToStaticMarkup(
      createElement(BestellPositionen, {
        positionen: [{ text: '2 × Freilandeier', betragCents: 980 }],
        summen: { ...summen, serviceFeeRefundedAt: teil.serviceFeeRefundedAt ?? null },
        zahlung: 'Online · Bezahlt',
        summeInZahlzeile: teil.summeInZahlzeile,
      })
    ).replace(/<!-- -->/g, '')

  it('Bestätigung (s1-/w1-bestaetigung): „Gesamt“ fett, darunter „Zahlung · inkl. Plattformgebühr“', () => {
    const html = positionen()
    expect(html).toMatch(/Gesamt <span[^>]*>€\s10,40<\/span>/)
    expect(html).toContain('>Online · Bezahlt · inkl. Plattformgebühr</p>')
  })

  it('Bestellseite (s1-/w1-bestellung-link Bild 1): kein eigenes „Gesamt“, derselbe Betrag in der Zahlzeile', () => {
    const html = positionen({ summeInZahlzeile: true })
    expect(html).not.toContain('Gesamt')
    expect(html).toMatch(/>Online · Bezahlt · €\s10,40 inkl\. Plattformgebühr<\/p>/)
    // Die Gebühr bleibt eine eigene Zeile (N38).
    expect(html).toMatch(/Plattformgebühr · <span[^>]*>€\s0,60<\/span>/)
  })

  it('Gegenprobe: entfallene Gebühr — kein „inkl.“, die eigene Zeile sagt es', () => {
    const html = positionen({ summeInZahlzeile: true, serviceFeeRefundedAt: new Date('2026-11-01T10:00:00Z') })
    expect(html).not.toContain('inkl.')
    expect(html).toContain('(erstattet)')
  })
})
