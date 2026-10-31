/**
 * § 8 Abs. 1 FAGG (Nr. 210, Befund aus Bericht 207): Unmittelbar bevor die
 * Kundin bestellt, stehen Ware, Gesamtpreis, Abholtermin und Vertragspartner
 * über dem Kaufknopf — im Zahlungsschritt („Jetzt bezahlen“, auch über
 * „Zahlung fortsetzen“) und im Formular („Zahlungspflichtig bestellen“ bzw.
 * „Weiter zur Zahlung“). Ein Baustein (`KaufZusammenfassung`), Beträge nur
 * angezeigt.
 *
 * Beweist:
 *  - Positionen, Gesamtpreis, Abholtermin und Hofname stehen im Markup VOR dem Knopf.
 *  - Bei sechs Positionen stehen fünf offen, die sechste klappt mit „und 1 weitere“ auf.
 *  - Unter „Jetzt bezahlen“ steht keine Fußzeile mehr (Abholung zog nach oben).
 *  - Der Gesamtbetrag der Zusammenfassung ist derselbe Wert wie auf dem Knopf (eine Quelle).
 *  - AGB- und Rücktrittssatz bleiben unter dem Knopf des Formulars, unverändert.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children?: ReactNode }) => children,
  PaymentElement: () => null,
  useStripe: () => null,
  useElements: () => null,
}))
vi.mock('@/lib/stripe-client', () => ({ getStripePromise: () => null }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }), usePathname: () => '/hof-test/checkout' }))
vi.mock('next/image', () => ({ default: (p: { src: string; alt: string }) => createElement('img', { src: p.src, alt: p.alt }) }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('@/lib/auth-client', () => ({ useSession: () => ({ data: null }), signOut: vi.fn() }))

import { KaufZusammenfassung, ZUSAMMENFASSUNG_SICHTBAR } from '@/components/checkout/kauf-zusammenfassung'
import { StripeZahlung } from '@/components/checkout/stripe-payment'
import { KassenAbschluss, ZahlungFortsetzen, type Zahlung } from '@/components/checkout/checkout-form'
import { UebersichtKarte } from '@/components/checkout/kasse-teile'
import type { AngabenHof } from '@/components/checkout/angaben-zum-hof'
import type { PublicFarm } from '@/server/queries/farm'
import { reservierungsStand } from '@/lib/kasse'

const WURZEL = join(__dirname, '..')
const lies = (datei: string): string => readFileSync(join(WURZEL, datei), 'utf8')

const JETZT = new Date('2026-10-05T08:00:00.000Z')
const BIS = new Date(JETZT.getTime() + 30 * 60_000).toISOString()
const ABHOLUNG = 'Sa, 10. Okt, 09:00–12:00 Uhr'
const HOFNAME = 'Hof Beispiel'

const position = (nr: number) => ({ productId: `p${nr}`, name: `Ware ${nr}`, quantity: nr, unit: 'STUECK', unitSize: null })
const ZWEI = [position(1), position(2)]
const SECHS = [1, 2, 3, 4, 5, 6].map(position)

/** Alle Angaben stehen vor dem Knopf — gemessen an der Stelle im Markup. */
function vorDemKnopf(html: string, knopf: string, angaben: string[]): void {
  const k = html.indexOf(knopf)
  expect(k).toBeGreaterThan(-1)
  for (const angabe of angaben) {
    const stelle = html.indexOf(angabe)
    expect(stelle, angabe).toBeGreaterThan(-1)
    expect(stelle, angabe).toBeLessThan(k)
  }
}

