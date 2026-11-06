/**
 * Die Gewährleistungs-Mitteilung (§ 4 Abs. 1 Z 12 und Anhang II FAGG, Nr. 211)
 * in der Kasse — in beiden Schritten, nur bei Verbraucherinnen.
 *
 * Beweist (echte Komponenten, serverseitig gerendert):
 *  - Formular (`KassenAbschluss`, bar „Zahlungspflichtig bestellen“ und online
 *    „Weiter zur Zahlung“) und Zahlungsschritt (`StripeZahlung`, „Jetzt
 *    bezahlen“, auch über „Zahlung fortsetzen“): bei Privat genau EIN Bild mit
 *    dem Alt-Text der Quelle und der Überschrift, zwischen Zusammenfassung und
 *    Knopf, im Fluss und nicht in der festen Leiste;
 *  - bei „Betrieb“ kein Bild und keine Überschrift (Gegenprobe: die
 *    Zusammenfassung steht weiter da);
 *  - das Bild ist die amtliche SVG mit Maßen, ohne `loading="lazy"`, ohne
 *    Filter, nicht über `next/image`;
 *  - Zahlungsschritt: ein Zahlungsfehler steht weiter direkt am Knopf, nach
 *    der Grafik (Gegenprobe zum Satz im Kommentar);
 *  - die Käuferart erreicht den Zahlungsschritt auf allen Einstiegen
 *    (Formular, „Zahlung fortsetzen“ aus der Bestellung).
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// Kein Mock auf Stripes Paket (tests/paket-mock-wache.test.ts): Ohne Stripe.js (stripe = null) rendert die
// echte Hülle ihr Zahlungsfeld leer, der Knopf ist aus — Zusammenfassung und Grafik darüber stehen trotzdem.
vi.mock('@/lib/stripe-client', () => ({ getStripePromise: () => null }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => '/hof-test/checkout' }))
// next/image als erkennbare Attrappe: Liefe die Grafik darüber, stünde data-next-image im HTML.
vi.mock('next/image', () => ({ default: (p: { src: string; alt: string }) => createElement('img', { src: p.src, alt: p.alt, 'data-next-image': '' }) }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('@/lib/auth-client', () => ({ useSession: () => ({ data: null }), signOut: vi.fn() }))

import { KaufZusammenfassung } from '@/components/checkout/kauf-zusammenfassung'
import { StripeZahlung } from '@/components/checkout/stripe-payment'
import { KassenAbschluss, KaufknopfSaetze, ZahlungFortsetzen, type Zahlung } from '@/components/checkout/checkout-form'
import { UebersichtKarte } from '@/components/checkout/kasse-teile'
import type { AngabenHof } from '@/components/checkout/angaben-zum-hof'
import { GEWAEHRLEISTUNG_MITTEILUNG as G } from '@/lib/rechtstexte/gewaehrleistung-mitteilung'
import { reservierungsStand } from '@/lib/kasse'
import { publicFarm } from './fabrik/public-farm'

const WURZEL = join(__dirname, '..')
const lies = (datei: string): string => readFileSync(join(WURZEL, datei), 'utf8')

const JETZT = new Date('2026-10-05T08:00:00.000Z')
const BIS = new Date(JETZT.getTime() + 30 * 60_000).toISOString()
const ABHOLUNG = 'Sa, 10. Okt, 09:00–12:00 Uhr'
const HOFNAME = 'Hof Beispiel'
const POSITIONEN = [{ productId: 'p1', name: 'Ware 1', quantity: 1, unit: 'STUECK', unitSize: null }]

/** Wie oft ein Text im Markup steht. */
const anzahl = (html: string, text: string): number => html.split(text).length - 1

/** Die Bilder der Grafik (am Pfad der Quelle erkannt). */
const bilder = (html: string): string[] => [...html.matchAll(/<img\b[^>]*>/g)].map((t) => t[0]).filter((tag) => tag.includes(G.svgPfad))

