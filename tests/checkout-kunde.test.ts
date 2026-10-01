/**
 * Das Kundenkonto im Checkout (/api/checkout) — am echten Handler, Prisma,
 * Stripe und Mail gemockt.
 *
 * Beweist: Die Schreibweise der E-Mail entscheidet nicht darüber, wer der
 * Kunde ist. Die Datenbank vergleicht E-Mails genau (der eindeutige Index auf
 * User.email unterscheidet „Max@…" von „max@…"); vor dem Fix legte deshalb
 * jede andere Schreibweise ein zweites Kundenkonto an, während Better Auth
 * (Anmeldelink, Registrierung) Adressen immer klein speichert und das zweite
 * Konto beim Anmelden nicht fand. Die Nutzertabelle ist hier eine Map mit
 * genau diesem Vergleich.
 *
 * Dazu die Obergrenze der Notiz am Handler selbst: Zu lang wird abgelehnt,
 * bevor Bestand gebucht oder eine Bestellung angelegt wird.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/rate-limit', () => ({ enforceRateLimit: vi.fn(() => null) }))
vi.mock('@/lib/stripe', () => ({
  stripe: { paymentIntents: { create: vi.fn(), retrieve: vi.fn() } },
}))
vi.mock('@/lib/email', () => ({ sendOnsiteConfirmation: vi.fn() }))
// Die Freigabe verwaister Bestellungen hat eigene Tests
// (tests/integration/verwaiste-bestellungen.int.test.ts); hier zählt nur das Kundenkonto.
vi.mock('@/server/verwaiste-bestellungen', () => ({ gibVerwaisteFreiOhneRisiko: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    farm: { findUnique: vi.fn() },
    product: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    stockReservation: { aggregate: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
    user: { findUnique: vi.fn(), create: vi.fn() },
    order: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    customerFarmSubscription: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}))

import { POST } from '@/app/api/checkout/route'
import { prisma } from '@/lib/prisma'
import { sendOnsiteConfirmation } from '@/lib/email'

const farmFindUnique = vi.mocked(prisma.farm.findUnique)
const productFindMany = vi.mocked(prisma.product.findMany)
const productUpdateMany = vi.mocked(prisma.product.updateMany)
const reservationFindMany = vi.mocked(prisma.stockReservation.findMany)
const userFindUnique = vi.mocked(prisma.user.findUnique)
const userCreate = vi.mocked(prisma.user.create)
const orderFindUnique = vi.mocked(prisma.order.findUnique)
const orderCreate = vi.mocked(prisma.order.create)
const orderUpdate = vi.mocked(prisma.order.update)

const HOF = {
  id: 'farm_1',
  name: 'Hof Test',
  slug: 'hof-test',
  email: 'hof@example.org',
  ownerName: 'Max Mustermann',
  address: 'Feldweg 1',
  postalCode: '4910',
  city: 'Ried',
  phone: '+43 660 0000000',
  isActive: true,
  archivedAt: null,
  approvedAt: new Date('2026-01-01T00:00:00.000Z'),
  isPaused: false,
  acceptsOnline: false,
  acceptsOnsite: true,
  stripeAccountReady: false,
  stripeAccountId: null,
  platformFeePercent: { toString: () => '0' },
  serviceFeePercent: { toString: () => '0' },
  serviceFeeMinCents: 0,
  serviceFeeActiveFrom: null,
  owner: { name: 'Max Mustermann' },
}

const ids = (a: unknown): string[] => {
  const w = (a as { where?: { id?: { in?: string[] }; productId?: { in?: string[] } } })?.where
  return w?.id?.in ?? w?.productId?.in ?? []
}

/** Die Nutzertabelle: eindeutig über die E-Mail, Vergleich Zeichen für Zeichen — wie in Postgres. */
let kunden: Map<string, { id: string }>

function anfrage(overrides: Record<string, unknown> = {}): NextRequest {
  return new NextRequest('http://localhost/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      farmId: 'farm_1',
      farmSlug: 'hof-test',
      sessionId: 'sid_1',
      customerName: 'Max Mustermann',
      customerEmail: 'max.mustermann@example.org',
      customerPhone: '+43 660 0000000',
      customerNote: '',
      pickupDate: '2026-10-02',
      pickupTimeStart: '14:00',
      pickupTimeEnd: '16:00',
      paymentMethod: 'ONSITE_CASH',
      items: [{ productId: 'prod_1', name: 'Erdäpfel', quantity: 2, unitPrice: 5 }],
      ...overrides,
    }),
  })
}