describe('KaufZusammenfassung', () => {
  it('zeigt Positionen mit Menge, Abholtermin und Vertragspartner', () => {
    const html = renderToStaticMarkup(createElement(KaufZusammenfassung, { positionen: ZWEI, abholung: ABHOLUNG, hofName: HOFNAME }))
    expect(html).toContain('Ware 1')
    expect(html).toContain('× 2 Stück')
    expect(html).toContain(ABHOLUNG)
    expect(html).toContain('Dein Vertragspartner:')
    expect(html).toContain(HOFNAME)
    expect(html).not.toContain('<details')
  })

  it(`bei sechs Positionen: ${ZUSAMMENFASSUNG_SICHTBAR} offen, „und 1 weitere“ klappt die sechste auf`, () => {
    const html = renderToStaticMarkup(createElement(KaufZusammenfassung, { positionen: SECHS, abholung: ABHOLUNG, hofName: HOFNAME }))
    expect(html).toContain('und 1 weitere')
    const details = html.slice(html.indexOf('<details'))
    expect(details).toContain('Ware 6')
    expect(details).not.toContain('Ware 5')
    expect(html.indexOf('Ware 5')).toBeLessThan(html.indexOf('<details'))
  })

  it('ohne gewählten Termin keine Abholzeile; ohne Gesamt keine Gesamtzeile', () => {
    const html = renderToStaticMarkup(createElement(KaufZusammenfassung, { positionen: ZWEI, abholung: null, hofName: HOFNAME }))
    expect(html).not.toContain('Abholung:')
    expect(html).not.toContain('Gesamt')
  })
})

describe('Zahlungsschritt: die Zusammenfassung unmittelbar über „Jetzt bezahlen“', () => {
  const schritt = (positionen = ZWEI): string =>
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
        zusammenfassung: createElement(KaufZusammenfassung, { positionen, abholung: ABHOLUNG, hofName: HOFNAME }),
      })
    )

  it('Positionen, Gesamtpreis, Abholtermin und Hofname stehen vor dem Knopf', () => {
    vorDemKnopf(schritt(), 'Jetzt bezahlen · € 10,82', ['Ware 1', 'Ware 2', 'Gesamt', '€ 10,82', ABHOLUNG, HOFNAME])
  })

  it('unter dem Knopf steht keine Fußzeile mehr — die Abholung zog nach oben', () => {
    const html = schritt()
    const leiste = html.slice(html.indexOf('data-unten-fest'))
    const nachKnopf = leiste.slice(leiste.indexOf('Jetzt bezahlen'))
    expect(nachKnopf).not.toContain('Abholung')
    expect(nachKnopf).not.toContain('Bezahlung sicher über Stripe')
    // Gegenprobe: Die Abholung steht genau einmal da, über dem Knopf.
    expect(html.split(ABHOLUNG)).toHaveLength(2)
  })

  it('sechs Positionen: „und 1 weitere“ vor dem Knopf', () => {
    vorDemKnopf(schritt(SECHS), 'Jetzt bezahlen', ['Ware 5', 'und 1 weitere'])
  })

  it('am Handy steht die Übersicht samt Zusammenfassung zuletzt, direkt über der festen Leiste', () => {
    const quelle = lies('src/components/checkout/stripe-payment.tsx')
    expect(quelle).toMatch(/<KassenRaster\s+uebersichtZuletzt/)
  })
})

describe('Zahlung fortsetzen (Nr. 202): derselbe Zahlungsschritt mit Zusammenfassung', () => {
  it('Positionen, Gesamtpreis, Abholtermin und Hofname stehen vor dem Knopf', () => {
    const farm = { id: 'f1', slug: 'hof-test', name: HOFNAME, address: 'Musterweg 1', postalCode: '4900', city: 'Musterdorf' } as unknown as PublicFarm
    const zahlung: Zahlung = {
      clientSecret: 'pi_test_secret',
      bestaetigung: '/hof-test/confirm/o1?sig=abc',
      reserviertBis: BIS,
      betrag: { amountCents: 1030, serviceFeeCents: 0 },
      gebuehrText: 'Servicegebühr',
      abholung: ABHOLUNG,
      name: '',
      email: 'kundin@example.com',
    }
    const html = renderToStaticMarkup(
      createElement(ZahlungFortsetzen, {
        farm,
        zahlung,
        positionen: ZWEI.map((p) => ({ ...p, price: 5 })),
        zeilenCents: { p1: 500, p2: 1000 },
        anzeige: null,
        jetztIso: JETZT.toISOString(),
      })
    )
    vorDemKnopf(html, 'Jetzt bezahlen · € 10,30', ['Gesamt', ABHOLUNG])
    // Positionen und Hof stehen auch in der Zusammenfassung vor dem Knopf, nicht nur im Korb oben.
    const zusammenfassung = html.slice(html.indexOf('data-kauf-zusammenfassung'))
    expect(zusammenfassung.indexOf('Ware 2')).toBeLessThan(zusammenfassung.indexOf('Jetzt bezahlen'))
    expect(zusammenfassung.indexOf(HOFNAME)).toBeLessThan(zusammenfassung.indexOf('Jetzt bezahlen'))
  })
})