/** React schreibt Text und Attribute maskiert: Apostroph, Anführungszeichen, & und spitze Klammern. */
const maskiert = (text: string): string => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')

/** Bei Privat: genau ein Bild mit Alt-Text, Maßen und Überschrift — nach der Zusammenfassung, vor dem Knopf, nicht in der festen Leiste. */
function einmalVorDemKnopf(html: string, knopf: string): void {
  const [bild, ...mehr] = bilder(html)
  expect(mehr).toEqual([])
  expect(bild).toBeDefined()
  expect(bild).toContain(`alt="${maskiert(G.altText)}"`)
  expect(bild).toContain(`width="${G.breite}"`)
  expect(bild).toContain(`height="${G.hoehe}"`)
  expect(bild).not.toMatch(/loading=|filter|grayscale|invert|brightness|data-next-image/)
  // Die Überschrift als Text genau einmal (dazu der Name des Abschnitts im aria-label).
  expect(anzahl(html, `>${G.ueberschrift}<`)).toBe(1)

  // Gemessen am <img> selbst: React setzt für ein Bild ohne loading="lazy" zusätzlich ein <link rel="preload"> an den Anfang.
  const stelle = html.indexOf(bild ?? '<img')
  expect(html.indexOf('data-kauf-zusammenfassung')).toBeLessThan(stelle)
  expect(stelle).toBeLessThan(html.indexOf(knopf))
  // Die feste Leiste am Handy beginnt erst nach der Grafik — sie trägt nur Knopf und Sätze.
  expect(stelle).toBeLessThan(html.indexOf('data-unten-fest'))
  expect(html.indexOf(`>${G.ueberschrift}<`)).toBeLessThan(stelle)
}

/** Bei „Betrieb“: keine Grafik, keine Überschrift — die Zusammenfassung bleibt (Gegenprobe gegen ein leeres Rendern). */
function ohneGrafik(html: string, knopf: string): void {
  expect(bilder(html)).toEqual([])
  expect(html).not.toContain(G.ueberschrift)
  expect(html).not.toContain(maskiert(G.altText))
  expect(html).toContain('data-kauf-zusammenfassung')
  expect(html).toContain(knopf)
}

describe('Formular: über „Zahlungspflichtig bestellen“ und „Weiter zur Zahlung“', () => {
  const HOF: AngabenHof = { name: HOFNAME, ownerName: 'Erika Muster', address: 'Musterweg 1', postalCode: '4900', city: 'Musterdorf', phone: '+43 660 0000000', email: 'hof@example.com' }
  const abschluss = (online: boolean, privat: boolean): string =>
    renderToStaticMarkup(
      createElement(KassenAbschluss, {
        hof: HOF,
        uebersicht: createElement(UebersichtKarte, { betraege: { warenCents: 1030, gebuehrCents: 52, gesamtCents: 1082 }, gebuehrText: 'Servicegebühr (5 %)' }),
        online,
        wirdGesendet: false,
        gesperrt: false,
        gesamt: '€ 10,82',
        fussnote: '',
        privat,
        zusammenfassung: createElement(KaufZusammenfassung, { karte: true, positionen: POSITIONEN, abholung: ABHOLUNG, hofName: HOFNAME, gesamt: { betrag: '€ 10,82' } }),
      })
    )

  for (const [art, knopf, online] of [
    ['bar', 'Zahlungspflichtig bestellen · € 10,82', false],
    ['online', 'Weiter zur Zahlung · € 10,82', true],
  ] as const) {
    it(`${art}, Privat: die Grafik genau einmal zwischen Zusammenfassung und Knopf`, () => {
      einmalVorDemKnopf(abschluss(online, true), knopf)
    })

    it(`${art}, Betrieb: keine Grafik`, () => {
      ohneGrafik(abschluss(online, false), knopf)
    })
  }
})

