/**
 * Tests für die drei kritischen Änderungen am Checkout (/api/checkout) —
 * am echten Handler, Prisma/Stripe/Mail gemockt.
 *
 * Beweist:
 *   Befund 3  Eine abgelaufene Reservierung wird NIE durchgewunken. Die
 *             Antwort nennt den Grund, liefert den berichtigten Warenkorb mit
 *             und legt KEINE Bestellung an.
 *   Befund 4  Derselbe Idempotenz-Schlüssel erzeugt keine zweite Bestellung.
 *             Der Mailversand blockiert die Antwort nicht und kann sie auch
 *             nicht scheitern lassen.
 *   dazu      Der Bestand wird bedingt gebucht: Wer zwischen Prüfung und
 *             Buchung schneller war, führt nicht zu negativem Bestand, und
 *             bereits gebuchte Positionen werden wieder gutgeschrieben.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/rate-limit', () => ({ enforceRateLimit: vi.fn(() => null) }))
vi.mock('@/lib/stripe', () => ({
  stripe: { paymentIntents: { create: vi.fn(), retrieve: vi.fn() } },
}))
vi.mock('@/lib/email', () => ({ sendOnsiteConfirmation: vi.fn() }))
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
import { stripe } from '@/lib/stripe'
import { sendOnsiteConfirmation } from '@/lib/email'
import { CODE_RESERVIERUNG_ABGELAUFEN, RESERVIERUNG_ABGELAUFEN } from '@/lib/reservierung'

const farmFindUnique = vi.mocked(prisma.farm.findUnique)
const productFindMany = vi.mocked(prisma.product.findMany)
const productUpdate = vi.mocked(prisma.product.update)
const productUpdateMany = vi.mocked(prisma.product.updateMany)
const reservationFindMany = vi.mocked(prisma.stockReservation.findMany)
const userFindUnique = vi.mocked(prisma.user.findUnique)
const orderFindUnique = vi.mocked(prisma.order.findUnique)
const orderCreate = vi.mocked(prisma.order.create)
const orderUpdate = vi.mocked(prisma.order.update)
const mail = vi.mocked(sendOnsiteConfirmation)

const HOF = {
  id: 'farm_1',
  name: 'Beispielhof',
  slug: 'beispielhof',
  email: 'hof@example.com',
  ownerName: 'Inhaberin',
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
  owner: { name: 'Inhaberin' },
}

const ids = (a: unknown): string[] => {
  const w = (a as { where?: { id?: { in?: string[] }; productId?: { in?: string[] } } })?.where
  return w?.id?.in ?? w?.productId?.in ?? []
}

/** Normalfall: Ware da, eigener Halt gültig, Buchung geht durch. */
function warenkorbBereit(haltMs = 600_000, bestand = 999) {
  productFindMany.mockImplementation(((a: unknown) =>
    Promise.resolve(ids(a).map((id) => ({ id, stock: bestand, isAvailable: true })))) as never)
  reservationFindMany.mockImplementation(((a: unknown) => {
    const sess = (a as { where?: { sessionId?: unknown } })?.where?.sessionId
    if (sess && typeof sess === 'object') return Promise.resolve([]) // fremde Sitzungen
    return Promise.resolve(
      ids(a).map((id) => ({ productId: id, quantity: 999, expiresAt: new Date(Date.now() + haltMs) }))
    )
  }) as never)
  productUpdateMany.mockResolvedValue({ count: 1 } as never)
}

function anfrage(overrides: Record<string, unknown> = {}) {
  return new NextRequest('http://localhost/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      farmId: 'farm_1',
      farmSlug: 'beispielhof',
      sessionId: 'sid_1',
      customerName: 'Anna Testerin',
      customerEmail: 'anna@example.com',
      customerPhone: '+43 660 1234567',
      customerNote: '',
      pickupDate: '2026-09-25',
      pickupTimeStart: '14:00',
      pickupTimeEnd: '16:00',
      paymentMethod: 'ONSITE_CASH',
      items: [{ productId: 'prod_1', name: 'Tomaten', quantity: 2, unitPrice: 5 }],
      ...overrides,
    }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  warenkorbBereit()
  farmFindUnique.mockResolvedValue(HOF as never)
  userFindUnique.mockResolvedValue({ id: 'user_1' } as never)
  orderFindUnique.mockResolvedValue(null)
  orderCreate.mockResolvedValue({ id: 'order_1', createdAt: new Date() } as never)
  orderUpdate.mockResolvedValue({} as never)
  productUpdate.mockResolvedValue({} as never)
  mail.mockResolvedValue(undefined)
})

