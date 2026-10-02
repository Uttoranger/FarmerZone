/**
 * Tests für den Produktnamen im Checkout (/api/checkout) — am echten Handler,
 * Prisma/Stripe/Mail gemockt.
 *
 * Ursache des Fehlers: Die Route baute ihre Positionen aus dem Request
 * (`{ ...i }`) und ersetzte nur den Preis. Der Name, den der Browser schickt,
 * landete so in OrderItem.productName (Bestellliste, Packliste, Hof-Mail,
 * Abrechnung) und in der Bestätigungsmail — beliebiger Text aus einem
 * gebauten Request.
 *
 * Beweist:
 *  - Mit items.name „Gratis" trägt die Bestellung den Namen aus der Datenbank,
 *    an beiden Stellen: in der angelegten Bestellung und in der Bestätigungsmail.
 *  - Auch die Fehlermeldungen (Preis geändert, Bestand weg) nennen den
 *    Datenbanknamen.
 *  - Ein überlanger Name aus der Datenbank wird auf PRODUKTNAME_MAX gekürzt.
 *  - Ein Request ohne items.name ist gültig — das Feld wird nicht mehr gebraucht.
 *
 * Die Produkt-Attrappe liefert nur die Felder, die die Route im `select`
 * anfordert — sonst bliebe ein vergessenes `name: true` unbemerkt.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { PRODUKTNAME_MAX } from '@/lib/eingabegrenzen'

vi.mock('@/lib/rate-limit', () => ({ enforceRateLimit: vi.fn(() => null) }))
vi.mock('@/lib/stripe', () => ({
  stripe: { paymentIntents: { create: vi.fn(), retrieve: vi.fn() } },
}))
vi.mock('@/lib/email', () => ({ sendOnsiteConfirmation: vi.fn() }))
// Der Abholtermin hat eigene Tests (tests/checkout-abholfenster.test.ts):
// Hier gilt jedes Fenster als angeboten und unbegrenzt, der Rest des Moduls läuft echt.
vi.mock('@/server/abholfenster', async (original) => ({
  ...(await original<typeof import('@/server/abholfenster')>()),
  pruefeAbholfenster: vi.fn(async () => ({
    ok: true,
    fenster: { datum: '', start: '', ende: '', slot: { id: 'slot_1', dayOfWeek: 0, startTime: '', endTime: '', maxOrders: null, isActive: true } },
  })),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    farm: { findUnique: vi.fn() },
    product: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    stockReservation: { aggregate: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
    user: { findUnique: vi.fn(), create: vi.fn() },
    order: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    customerFarmSubscription: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}))

import { POST } from '@/app/api/checkout/route'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { sendOnsiteConfirmation } from '@/lib/email'

const farmFindUnique = vi.mocked(prisma.farm.findUnique)
const productFindMany = vi.mocked(prisma.product.findMany)
const productUpdateMany = vi.mocked(prisma.product.updateMany)
const reservationFindMany = vi.mocked(prisma.stockReservation.findMany)
const userFindUnique = vi.mocked(prisma.user.findUnique)
const orderFindUnique = vi.mocked(prisma.order.findUnique)
const orderCreate = vi.mocked(prisma.order.create)
const orderUpdate = vi.mocked(prisma.order.update)
const intentCreate = vi.mocked(stripe.paymentIntents.create)
const mail = vi.mocked(sendOnsiteConfirmation)

const HOF = {
  id: 'farm_1',
  name: 'Hof Test',
  slug: 'hof-test',
  email: 'hof@example.com',
  ownerName: 'Max Mustermann',
  address: 'Feldweg 1',
  postalCode: '4910',
  city: 'Ried',
  phone: '+43 660 0000000',
  isActive: true,
  archivedAt: null,
  approvedAt: new Date('2026-01-01T00:00:00.000Z'),
  isPaused: false,
  acceptsOnline: true,
  acceptsOnsite: true,
  stripeAccountReady: true,
  stripeAccountId: 'acct_hof',
  platformFeePercent: { toString: () => '0' },
  serviceFeePercent: { toString: () => '0' },
  serviceFeeMinCents: 0,
  serviceFeeActiveFrom: null,
  owner: { name: 'Max Mustermann' },
}

/** Die „Datenbank": Name und Preis je Produkt. */
let produkte: Record<string, { name: string; price: string }>

type Where = { id?: { in?: string[] }; productId?: { in?: string[] }; sessionId?: unknown }

/** Wie Prisma: Mit `select` kommen nur die angeforderten Felder zurück. */
function waehle<T extends Record<string, unknown>>(zeile: T, select?: Record<string, boolean>): Partial<T> {
  if (!select) return zeile
  return Object.fromEntries(Object.entries(zeile).filter(([k]) => select[k])) as Partial<T>
}

