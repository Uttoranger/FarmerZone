/**
 * Fehler im Geldpfad erreichen Sentry, das Log nennt nur die Art (Nr. 288):
 * Kasse (/api/checkout) und Reservieren (/api/reserve) — am echten Handler,
 * Prisma, Stripe, Mail und Sentry gestellt. Die Meldung trägt nur Kennungen;
 * im Log steht keine Adresse aus der Anfrage (Spion auf console.error).
 * Die Webhook-Fälle prüft tests/integration/webhook-fehler.int.test.ts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({ enforceRateLimit: vi.fn(() => null) }))
vi.mock('@/server/bremse-datenbank', () => ({
  bremseCheckout: vi.fn(async () => null),
  bremseBarBestellung: vi.fn(async () => null),
  bremseReservieren: vi.fn(async () => null),
}))
vi.mock('@/lib/stripe', () => ({ stripe: { paymentIntents: { create: vi.fn(), retrieve: vi.fn() } } }))
vi.mock('@/lib/email', () => ({ sendOnsiteConfirmation: vi.fn() }))
const nachlauf = vi.hoisted(() => ({ liste: [] as Array<() => Promise<void>> }))
vi.mock('@/lib/nach-der-antwort', () => ({ nachDerAntwort: (f: () => Promise<void>) => nachlauf.liste.push(f) }))
vi.mock('@/server/mail-warteschlange', async (original) => ({
  ...(await original<typeof import('@/server/mail-warteschlange')>()),
  stelleEinOhneRisiko: vi.fn(async () => undefined),
}))
vi.mock('@/server/verwaiste-bestellungen', () => ({ gibVerwaisteFreiOhneRisiko: vi.fn(), gibVerwaisteFreiFuerProdukte: vi.fn() }))
vi.mock('@/server/abholfenster', async (original) => ({
  ...(await original<typeof import('@/server/abholfenster')>()),
  pruefeAbholfenster: vi.fn(async () => ({
    ok: true,
    fenster: { datum: '', start: '', ende: '', slot: { id: 'slot_1', dayOfWeek: 0, startTime: '', endTime: '', maxOrders: null, isActive: true } },
  })),
}))
vi.mock('@/server/warenkorb', async (original) => ({
  ...(await original<typeof import('@/server/warenkorb')>()),
  loescheHalte: vi.fn(async () => undefined),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(async (f: (tx: unknown) => unknown) => f((await import('@/lib/prisma')).prisma)),
    plattformEinstellung: { findUnique: vi.fn().mockResolvedValue(null) },
    farm: { findUnique: vi.fn() },
    product: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    stockReservation: { aggregate: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn(), upsert: vi.fn() },
    user: { findUnique: vi.fn(), create: vi.fn() },
    order: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(async () => ({ count: 1 })) },
    customerFarmSubscription: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}))

import * as Sentry from '@sentry/nextjs'
import { POST as kasse } from '@/app/api/checkout/route'
import { DELETE as freigeben, POST as reservieren } from '@/app/api/reserve/route'
import { prisma } from '@/lib/prisma'
import { sendOnsiteConfirmation } from '@/lib/email'
import { loescheHalte } from '@/server/warenkorb'

const melde = vi.mocked(Sentry.captureException)
const KUNDIN = 'erika.kasse@example.com'

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

function anfrage(): NextRequest {
  return new NextRequest('http://localhost/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      farmId: 'farm_1',
      farmSlug: 'beispielhof',
      sessionId: 'sid_1',
      customerName: 'Erika Kasse',
      customerEmail: KUNDIN,
      customerPhone: '+43 699 0000000',
      customerNote: '',
      pickupDate: '2026-09-25',
      pickupTimeStart: '14:00',
      pickupTimeEnd: '16:00',
      paymentMethod: 'ONSITE_CASH',
      items: [{ productId: 'prod_1', name: 'Tomaten', quantity: 2, unitPrice: 5 }],
    }),
  })
}

function reserveAnfrage(methode: 'POST' | 'DELETE'): NextRequest {
  return new NextRequest('http://localhost/api/reserve', {
    method: methode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId: 'prod_1', sessionId: 'sid_1', ...(methode === 'POST' ? { quantity: 1 } : {}) }),
  })
}

let log: ReturnType<typeof vi.spyOn>
const logText = (): string => log.mock.calls.flat().map((x: unknown) => (x instanceof Error ? `${x.name} ${x.message}` : String(x))).join(' ')

beforeEach(() => {
  vi.clearAllMocks()
  nachlauf.liste = []
  log = vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.mocked(prisma.product.findMany).mockImplementation(((a: unknown) =>
    Promise.resolve(ids(a).map((id) => ({ id, name: 'Tomaten', stock: 999, isAvailable: true, price: 5, unit: 'STUECK', unitSize: null, ruecksendekostenCents: null })))) as never)
  vi.mocked(prisma.stockReservation.findMany).mockImplementation(((a: unknown) => {
    const sess = (a as { where?: { sessionId?: unknown } })?.where?.sessionId
    if (sess && typeof sess === 'object') return Promise.resolve([])
    return Promise.resolve(ids(a).map((id) => ({ productId: id, quantity: 999, expiresAt: new Date(Date.now() + 600_000) })))
  }) as never)
  vi.mocked(prisma.product.updateMany).mockResolvedValue({ count: 1 } as never)
  vi.mocked(prisma.farm.findUnique).mockResolvedValue(HOF as never)
  vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'user_1' } as never)
  vi.mocked(prisma.order.findUnique).mockResolvedValue(null)
  vi.mocked(prisma.order.create).mockImplementation((async ({ data }: { data: Record<string, unknown> }) => ({ id: 'order_1', createdAt: new Date(), ...data })) as never)
  vi.mocked(prisma.order.update).mockResolvedValue({} as never)
  vi.mocked(sendOnsiteConfirmation).mockResolvedValue(undefined)
})

afterEach(() => {
  log.mockRestore()
})

describe('Kasse: Bestellung konnte nicht angelegt werden', () => {
  it('500, genau eine Sentry-Meldung mit Hof und Grund, im Log keine Adresse der Anfrage', async () => {
    vi.mocked(prisma.order.create).mockRejectedValue(new Error(`Unique constraint failed for ${KUNDIN}`))

    const antwort = await kasse(anfrage())

    expect(antwort.status).toBe(500)
    expect(melde).toHaveBeenCalledTimes(1)
    expect(melde.mock.calls[0]?.[1]).toEqual({ tags: { aufgabe: 'checkout', grund: 'bestellung_nicht_angelegt' }, extra: { farmId: 'farm_1' } })
    expect(logText()).toContain('Bestellung konnte nicht angelegt werden')
    expect(logText()).not.toContain('example.com')
  })
})

describe('Kasse: Bestätigungsmail bar scheitert', () => {
  it('200, die Bestellung steht, genau eine Sentry-Meldung mit der Bestellung, im Log keine Adresse', async () => {
    vi.mocked(sendOnsiteConfirmation).mockRejectedValue(new Error(`Resend lehnt ${KUNDIN} ab`))

    const antwort = await kasse(anfrage())
    expect(antwort.status).toBe(200)
    expect(await antwort.json()).toMatchObject({ orderId: 'order_1', requiresConfirmation: true })
    expect(melde).not.toHaveBeenCalled()

    for (const aufgabe of nachlauf.liste) await aufgabe()

    expect(prisma.order.create).toHaveBeenCalledTimes(1)
    expect(melde).toHaveBeenCalledTimes(1)
    expect(melde.mock.calls[0]?.[1]).toEqual({ tags: { aufgabe: 'checkout', grund: 'bar_mail_fehlgeschlagen' }, extra: { orderId: 'order_1' } })
    expect(logText()).not.toContain('example.com')
  })
})

describe('Reservieren: beide Fehlerzweige melden an Sentry', () => {
  it('Freigeben scheitert → 500, eine Meldung mit dem Produkt', async () => {
    vi.mocked(loescheHalte).mockRejectedValue(new Error('Verbindung weg'))

    const antwort = await freigeben(reserveAnfrage('DELETE'))

    expect(antwort.status).toBe(500)
    expect(melde).toHaveBeenCalledTimes(1)
    expect(melde.mock.calls[0]?.[1]).toEqual({ tags: { aufgabe: 'reserve', grund: 'freigeben_fehlgeschlagen' }, extra: { productId: 'prod_1' } })
    expect(logText()).not.toContain('Verbindung weg')
  })

  it('Reservieren scheitert → 500, eine Meldung mit dem Produkt', async () => {
    vi.mocked(prisma.product.findUnique).mockRejectedValue(new Error('Verbindung weg'))

    const antwort = await reservieren(reserveAnfrage('POST'))

    expect(antwort.status).toBe(500)
    expect(melde).toHaveBeenCalledTimes(1)
    expect(melde.mock.calls[0]?.[1]).toEqual({ tags: { aufgabe: 'reserve', grund: 'reservieren_fehlgeschlagen' }, extra: { productId: 'prod_1' } })
    expect(logText()).not.toContain('Verbindung weg')
  })
})