// ── Befund 3: Reservierungsfrist ────────────────────────────────────────────

describe('Abgelaufene Reservierung', () => {
  it('wird nie durchgewunken: 409, kein Bestellsatz, kein Bestand gebucht', async () => {
    warenkorbBereit(-1000) // Halt liegt in der Vergangenheit
    const res = await POST(anfrage())

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe(CODE_RESERVIERUNG_ABGELAUFEN)
    expect(body.error).toContain(RESERVIERUNG_ABGELAUFEN)
    expect(orderCreate).not.toHaveBeenCalled()
    expect(productUpdateMany).not.toHaveBeenCalled()
  })

  it('liefert den berichtigten Warenkorb mit, damit die Seite nicht leer bleibt', async () => {
    warenkorbBereit(-1000, 1) // abgelaufen UND nur noch eines da
    const res = await POST(anfrage())
    const body = await res.json()

    expect(body.items).toEqual([{ productId: 'prod_1', quantity: 1 }])
    expect(body.positionen[0]).toMatchObject({ gewuenscht: 2, moeglich: 1, zustand: 'gekuerzt' })
  })

  it('fehlender Halt zählt wie ein abgelaufener', async () => {
    reservationFindMany.mockResolvedValue([] as never)
    const res = await POST(anfrage())
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe(CODE_RESERVIERUNG_ABGELAUFEN)
    expect(orderCreate).not.toHaveBeenCalled()
  })

  it('gültiger Halt: die Bestellung entsteht', async () => {
    const res = await POST(anfrage())
    expect(res.status).toBe(200)
    expect(orderCreate).toHaveBeenCalledTimes(1)
  })
})

// ── Befund 4: Idempotenz ────────────────────────────────────────────────────

describe('Idempotenz', () => {
  it('kennt der Server den Schlüssel, entsteht keine zweite Bestellung', async () => {
    orderFindUnique.mockImplementation((({ where }: { where: Record<string, unknown> }) =>
      Promise.resolve(
        where.idempotencyKey
          ? { id: 'order_alt', orderNumber: 'BH-2009-AAAA', paymentMethod: 'ONSITE_CASH', stripePaymentIntentId: null }
          : null
      )) as never)

    const res = await POST(anfrage({ idempotencyKey: 'schluessel-a' }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ orderId: 'order_alt', orderNumber: 'BH-2009-AAAA', wiederholt: true })
    expect(orderCreate).not.toHaveBeenCalled()
    expect(productUpdateMany).not.toHaveBeenCalled()
    expect(mail).not.toHaveBeenCalled()
  })

  it('schreibt den Schlüssel an die neue Bestellung', async () => {
    await POST(anfrage({ idempotencyKey: 'schluessel-neu' }))
    expect(orderCreate.mock.calls[0][0].data).toMatchObject({ idempotencyKey: 'schluessel-neu' })
  })

  it('ohne Schlüssel bleibt das Feld leer — alte Tabs laufen nicht in einen Fehler', async () => {
    const res = await POST(anfrage())
    expect(res.status).toBe(200)
    expect(orderCreate.mock.calls[0][0].data).toMatchObject({ idempotencyKey: null })
  })

  it('gleichzeitiger zweiter Request: der eindeutige Index gewinnt, die Kundin sieht keine Fehlermeldung', async () => {
    // Beim Eingang kennt der Server den Schlüssel noch NICHT (beide Requests
    // sind gleichzeitig da). Erst das Anlegen läuft in den eindeutigen Index;
    // danach findet der Server die Bestellung des schnelleren.
    orderCreate.mockRejectedValue(new Error('Unique constraint failed'))
    let vorbeiAmEingang = false
    orderFindUnique.mockImplementation((({ where }: { where: Record<string, unknown> }) => {
      if (!where.idempotencyKey) return Promise.resolve(null) // Bestellnummer-Kollision
      if (!vorbeiAmEingang) {
        vorbeiAmEingang = true
        return Promise.resolve(null)
      }
      return Promise.resolve({
        id: 'order_erst',
        orderNumber: 'BH-2009-BBBB',
        paymentMethod: 'ONSITE_CASH',
        stripePaymentIntentId: null,
      })
    }) as never)

    const res = await POST(anfrage({ idempotencyKey: 'gleichzeitig' }))

    expect(res.status).toBe(200)
    expect((await res.json())).toMatchObject({ orderId: 'order_erst', wiederholt: true })
    // Der bereits gebuchte Bestand wurde wieder gutgeschrieben.
    expect(productUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { stock: { increment: 2 } } })
    )
  })
})