beforeEach(() => {
  vi.clearAllMocks()
  // Feste Uhr: Tag vor der Abholung (pickupDate unten), Reservierungen laufen
  // ab „jetzt" — nur Date, damit vi.waitFor seine eigenen Timer behält.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-25T10:00:00.000Z'))
  produkte = {
    tomaten: { name: 'Tomaten vom Hof', price: '4.99' },
    eier: { name: 'Bio-Freilandeier', price: '3.60' },
  }
  productFindMany.mockImplementation(((a: { where?: Where; select?: Record<string, boolean> }) => {
    const gesucht = a?.where?.id?.in ?? []
    return Promise.resolve(
      gesucht
        .filter((id) => produkte[id] !== undefined)
        .map((id) =>
          waehle(
            {
              id,
              name: produkte[id].name,
              stock: 999,
              isAvailable: true,
              farmId: 'farm_1',
              vatRate: { toString: () => '10.00' },
              abgabe: 'ALLE',
              price: { toString: () => produkte[id].price },
              unit: 'STUECK',
              unitSize: null,
            },
            a?.select
          )
        )
    )
  }) as never)
  reservationFindMany.mockImplementation(((a: { where?: Where }) => {
    const w = a?.where ?? {}
    if (w.sessionId && typeof w.sessionId === 'object') return Promise.resolve([])
    const gesucht = w.productId?.in ?? w.id?.in ?? []
    return Promise.resolve(
      gesucht.map((id) => ({ productId: id, quantity: 999, expiresAt: new Date(Date.now() + 600_000) }))
    )
  }) as never)
  productUpdateMany.mockResolvedValue({ count: 1 } as never)
  farmFindUnique.mockResolvedValue(HOF as never)
  userFindUnique.mockResolvedValue({ id: 'user_1' } as never)
  orderFindUnique.mockResolvedValue(null)
  orderCreate.mockImplementation((async ({ data }: { data: Record<string, unknown> }) => ({
    id: 'order_1',
    createdAt: new Date(),
    ...data,
  })) as never)
  orderUpdate.mockResolvedValue({} as never)
  intentCreate.mockResolvedValue({ id: 'pi_test', client_secret: 'secret_test' } as never)
  mail.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.useRealTimers()
})

type Position = { productId: string; name?: string; quantity: number; unitPrice: number }

function anfrage(items: Position[], paymentMethod = 'ONSITE_CASH') {
  return new NextRequest('http://localhost/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      farmId: 'farm_1',
      farmSlug: 'hof-test',
      sessionId: 'sid_1',
      customerName: 'Max Mustermann',
      customerEmail: 'max@example.com',
      customerPhone: '+43 660 0000000',
      pickupDate: '2026-09-26',
      pickupTimeStart: '09:00',
      pickupTimeEnd: '12:00',
      paymentMethod,
      items,
    }),
  })
}

type OrderData = { items: { create: Array<{ productId: string; productName: string }> } }
const bestellNamen = () =>
  (orderCreate.mock.calls[0][0].data as unknown as OrderData).items.create.map((p) => p.productName)

type MailDaten = { items: Array<{ productName: string }> }
const mailNamen = () => (mail.mock.calls[0][0] as unknown as MailDaten).items.map((p) => p.productName)

describe('Produktname aus der Datenbank, nicht aus dem Request', () => {
  it('Stelle 1 — die Bestellung: items.name „Gratis" ergibt den Datenbanknamen', async () => {
    const res = await POST(
      anfrage([
        { productId: 'tomaten', name: 'Gratis', quantity: 2, unitPrice: 4.99 },
        { productId: 'eier', name: 'Gratis', quantity: 1, unitPrice: 3.6 },
      ])
    )

    expect(res.status).toBe(200)
    expect(bestellNamen()).toEqual(['Tomaten vom Hof', 'Bio-Freilandeier'])
  })

  it('Stelle 2 — die Bestätigungsmail: items.name „Gratis" ergibt den Datenbanknamen', async () => {
    const res = await POST(anfrage([{ productId: 'tomaten', name: 'Gratis', quantity: 1, unitPrice: 4.99 }]))

    expect(res.status).toBe(200)
    // Der Versand läuft nach der Antwort (nachDerAntwort) — auf ihn warten.
    await vi.waitFor(() => expect(mail).toHaveBeenCalled())
    expect(mailNamen()).toEqual(['Tomaten vom Hof'])
  })

  it('Online: auch dort trägt die Bestellung den Datenbanknamen', async () => {
    const res = await POST(
      anfrage([{ productId: 'tomaten', name: 'Gratis', quantity: 1, unitPrice: 4.99 }], 'ONLINE')
    )

    expect(res.status).toBe(200)
    expect(bestellNamen()).toEqual(['Tomaten vom Hof'])
  })

  it('ein überlanger Name aus der Datenbank wird auf die Grenze gekürzt', async () => {
    produkte.tomaten.name = 'T'.repeat(PRODUKTNAME_MAX + 20)
    const res = await POST(anfrage([{ productId: 'tomaten', name: 'Gratis', quantity: 1, unitPrice: 4.99 }]))

    expect(res.status).toBe(200)
    expect(bestellNamen()).toEqual(['T'.repeat(PRODUKTNAME_MAX)])
  })

  it('ein Request ohne items.name ist gültig', async () => {
    const res = await POST(anfrage([{ productId: 'tomaten', quantity: 1, unitPrice: 4.99 }]))

    expect(res.status).toBe(200)
    expect(bestellNamen()).toEqual(['Tomaten vom Hof'])
  })
})

describe('Fehlermeldungen nennen den Datenbanknamen', () => {
  it('Preis geändert', async () => {
    produkte.tomaten.price = '5.49'
    const res = await POST(anfrage([{ productId: 'tomaten', name: 'Gratis', quantity: 1, unitPrice: 4.99 }]))

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toContain('Tomaten vom Hof')
    expect(body.error).not.toContain('Gratis')
  })

  it('Bestand inzwischen weg', async () => {
    productUpdateMany.mockResolvedValue({ count: 0 } as never)
    const res = await POST(anfrage([{ productId: 'tomaten', name: 'Gratis', quantity: 1, unitPrice: 4.99 }]))

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toContain('Tomaten vom Hof')
    expect(body.error).not.toContain('Gratis')
    expect(orderCreate).not.toHaveBeenCalled()
  })
})
