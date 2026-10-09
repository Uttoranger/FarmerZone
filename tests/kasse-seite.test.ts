/**
 * Die Kasse im neuen Design (Nachtlauf Nr. 12, Mockups web-k3-warenkorb-bezahlen,
 * web-k3-zahlung-abgelehnt, mobil-k3-*) — Bausteine serverseitig gerendert,
 * dazu Wachen am Quelltext. Verhalten steckt in src/lib/kasse.ts
 * (tests/kasse.test.ts); hier steht, was die Kundin zu sehen bekommt.
 *
 * Beweist:
 *  - E5: Die Zahlart-Wahl bietet „Karte bei Abholung" nicht an; das Formular-
 *    Schema lehnt ONSITE_CARD ab. Alte Bestellungen mit ONSITE_CARD werden
 *    weiter benannt (Bestellseiten, Hofbereich).
 *  - Die Übersicht zeigt die Servicegebühr als eigene Zeile mit genau dem
 *    Betrag aus kassenBetraege; ohne Gebühr gibt es die Zeile nicht.
 *  - Die Reservierungsfrist steht als Uhrzeit und Restzeit da; abgelaufen sagt
 *    die Kasse, was passiert, und bietet den Weg zurück.
 *  - „Zahlung abgelehnt" sagt „Es wurde nichts abgebucht".
 *  - E8: kein Satz zu einem Konto, kein Link zu /account in der Kasse.
 *  - Beide Themes: nur Tokens, keine Farbliterale, kein bg-white/black.
 *  - Nachbesserung 1: Der Zahlungsschritt zeigt auf Knopf und Übersicht den
 *    Betrag, den /api/checkout an Stripe gab — er bekommt weder Hofeinstellung
 *    noch Uhr und rechnet nicht selbst; die Kasse reicht `zahlung.betrag` durch.
 *    Die Rückleitung „bezahlt" baut die Adresse über bestaetigungMitStatus.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// Stripes Zahlungsfeld läuft im iframe und braucht ein DOM — hier nur Hülle,
// damit der Zahlungsschritt selbst serverseitig rendert.
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children?: ReactNode }) => children,
  PaymentElement: () => null,
  useStripe: () => null,
  useElements: () => null,
}))
vi.mock('@/lib/stripe-client', () => ({ getStripePromise: () => null }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))

import {
  AbholWahl,
  KontaktHinweis,
  ReservierungsHinweis,
  UebersichtKarte,
  ZahlartWahl,
  ZahlungAbgelehnt,
} from '@/components/checkout/kasse-teile'
import { abholKacheln, gebuehrBezeichnung, kassenBetraege, kassenZahlarten, reservierungsStand } from '@/lib/kasse'
import { StripeZahlung } from '@/components/checkout/stripe-payment'
import { checkoutFormSchema, checkoutRequestSchema } from '@/schemas/checkout'
import { paymentLabel } from '@/components/orders/order-status'
import { zahlungsAnzeige } from '@/lib/bestellstatus'

const WURZEL = join(__dirname, '..')
const lies = (datei: string): string => readFileSync(join(WURZEL, datei), 'utf8')

const JETZT = new Date('2026-10-05T08:00:00.000Z')
const GEBUEHR_5 = { serviceFeePercent: 5, serviceFeeMinCents: 50, serviceFeeActiveFrom: '2026-01-01T00:00:00.000Z' }
const FELD = { name: 'paymentMethod' as const, onChange: async () => {}, onBlur: async () => {}, ref: () => {} }

const KASSE_DATEIEN = [
  'src/components/checkout/checkout-form.tsx',
  'src/components/checkout/stripe-payment.tsx',
  'src/components/checkout/kasse-teile.tsx',
  'src/components/checkout/kasse-skelett.tsx',
  'src/lib/kasse.ts',
  'src/app/(public)/[farmSlug]/checkout/page.tsx',
  'src/app/(public)/[farmSlug]/checkout/loading.tsx',
]

describe('E5: keine Karte bei Abholung für neue Bestellungen', () => {
  it('die Zahlart-Wahl bietet online und bar an, nie ONSITE_CARD', () => {
    const html = renderToStaticMarkup(
      createElement(ZahlartWahl, { zahlarten: kassenZahlarten({ acceptsOnline: true, stripeAccountReady: true, acceptsOnsite: true }), feld: FELD })
    )
    // Gegenprobe: Die Wahl rendert ihre Optionen wirklich.
    expect(html).toContain('value="ONLINE"')
    expect(html).toContain('value="ONSITE_CASH"')
    expect(html).toContain('Bar bei Abholung')
    expect(html).not.toContain('ONSITE_CARD')
    expect(html).not.toContain('Karte bei Abholung')
  })

  it('das Formular kennt ONSITE_CARD nicht mehr — weder im Quelltext noch im Schema', () => {
    expect(lies('src/components/checkout/checkout-form.tsx')).not.toMatch(/ONSITE_CARD|Karte bei Abholung/)
    const basis = {
      customerName: 'Max Mustermann',
      customerEmail: 'max@example.org',
      customerPhone: '+43 660 0000000',
      pickupSlotKey: '2026-10-06|09:00|12:00',
      onsiteConfirmed: true,
    }
    expect(checkoutFormSchema.safeParse({ ...basis, paymentMethod: 'ONSITE_CARD' }).success).toBe(false)
    expect(checkoutFormSchema.safeParse({ ...basis, paymentMethod: 'ONSITE_CASH' }).success).toBe(true)
    expect(checkoutFormSchema.safeParse({ ...basis, paymentMethod: 'ONLINE' }).success).toBe(true)
  })

  it('bar braucht keinen Haken mehr — verbindlich ist der Knopf (Register N2, Nr. 46)', () => {
    const bar = {
      customerName: 'Max Mustermann',
      customerEmail: 'max@example.org',
      customerPhone: '+43 660 0000000',
      pickupSlotKey: '2026-10-06|09:00|12:00',
      paymentMethod: 'ONSITE_CASH',
    }
    expect(checkoutFormSchema.safeParse(bar).success).toBe(true)
    // Ein alter Stand, der die Felder noch kennt, scheitert nicht — und sie kommen nicht durch.
    const alt = checkoutFormSchema.safeParse({ ...bar, onsiteConfirmed: false, optInEmail: true, optInWhatsApp: true })
    expect(alt.success).toBe(true)
    expect(alt.data).not.toHaveProperty('onsiteConfirmed')
    expect(alt.data).not.toHaveProperty('optInEmail')
    expect(alt.data).not.toHaveProperty('optInWhatsApp')
  })

  it('die Anfrage an den Server verwirft Haken- und Abo-Felder still — ein alter Tab bestellt weiter', () => {
    const anfrage = {
      farmId: 'farm_1',
      farmSlug: 'hof-test',
      sessionId: 'sid_1',
      customerName: 'Max Mustermann',
      customerEmail: 'max@example.org',
      customerPhone: '+43 660 0000000',
      pickupDate: '2026-10-06',
      pickupTimeStart: '09:00',
      pickupTimeEnd: '12:00',
      paymentMethod: 'ONSITE_CASH',
      items: [{ productId: 'eier', quantity: 1, unitPrice: 4.5 }],
    }
    const r = checkoutRequestSchema.safeParse({ ...anfrage, onsiteConfirmed: true, optInEmail: true, optInWhatsApp: true })
    expect(r.success).toBe(true)
    expect(Object.keys(r.data ?? {})).not.toEqual(expect.arrayContaining(['onsiteConfirmed']))
    expect(r.data).not.toHaveProperty('optInEmail')
    expect(r.data).not.toHaveProperty('optInWhatsApp')
  })

  it('die Kasse zeigt keinen Pflicht-Haken und keine Neuigkeiten mehr; der Kaufknopf bleibt „Zahlungspflichtig bestellen"', () => {
    const form = lies('src/components/checkout/checkout-form.tsx')
    expect(form).not.toMatch(/onsiteConfirmed|optInEmail|optInWhatsApp|Neuigkeiten vom Hof|zahle vor Ort bar/)
    expect(form).toContain('`Zahlungspflichtig bestellen · ${gesamt}`')
    // Gegenprobe: die Suche erkennt den alten Haken.
    expect("{...form.register('onsiteConfirmed')}").toMatch(/onsiteConfirmed|optInEmail|optInWhatsApp|Neuigkeiten vom Hof|zahle vor Ort bar/)
  })

  it('die Anfrage an den Server lässt den Wert in der Form zu — ob neu oder alt, entscheidet die Route nach der Idempotenz', () => {
    expect(checkoutRequestSchema.shape.paymentMethod.safeParse('ONSITE_CARD').success).toBe(true)
  })

  it('alte Bestellungen mit Karte bei Abholung werden weiter benannt', () => {
    expect(paymentLabel('ONSITE_CARD')).toBe('Karte bei Abholung')
    expect(zahlungsAnzeige('ONSITE_CARD', 'PENDING').art).toBe('Karte bei Abholung')
  })
})

describe('Übersicht: Servicegebühr als eigene Zeile', () => {
  const korb = [
    { productId: 'eier', price: 4.5, quantity: 1 },
    { productId: 'brot', price: 5.8, quantity: 1 },
  ]

  it('zeigt Warenpreis, Gebühr mit Satz und Gesamt aus kassenBetraege (Mockup: € 10,30 + € 0,52 = € 10,82)', () => {
    const betraege = kassenBetraege(korb, GEBUEHR_5, JETZT, 'ONLINE')
    const html = renderToStaticMarkup(
      createElement(UebersichtKarte, { betraege, gebuehrText: gebuehrBezeichnung(GEBUEHR_5, JETZT) }, createElement('button', null, 'Jetzt bestellen'))
    )
    expect(html).toContain('Warenpreis')
    expect(html).toContain('€ 10,30')
    expect(html).toContain('Servicegebühr · 5 %, mind. € 0,50')
    expect(html).toContain('€ 0,52')
    expect(html).toContain('€ 10,82')
    expect(html).toContain('Jetzt bestellen')
  })

  it('ohne Gebühr keine Gebührenzeile', () => {
    const frei = { ...GEBUEHR_5, serviceFeeActiveFrom: null }
    const html = renderToStaticMarkup(
      createElement(UebersichtKarte, { betraege: kassenBetraege(korb, frei, JETZT, 'ONLINE'), gebuehrText: gebuehrBezeichnung(frei, JETZT) })
    )
    expect(html).not.toContain('Servicegebühr')
    expect(html).toContain('€ 10,30')
  })
})

describe('Reservierungsfrist sichtbar', () => {
  it('läuft: Uhrzeit und Restzeit', () => {
    const html = renderToStaticMarkup(
      createElement(ReservierungsHinweis, { stand: reservierungsStand('2026-10-05T08:12:00.000Z', JETZT), schritt: 'formular' })
    )
    expect(html).toContain('Deine Ware ist bis')
    expect(html).toContain('10:12 Uhr')
    expect(html).toContain('noch 12 Minuten')
  })

  it('abgelaufen vor dem Bestellen: sagt, was passiert, und bietet die neue Prüfung an', () => {
    const html = renderToStaticMarkup(
      createElement(ReservierungsHinweis, { stand: { zustand: 'abgelaufen' }, schritt: 'formular', onNeuPruefen: () => {} })
    )
    expect(html).toContain('Deine Reservierung ist abgelaufen')
    expect(html).toContain('Verfügbarkeit neu prüfen')
  })

  it('abgelaufen beim Bezahlen: nichts abgebucht, zurück zum Hof', () => {
    const html = renderToStaticMarkup(
      createElement(ReservierungsHinweis, { stand: { zustand: 'abgelaufen' }, schritt: 'zahlung', farmSlug: 'hof-test' })
    )
    expect(html).toContain('es wurde nichts abgebucht')
    expect(html).toContain('href="/hof-test"')
  })

  it('ohne bekannte Frist: nichts', () => {
    expect(renderToStaticMarkup(createElement(ReservierungsHinweis, { stand: { zustand: 'unbekannt' }, schritt: 'formular' }))).toBe('')
  })
})

describe('Nachbesserung 1: der Zahlungsschritt zeigt den Betrag des Servers', () => {
  const korb = [
    { productId: 'eier', price: 4.5, quantity: 1 },
    { productId: 'brot', price: 5.8, quantity: 1 },
  ]
  // Die Gebühr gilt erst eine Minute nach JETZT — die Bestellung entstand
  // gebührenfrei; eine Uhr-Runde später rechnet die Kasse € 0,52 dazu.
  const GEBUEHR_AB_GLEICH = { ...GEBUEHR_5, serviceFeeActiveFrom: new Date(JETZT.getTime() + 60_000).toISOString() }
  const SPAETER = new Date(JETZT.getTime() + 75_000)

  function zahlungsschritt(betrag: { amountCents: number; serviceFeeCents: number }): string {
    return renderToStaticMarkup(
      createElement(StripeZahlung, {
        clientSecret: 'pi_test_secret',
        bestaetigung: '/hof-test/confirm/o1?sig=abc',
        farmSlug: 'hof-test',
        reserviertBis: new Date(JETZT.getTime() + 30 * 60_000).toISOString(),
        stand: reservierungsStand(new Date(JETZT.getTime() + 30 * 60_000).toISOString(), SPAETER),
        betrag,
        gebuehrText: 'Servicegebühr',
        korb: null,
        angaben: null,
        fussnote: 'Bezahlung sicher über Stripe',
      })
    )
  }

  it('Knopf und Übersicht zeigen den Stripe-Betrag, auch wenn die lokale Rechnung inzwischen höher ist', () => {
    // Gegenprobe: Die lokale Rechnung ist wirklich gewandert (€ 10,30 → € 10,82).
    expect(kassenBetraege(korb, GEBUEHR_AB_GLEICH, JETZT, 'ONLINE').gesamtCents).toBe(1030)
    expect(kassenBetraege(korb, GEBUEHR_AB_GLEICH, SPAETER, 'ONLINE').gesamtCents).toBe(1082)

    const html = zahlungsschritt({ amountCents: 1030, serviceFeeCents: 0 })

    expect(html).toContain('Jetzt bezahlen · € 10,30')
    expect(html).not.toContain('€ 10,82')
    expect(html).not.toContain('€ 0,52')
  })

  it('Gegenprobe: mit Gebühr im Server-Betrag steht sie als Zeile da', () => {
    const html = zahlungsschritt({ amountCents: 1082, serviceFeeCents: 52 })

    expect(html).toContain('Jetzt bezahlen · € 10,82')
    expect(html).toContain('€ 10,30')
    expect(html).toContain('€ 0,52')
  })

  it('der Zahlungsschritt kennt weder Hofeinstellung noch Uhr für den Betrag, die Kasse reicht den Server-Betrag durch', () => {
    const zahlung = lies('src/components/checkout/stripe-payment.tsx')
    expect(zahlung).not.toMatch(/kassenBetraege|gebuehrBezeichnung|berechneServicegebuehr/)
    expect(zahlung).toMatch(/zahlungsBetraege\(betrag\)/)
    const kasse = lies('src/components/checkout/checkout-form.tsx')
    expect(kasse).toMatch(/betrag=\{zahlung\.betrag\}/)
    expect(kasse).toMatch(/checkoutZahlungsBetragSchema\.safeParse\(/)
    const alteUebergabe = /<StripeZahlung[^<]*betraege=\{betraege\}/
    // Gegenprobe: Das Muster findet die alte Übergabe (Stand vor der Nachbesserung).
    expect('<StripeZahlung\n        stand={stand}\n        betraege={betraege}\n        korb={<KorbKarte />}').toMatch(alteUebergabe)
    expect(kasse).not.toMatch(alteUebergabe)
  })

  it('die Rückleitung „bezahlt" baut die Adresse über bestaetigungMitStatus, nie mit angehängtem „&"', () => {
    const zahlung = lies('src/components/checkout/stripe-payment.tsx')
    expect(zahlung).toMatch(/bestaetigungMitStatus\(/)
    expect(zahlung).not.toMatch(/\}&redirect_status=/)
    // Gegenprobe: Das Muster findet die alte Schreibweise.
    expect('`${bestaetigung}&redirect_status=x`').toMatch(/\}&redirect_status=/)
  })
})

describe('Zahlung abgelehnt', () => {
  it('sagt „Es wurde nichts abgebucht" und bis wann die Ware wartet', () => {
    const html = renderToStaticMarkup(createElement(ZahlungAbgelehnt, { bisUhrzeit: '14:32' }))
    expect(html).toContain('Deine Karte wurde abgelehnt')
    expect(html).toContain('Es wurde nichts abgebucht.')
    expect(html).toContain('14:32 Uhr')
    expect(html).toContain('role="alert"')
  })

  it('der Zahlungsschritt zeigt den Zustand nur über zahlungsFehlerArt', () => {
    const text = lies('src/components/checkout/stripe-payment.tsx')
    expect(text).toMatch(/zahlungsFehlerArt\(/)
    expect(text).toMatch(/<ZahlungAbgelehnt\b/)
  })
})

describe('E8: kein Kontosatz in der Kasse', () => {
  const KONTO = /Konto|Passwort|meldest du dich|\/account/i

  it('Gegenprobe: das Muster findet den Kontosatz des Mockups', () => {
    expect(lies('docs/mockups/web-k3-warenkorb-bezahlen.html')).toMatch(/meldest du dich/)
  })

  it('keine Datei der Kasse spricht von einem Konto oder verlinkt /account', () => {
    for (const datei of KASSE_DATEIEN) {
      // Modulnamen (etwa @/lib/stripe-konto) sind kein Text für die Kundin.
      const text = lies(datei)
        .split('\n')
        .filter((z) => !/^import\b/.test(z) && !/^\s*\} from '/.test(z))
        .join('\n')
      expect(text, datei).not.toMatch(KONTO)
    }
  })

  it('der Hinweis unter der E-Mail nennt den Weg zur Bestellung: die Bestätigung mit Link', () => {
    const html = renderToStaticMarkup(createElement(KontaktHinweis))
    expect(html).toContain('Bestätigung')
    expect(html).toContain('Link')
    expect(html).not.toMatch(KONTO)
  })
})

describe('Beide Themes: nur Tokens', () => {
  const LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|hsl|oklch)\(|\b(?:bg|text|border|from|to)-(?:white|black)\b/

  it('keine Farbliterale und kein bg-white/black in den Dateien der Kasse', () => {
    for (const datei of KASSE_DATEIEN) {
      const zeilen = lies(datei)
        .split('\n')
        // Die Stripe-Maske kennt keine CSS-Variablen — die eine Ausnahme ist dort begründet markiert.
        .filter((z, i, alle) => !(alle[i - 1] ?? '').includes('eslint-disable-next-line no-restricted-syntax --'))
      expect(zeilen.filter((z) => LITERAL.test(z)), datei).toEqual([])
    }
  })

  it('Gegenprobe: das Muster schlägt an', () => {
    expect(LITERAL.test('className="bg-white"')).toBe(true)
    expect(LITERAL.test("colorPrimary: '#15803d'")).toBe(true)
  })

  it('die Kasse steht in der Fokus-Shell (data-design="neu")', () => {
    expect(lies('src/components/checkout/checkout-form.tsx')).toMatch(/<KundeFokusShell\b/)
  })
})

describe('Abholung: jeder Termin mit Datum (Nr. 46)', () => {
  // Montag, 5. Oktober 2026, 10 Uhr in Wien; Fenster Mo 15–18 und Sa 9–12.
  const slots = [
    { id: 's1', dayOfWeek: 1, startTime: '15:00', endTime: '18:00', maxOrders: null, isActive: true },
    { id: 's2', dayOfWeek: 6, startTime: '09:00', endTime: '12:00', maxOrders: null, isActive: true },
  ]
  const FELD_TERMIN = { name: 'pickupSlotKey' as const, onChange: async () => {}, onBlur: async () => {}, ref: () => {} }

  it('jede Kachel nennt Wochentag und Datum; heute steht zusätzlich „Heute"', () => {
    const kacheln = abholKacheln(slots, JETZT, [])
    const html = renderToStaticMarkup(createElement(AbholWahl, { kacheln, feld: FELD_TERMIN }))
    expect(html).toContain('Heute')
    expect(html).toContain('Mo, 5.\u00a0Okt')
    expect(html).toContain('Sa, 10.\u00a0Okt')
    expect(html).toContain('Sa, 17.\u00a0Okt')
    // Jede Kachel trägt ihr Datum — so viele Daten wie Radioknöpfe.
    const daten = html.match(/(Mo|Di|Mi|Do|Fr|Sa|So), \d{1,2}\.\u00a0[A-ZÄa-zä]+/g) ?? []
    expect(daten.length).toBe(kacheln.length)
    expect((html.match(/type="radio"/g) ?? []).length).toBe(kacheln.length)
    // Ein Wochentag ohne Datum („Samstag") kommt nicht mehr vor.
    expect(html).not.toMatch(/>(Montag|Samstag|Mittwoch)</)
  })
})
