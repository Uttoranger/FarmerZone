/**
 * Nr. 244, Nachbesserung Runde 1: Der Abholzettel (src/app/(druck)/orders/[orderId]/print/page.tsx) ist auch für
 * stornierte und nicht abgeholte Bestellungen erreichbar (papierMarke). Ist die Gebühr entfallen bzw. erstattet,
 * steht ihre Zeile mit „(entfällt)“ bzw. „(erstattet)“ und gestrichenem Betrag da, „Gesamt“ ist der Warenpreis
 * (anzeigeGesamtCents) — wie auf der Bestätigung. Der Betrag des Kastens bleibt der Snapshot (barZuKassierenCents);
 * sein Titel heißt seit Nr. 249b bei nicht abgeholt/storniert/entfallen „Nichts zu kassieren“, bei Karte „Zu kassieren“.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const m = vi.hoisted(() => ({ bestellung: null as unknown }))

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children?: ReactNode }) => createElement('a', { href }, children),
}))
vi.mock('next/navigation', () => ({ redirect: vi.fn(), notFound: vi.fn() }))
vi.mock('@/server/hofbereich', () => ({ verlangeHofDerSitzung: async () => ({ userId: 'u1', farmId: 'farm_1' }) }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    farm: {
      findUnique: async () => ({ id: 'farm_1', name: 'Testhof', address: 'Teststraße 1', postalCode: '0000', city: 'Testort', phone: null }),
    },
  },
}))
vi.mock('@/server/queries/orders', () => ({ getOrderDetail: async () => m.bestellung }))
vi.mock('@/components/orders/print-button', () => ({ PrintButton: () => null }))

import OrderPrintPage from '@/app/(druck)/orders/[orderId]/print/page'
import { barZuKassierenCents } from '@/lib/servicegebuehr'

const ENTFALLEN_AM = new Date('2026-11-05T10:00:00.000Z')

function bestellung(teil: { status: string; paymentMethod: string; paymentStatus: string; serviceFeeRefundedAt: Date | null }) {
  return {
    id: 'o1',
    orderNumber: 'FZ-TEST1',
    pickupDate: new Date('2026-11-07T00:00:00.000Z'),
    createdAt: new Date('2026-11-04T09:00:00.000Z'),
    pickupTimeStart: '14:00',
    pickupTimeEnd: '16:00',
    customerName: 'Testkundin',
    customerPhone: '',
    customerEmail: 'kundin@example.com',
    customerNote: null,
    totalAmount: '9.80',
    serviceFeeCents: 60,
    gebuehrModell: null,
    items: [{ id: 'i1', productName: 'Freilandeier', quantity: 2, totalPriceCents: 980, fehltSeit: null, product: null }],
    ...teil,
  }
}

async function zettel(): Promise<string> {
  return renderToStaticMarkup(await OrderPrintPage({ params: Promise.resolve({ orderId: 'o1' }) })).replace(/<!-- -->/g, '')
}

beforeEach(() => {
  m.bestellung = null
})

describe('Abholzettel: „Gesamt“ ohne entfallene Gebühr', () => {
  it('bar, Gebühr entfallen (storniert): Zeile „(entfällt)“ gestrichen, Gesamt = Warenpreis, Kasten „Nichts zu kassieren“', async () => {
    const b = bestellung({ status: 'CANCELLED', paymentMethod: 'ONSITE_CASH', paymentStatus: 'PENDING', serviceFeeRefundedAt: ENTFALLEN_AM })
    m.bestellung = b
    const html = await zettel()
    expect(html).toMatch(/Servicegebühr \(entfällt\)<\/td><td class="[^"]*line-through[^"]*">€\s0,60<\/td>/)
    expect(html).toMatch(/Gesamt<\/td><td[^>]*>€\s9,80<\/td>/)
    // Nr. 249b (Antwort 8, 7.11.2026): nur der TITEL des Kastens ändert sich, ohne Betrag. Der Snapshot
    // barZuKassierenCents bleibt unverändert (Gegenprobe darunter, tests/druck-kasse.test.ts).
    expect(html).toMatch(/>Nichts zu kassieren<\/div>/)
    expect(html).not.toContain('Bar zu kassieren')
    expect(barZuKassierenCents(b)).toBe(1040)
  })

  it('Karte bei Abholung (Altbestand), offen: „Zu kassieren“ statt „Bar zu kassieren“, Betrag aus dem Snapshot', async () => {
    m.bestellung = bestellung({ status: 'CONFIRMED', paymentMethod: 'ONSITE_CARD', paymentStatus: 'PENDING', serviceFeeRefundedAt: null })
    const html = await zettel()
    expect(html).toMatch(/>Zu kassieren: €\s10,40/)
    expect(html).not.toContain('Bar zu kassieren')
  })

  it('Hofpreis-Modell: der Satz spricht vom Gesamt — die Positionen stehen ohne Gebühr', async () => {
    m.bestellung = { ...bestellung({ status: 'CONFIRMED', paymentMethod: 'ONSITE_CASH', paymentStatus: 'PENDING', serviceFeeRefundedAt: null }), gebuehrModell: 'hofpreis' }
    const html = await zettel()
    expect(html).toMatch(/Freilandeier[\s\S]*€\s9,80/)
    expect(html).toMatch(/Gesamt<\/td><td[^>]*>€\s10,40<\/td>/)
    expect(html).toContain('Gesamt inkl. Plattformgebühr.')
    expect(html).not.toContain('Preise inkl.')
  })

  it('online, Gebühr erstattet (nicht abgeholt): Zeile „(erstattet)“ gestrichen, Gesamt = Warenpreis', async () => {
    m.bestellung = bestellung({ status: 'NOT_PICKED_UP', paymentMethod: 'ONLINE', paymentStatus: 'PAID', serviceFeeRefundedAt: ENTFALLEN_AM })
    const html = await zettel()
    expect(html).toMatch(/Servicegebühr \(erstattet\)<\/td><td class="[^"]*line-through[^"]*">€\s0,60<\/td>/)
    expect(html).toMatch(/Gesamt<\/td><td[^>]*>€\s9,80<\/td>/)
    expect(html).not.toContain('Bar zu kassieren')
  })

  it('NOT_PICKED_UP online mit offener Erstattung: Gesamt MIT Gebühr, nichts gestrichen, kein Vermerk', async () => {
    m.bestellung = bestellung({ status: 'NOT_PICKED_UP', paymentMethod: 'ONLINE', paymentStatus: 'PAID', serviceFeeRefundedAt: null })
    const html = await zettel()
    expect(html).toMatch(/Gesamt<\/td><td[^>]*>€\s10,40<\/td>/)
    expect(html).not.toContain('line-through')
    expect(html).not.toContain('(entfällt)')
    expect(html).not.toContain('(erstattet)')
  })

  it('Gegenprobe: offene Barbestellung — Gesamt und Bar zu kassieren mit Gebühr, wie bisher', async () => {
    m.bestellung = bestellung({ status: 'CONFIRMED', paymentMethod: 'ONSITE_CASH', paymentStatus: 'PENDING', serviceFeeRefundedAt: null })
    const html = await zettel()
    expect(html).toMatch(/Gesamt<\/td><td[^>]*>€\s10,40<\/td>/)
    expect(html).toMatch(/Bar zu kassieren: €\s10,40/)
    expect(html).not.toContain('line-through')
  })
})
