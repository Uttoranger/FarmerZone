/**
 * Wochenlage per Mail (Register N32, Nr. 192): Die Zahlen der Woche als reine
 * Funktionen, ohne Datenbank. Der Renderer, der sie lädt und in die Vorlage
 * setzt, steht in tests/mail-auftraege.test.ts.
 *
 * Beweist: Servicegebühr kommt aus derselben Zuordnung wie Admin › Geld
 * (topfVonBestellung), Stornos und Testzahlungen zählen nicht; die Zeilen
 * tragen nur Zahlen, nie Personendaten; Stripe-Gebühren fehlen, solange es
 * sie in Admin › Geld nicht gibt (Nr. 191).
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { servicegebuehrDerWoche, wochenlageZeilen, type WochenlageZahlen } from '@/lib/wochenlage'
import type { BestellungFuerFinanzen } from '@/lib/finanzen'

const TAG = new Date('2026-10-22T09:00:00.000Z')

function bestellung(teil: Partial<BestellungFuerFinanzen>): BestellungFuerFinanzen {
  return {
    createdAt: TAG,
    status: 'CONFIRMED',
    paymentMethod: 'ONLINE',
    paymentStatus: 'PAID',
    serviceFeeCents: 150,
    serviceFeeRefundedAt: null,
    provisionCents: 0,
    ...teil,
  }
}

const ZAHLEN: WochenlageZahlen = {
  bestellungen: 12,
  umsatzCents: 34050,
  servicegebuehrCents: 1800,
  servicegebuehrErwartetCents: 300,
  neueHoefe: 1,
  offen: 4,
  ueberfaellig: 2,
  fehler: 3,
  kostenMonatCents: 4900,
}

describe('servicegebuehrDerWoche', () => {
  it('zählt online Bezahltes als gezählt, Unabgeholtes als erwartet', () => {
    const r = servicegebuehrDerWoche(
      [bestellung({}), bestellung({ serviceFeeCents: 200 }), bestellung({ paymentStatus: 'PENDING', status: 'PENDING_CONFIRMATION', serviceFeeCents: 80 })],
      null
    )
    expect(r).toEqual({ gezaehltCents: 350, erwartetCents: 80 })
  })

  it('Gegenprobe: Storno, entfallene Gebühr und Testzahlung zählen nirgends', () => {
    const r = servicegebuehrDerWoche(
      [
        bestellung({ status: 'CANCELLED' }),
        bestellung({ serviceFeeRefundedAt: TAG }),
        bestellung({ createdAt: new Date('2026-10-01T09:00:00.000Z') }),
      ],
      new Date('2026-10-10T00:00:00.000Z')
    )
    expect(r).toEqual({ gezaehltCents: 0, erwartetCents: 0 })
  })

  it('ohne Bestellungen null', () => {
    expect(servicegebuehrDerWoche([], null)).toEqual({ gezaehltCents: 0, erwartetCents: 0 })
  })
})

describe('wochenlageZeilen', () => {
  const text = (z: WochenlageZahlen) => wochenlageZeilen(z).map((r) => `${r.label}: ${r.wert}`)

  it('nennt Bestellungen, Umsatz, Servicegebühr, neue Höfe, Aufgaben, Fehler und Kosten', () => {
    const zeilen = text(ZAHLEN)
    expect(zeilen).toEqual([
      'Bestellungen: 12',
      'Umsatz der Höfe: € 340,50',
      'Servicegebühr: € 18,00 (dazu erwartet: € 3,00)',
      'Neue Höfe: 1',
      'Offene Aufgaben: 4 (überfällig: 2)',
      'Fehlermeldungen der Woche: 3',
      'Kosten diesen Monat: € 49,00',
    ])
  })

  it('Gegenprobe: keine Stripe-Gebühren, solange es sie nicht gibt', () => {
    expect(text(ZAHLEN).join('\n')).not.toMatch(/stripe/i)
  })

  it('lässt „erwartet" und „überfällig" weg, wenn sie 0 sind', () => {
    const zeilen = text({ ...ZAHLEN, servicegebuehrErwartetCents: 0, ueberfaellig: 0 })
    expect(zeilen).toContain('Servicegebühr: € 18,00')
    expect(zeilen).toContain('Offene Aufgaben: 4')
  })

  it('eine ruhige Woche zeigt Nullen statt leerer Zeilen', () => {
    const zeilen = text({ bestellungen: 0, umsatzCents: 0, servicegebuehrCents: 0, servicegebuehrErwartetCents: 0, neueHoefe: 0, offen: 0, ueberfaellig: 0, fehler: 0, kostenMonatCents: 0 })
    expect(zeilen).toHaveLength(7)
    expect(zeilen[0]).toBe('Bestellungen: 0')
    expect(zeilen[1]).toBe('Umsatz der Höfe: € 0,00')
  })
})