describe('Formular: dieselben Angaben über „Zahlungspflichtig bestellen“ und „Weiter zur Zahlung“', () => {
  const HOF: AngabenHof = { name: HOFNAME, ownerName: 'Erika Muster', address: 'Musterweg 1', postalCode: '4900', city: 'Musterdorf', phone: '+43 660 0000000', email: 'hof@example.com' }
  const betraege = { warenCents: 1030, gebuehrCents: 52, gesamtCents: 1082 }
  const abschluss = (online: boolean, privat = true): string =>
    renderToStaticMarkup(
      createElement(KassenAbschluss, {
        hof: HOF,
        uebersicht: createElement(UebersichtKarte, { betraege, gebuehrText: 'Servicegebühr (5 %)' }),
        online,
        wirdGesendet: false,
        gesperrt: false,
        gesamt: '€ 10,82',
        fussnote: 'Bar am Hof',
        privat,
        zusammenfassung: createElement(KaufZusammenfassung, {
          positionen: ZWEI,
          abholung: ABHOLUNG,
          hofName: HOFNAME,
          gesamt: { betrag: '€ 10,82', zusatz: 'inkl. Servicegebühr (5 %) € 0,52' },
          karte: true,
        }),
      })
    )

  for (const [art, knopf, online] of [
    ['bar', 'Zahlungspflichtig bestellen · € 10,82', false],
    ['online', 'Weiter zur Zahlung · € 10,82', true],
  ] as const) {
    for (const privat of [true, false]) {
      it(`${art}, ${privat ? 'Privat' : 'Betrieb'}: Positionen, Gesamtpreis, Abholtermin und Hofname vor dem Knopf`, () => {
        const html = abschluss(online, privat)
        vorDemKnopf(html, knopf, ['Ware 1', 'Ware 2', ABHOLUNG, 'Dein Vertragspartner:'])
        // Die Zusammenfassung ist das Letzte vor dem Knopf — danach kommt nur noch die Leiste.
        const ab = html.slice(html.indexOf('data-kauf-zusammenfassung'))
        expect(ab.indexOf('€ 10,82')).toBeLessThan(ab.indexOf(knopf))
        expect(ab.slice(0, ab.indexOf('data-unten-fest'))).not.toContain('Angaben zum Hof')
        // AGB-Satz bleibt unter dem Knopf; der Rücktrittssatz nur bei Privat (Nr. 200).
        expect(html.indexOf('Es gelten die')).toBeGreaterThan(html.indexOf(knopf))
      })
    }
  }

  it('eine Quelle: das Formular gibt der Zusammenfassung denselben Gesamtbetrag wie dem Knopf', () => {
    const quelle = lies('src/components/checkout/checkout-form.tsx')
    // Der Knopf zeigt `gesamt`, die Zusammenfassung bekommt ihn unverändert — kein zweiter Rechenweg.
    expect(quelle).toMatch(/gesamt=\{\{ betrag: gesamt, zusatz:/)
    expect(quelle).toMatch(/const gesamt = formatEuro\(centsAlsEuro\(betraege\.gesamtCents\)\)/)
    // Alle drei Einstiege nutzen den Baustein, keiner reicht mehr eine Fußzeile an den Zahlungsschritt.
    expect(quelle.match(/<KaufZusammenfassung\b/g)?.length).toBeGreaterThanOrEqual(3)
    expect(lies('src/components/checkout/stripe-payment.tsx')).not.toMatch(/fussnote/)
  })
})