describe('Zahlungsschritt: über „Jetzt bezahlen“', () => {
  const schritt = (privat: boolean): string =>
    renderToStaticMarkup(
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
        zusammenfassung: createElement(KaufZusammenfassung, { positionen: POSITIONEN, abholung: ABHOLUNG, hofName: HOFNAME }),
        privat,
        kaufknopfSaetze: createElement(KaufknopfSaetze, { privat, hofpreis: false, agbPfad: '/agb' }),
      })
    )

  it('Privat: die Grafik genau einmal zwischen Zusammenfassung und Knopf', () => {
    einmalVorDemKnopf(schritt(true), 'Jetzt bezahlen · € 10,82')
  })

  it('Betrieb: keine Grafik', () => {
    ohneGrafik(schritt(false), 'Jetzt bezahlen · € 10,82')
  })

  it('ein Zahlungsfehler steht nach der Grafik, direkt vor der Leiste mit dem Knopf (Reihenfolge im Quelltext)', () => {
    // Der Fehler entsteht erst nach dem Klick (Zustand) — auf dem Server nicht renderbar, also an der Reihenfolge im JSX.
    const quelle = lies('src/components/checkout/stripe-payment.tsx')
    const grafik = quelle.indexOf('{privat && <GewaehrleistungsMitteilung />}')
    const fehler = quelle.indexOf('{fehler && (', grafik)
    const leiste = quelle.indexOf('<AktionsLeiste>', grafik)
    expect(grafik).toBeGreaterThan(quelle.indexOf('{zusammenfassung}'))
    expect(fehler).toBeGreaterThan(grafik)
    expect(leiste).toBeGreaterThan(fehler)
  })

  it('beide Aufrufe des Zahlungsschritts im Formular geben die Käuferart weiter', () => {
    const quelle = lies('src/components/checkout/checkout-form.tsx')
    // Ein Aufruf endet mit der eigenen Zeile „/>“ — die Kinder darin (<KorbKarte … />) schließen auf derselben Zeile.
    const aufrufe = quelle.split('<StripeZahlung').slice(1).map((teil) => teil.slice(0, teil.search(/\n\s*\/>/)))
    expect(aufrufe).toHaveLength(2)
    for (const aufruf of aufrufe) expect(aufruf).toContain('privat={privat}')
  })
})

describe('Zahlung fortsetzen (Nr. 202): die Käuferart der Bestellung entscheidet', () => {
  const farm = publicFarm({ name: HOFNAME })
  const zahlung: Zahlung = {
    clientSecret: 'pi_test_secret',
    bestaetigung: '/hof-test/confirm/o1?sig=abc',
    reserviertBis: BIS,
    betrag: { amountCents: 500, serviceFeeCents: 0 },
    gebuehrText: 'Servicegebühr',
    abholung: ABHOLUNG,
    name: '',
    email: 'kundin@example.com',
  }
  const fortsetzen = (privat: boolean): string =>
    renderToStaticMarkup(
      createElement(ZahlungFortsetzen, {
        farm,
        zahlung,
        positionen: POSITIONEN.map((p) => ({ ...p, price: 5 })),
        zeilenCents: { p1: 500 },
        anzeige: null,
        jetztIso: JETZT.toISOString(),
        privat,
      })
    )

  it('Privat: die Grafik genau einmal vor dem Knopf', () => {
    einmalVorDemKnopf(fortsetzen(true), 'Jetzt bezahlen · € 5,00')
  })

  it('Betrieb: keine Grafik', () => {
    ohneGrafik(fortsetzen(false), 'Jetzt bezahlen · € 5,00')
  })

  it('die Seite liest die Käuferart aus der Bestellung und reicht nur ein privat weiter', () => {
    const seite = lies('src/app/(public)/[farmSlug]/checkout/page.tsx')
    expect(seite).toMatch(/privat: order\.kaeuferArt === 'PRIVAT'/)
    expect(seite).toMatch(/privat=\{fortsetzung\.privat\}/)
  })
})