// ── Befund 4: Mailversand blockiert nicht ───────────────────────────────────

describe('Bestätigungsmail', () => {
  it('hält die Antwort nicht auf — ein hängender Versand blockiert den Checkout nicht', async () => {
    // Der Versand endet NIE. Würde der Handler auf ihn warten, käme diese
    // Antwort nicht — genau das waren die zehn bis fünfzehn Sekunden.
    mail.mockImplementation(() => new Promise<void>(() => {}))

    const res = await Promise.race([
      POST(anfrage()),
      new Promise<never>((_, ab) => setTimeout(() => ab(new Error('Antwort blieb aus')), 1500)),
    ])

    expect(res.status).toBe(200)
    expect((await res.json())).toMatchObject({ orderId: 'order_1', requiresConfirmation: true })
  })

  it('verschickt die Bestätigung mit Bestellnummer und Positionen', async () => {
    await POST(anfrage())
    await new Promise((r) => setTimeout(r, 0))

    expect(mail).toHaveBeenCalledTimes(1)
    const [bestellung, token] = mail.mock.calls[0]
    expect(bestellung).toMatchObject({ id: 'order_1', customerEmail: 'anna@example.com' })
    expect(bestellung.items[0]).toMatchObject({ productName: 'Tomaten', quantity: 2 })
    expect(typeof token).toBe('string')
    expect(token.length).toBeGreaterThanOrEqual(32)
  })

  it('ein gescheiterter Versand lässt die Bestellung stehen', async () => {
    mail.mockRejectedValue(new Error('Resend down'))
    const res = await POST(anfrage())

    expect(res.status).toBe(200)
    expect((await res.json())).toMatchObject({ orderId: 'order_1', requiresConfirmation: true })
    expect(orderCreate).toHaveBeenCalledTimes(1)
    await new Promise((r) => setTimeout(r, 0))
  })

  it('bei Online-Zahlung wird hier keine Bestätigungsmail verschickt', async () => {
    vi.mocked(stripe.paymentIntents.create).mockResolvedValue({
      id: 'pi_1',
      client_secret: 'cs_1',
    } as never)
    await POST(anfrage({ paymentMethod: 'ONLINE' }))
    await new Promise((r) => setTimeout(r, 0))
    expect(mail).not.toHaveBeenCalled()
  })
})

// ── Bestand bedingt buchen ──────────────────────────────────────────────────

describe('Bestandsbuchung', () => {
  it('bucht mit Bedingung, nicht blind — negativer Bestand ist nicht möglich', async () => {
    await POST(anfrage())
    expect(productUpdateMany).toHaveBeenCalledWith({
      where: { id: 'prod_1', stock: { gte: 2 } },
      data: { stock: { decrement: 2 } },
    })
  })

  it('war jemand schneller: 409, keine Bestellung', async () => {
    productUpdateMany.mockResolvedValue({ count: 0 } as never)
    const res = await POST(anfrage())

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe('WARENKORB_GEAENDERT')
    expect(body.error).toContain('Tomaten')
    expect(orderCreate).not.toHaveBeenCalled()
  })

  it('schreibt bereits gebuchte Positionen wieder gut, wenn eine spätere scheitert', async () => {
    productUpdateMany
      .mockResolvedValueOnce({ count: 1 } as never)
      .mockResolvedValueOnce({ count: 0 } as never)

    const res = await POST(
      anfrage({
        items: [
          { productId: 'prod_1', name: 'Tomaten', quantity: 2, unitPrice: 5 },
          { productId: 'prod_2', name: 'Gurken', quantity: 3, unitPrice: 2 },
        ],
      })
    )

    expect(res.status).toBe(409)
    expect(productUpdate).toHaveBeenCalledTimes(1)
    expect(productUpdate).toHaveBeenCalledWith({
      where: { id: 'prod_1' },
      data: { stock: { increment: 2 } },
    })
    expect(orderCreate).not.toHaveBeenCalled()
  })

  it('scheitert das Anlegen der Bestellung, geht der Bestand zurück', async () => {
    orderCreate.mockRejectedValue(new Error('DB weg'))
    const res = await POST(anfrage())

    expect(res.status).toBe(500)
    expect(productUpdate).toHaveBeenCalledWith({
      where: { id: 'prod_1' },
      data: { stock: { increment: 2 } },
    })
  })
})