/** Die Kunden-ID, mit der die n-te Bestellung angelegt wurde. */
const kundeDerBestellung = (n: number): unknown =>
  (orderCreate.mock.calls[n][0] as { data: { customerId: string } }).data.customerId

beforeEach(() => {
  vi.clearAllMocks()
  kunden = new Map()
  farmFindUnique.mockResolvedValue(HOF as never)
  productFindMany.mockImplementation(((a: unknown) =>
    Promise.resolve(ids(a).map((id) => ({ id, stock: 999, isAvailable: true, price: 5, abgabe: 'ALLE', vatRate: 10 })))) as never)
  reservationFindMany.mockImplementation(((a: unknown) => {
    const sitzung = (a as { where?: { sessionId?: unknown } })?.where?.sessionId
    if (sitzung && typeof sitzung === 'object') return Promise.resolve([]) // fremde Sitzungen
    return Promise.resolve(ids(a).map((id) => ({ productId: id, quantity: 999, expiresAt: new Date(Date.now() + 600_000) })))
  }) as never)
  productUpdateMany.mockResolvedValue({ count: 1 } as never)
  userFindUnique.mockImplementation((({ where }: { where: { email: string } }) =>
    Promise.resolve(kunden.get(where.email) ?? null)) as never)
  userCreate.mockImplementation((({ data }: { data: { email: string } }) => {
    const kunde = { id: `kunde_${kunden.size + 1}` }
    kunden.set(data.email, kunde)
    return Promise.resolve(kunde)
  }) as never)
  orderFindUnique.mockResolvedValue(null)
  orderCreate.mockResolvedValue({ id: 'order_1', createdAt: new Date() } as never)
  orderUpdate.mockResolvedValue({} as never)
  vi.mocked(sendOnsiteConfirmation).mockResolvedValue(undefined as never)
})

describe('Kundenkonto im Checkout', () => {
  it('ordnet zwei Bestellungen mit verschieden geschriebener E-Mail demselben Kunden zu', async () => {
    const erste = await POST(anfrage({ customerEmail: 'Max.Mustermann@Example.org' }))
    const zweite = await POST(anfrage({ customerEmail: 'max.mustermann@example.org' }))

    expect(erste.status).toBe(200)
    expect(zweite.status).toBe(200)
    expect(kundeDerBestellung(0)).toBe(kundeDerBestellung(1))
    expect(kunden.size).toBe(1)
  })

  it('legt das Kundenkonto mit der bereinigten, klein geschriebenen Adresse an', async () => {
    const res = await POST(anfrage({ customerEmail: ' Max.Mustermann@Example.ORG ' }))

    expect(res.status).toBe(200)
    expect([...kunden.keys()]).toEqual(['max.mustermann@example.org'])
    expect((orderCreate.mock.calls[0][0] as { data: { customerEmail: string } }).data.customerEmail).toBe(
      'max.mustermann@example.org'
    )
  })

  it('findet ein bestehendes Konto auch, wenn die Kundin ihre Adresse groß schreibt', async () => {
    kunden.set('max.mustermann@example.org', { id: 'kunde_bestand' })

    await POST(anfrage({ customerEmail: 'MAX.MUSTERMANN@EXAMPLE.ORG' }))

    expect(kundeDerBestellung(0)).toBe('kunde_bestand')
    expect(userCreate).not.toHaveBeenCalled()
  })
})

describe('Obergrenzen am Checkout-Handler', () => {
  it('lehnt eine Notiz über 500 Zeichen ab, ohne Bestand zu buchen oder eine Bestellung anzulegen', async () => {
    const res = await POST(anfrage({ customerNote: 'x'.repeat(501) }))

    expect(res.status).toBe(400)
    expect(productUpdateMany).not.toHaveBeenCalled()
    expect(orderCreate).not.toHaveBeenCalled()
  })

  it('nimmt eine Notiz mit genau 500 Zeichen an', async () => {
    const res = await POST(anfrage({ customerNote: 'x'.repeat(500) }))

    expect(res.status).toBe(200)
    expect(orderCreate).toHaveBeenCalledTimes(1)
  })
})
