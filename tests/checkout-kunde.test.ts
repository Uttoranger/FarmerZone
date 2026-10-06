/**
 * Kein Kundenkonto im Checkout (E8, Nr. 17a) — am echten Handler, Prisma,
 * Stripe und Mail gemockt.
 *
 * Beweist: /api/checkout legt kein Konto an und hängt keine Bestellung an ein
 * Konto — auch nicht an ein bestehendes mit derselben Adresse, und zwei
 * Bestellungen mit gleicher Adresse verknüpft nichts miteinander. Wer die
 * Kundin ist, sagt allein die bereinigte, klein geschriebene `customerEmail`
 * (emailSchema); Name und Telefon stehen als Momentaufnahme auf der
 * Bestellung. Vorher entstand hier ein ruhendes CUSTOMER-Konto bzw. die
 * Bestellung landete am Konto, das zufällig dieselbe Adresse trug — auch am
 * Konto eines Hofs (Morgenbericht Lauf 3, Folge 2).
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
// (tests/integration/verwaiste-bestellungen.int.test.ts); hier zählt nur, dass kein Konto entsteht.
vi.mock('@/server/verwaiste-bestellungen', () => ({ gibVerwaisteFreiOhneRisiko: vi.fn() }))
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
    order: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    customerFarmSubscription: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}))

import { POST } from '@/app/api/checkout/route'
import { prisma } from '@/lib/prisma'
import { bestellLinkGilt } from '@/lib/bestell-link'
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
let kunden: Map<string, { id: string; role: string }>

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

/** Die Daten, mit denen die n-te Bestellung angelegt wurde. */
const bestellDaten = (n: number): { customerId?: unknown; customer?: unknown; customerEmail: string } =>
  (orderCreate.mock.calls[n][0] as { data: { customerId?: unknown; customer?: unknown; customerEmail: string } }).data

/** Hängt die Bestellung an irgendeinem Konto? Fehlt das Feld, schreibt Prisma null. */
const amKonto = (n: number): boolean => {
  const daten = bestellDaten(n)
  return (daten.customerId !== undefined && daten.customerId !== null) || daten.customer !== undefined
}

/** Name des Produkts in der „Datenbank" — der Checkout liest ihn aus Product.name. */
let produktName = 'Erdäpfel'

beforeEach(() => {
  vi.clearAllMocks()
  kunden = new Map()
  produktName = 'Erdäpfel'
  farmFindUnique.mockResolvedValue(HOF as never)
  productFindMany.mockImplementation(((a: unknown) =>
    Promise.resolve(ids(a).map((id) => ({ id, name: produktName, stock: 999, isAvailable: true, price: 5, abgabe: 'ALLE', vatRate: 10 })))) as never)
  reservationFindMany.mockImplementation(((a: unknown) => {
    const sitzung = (a as { where?: { sessionId?: unknown } })?.where?.sessionId
    if (sitzung && typeof sitzung === 'object') return Promise.resolve([]) // fremde Sitzungen
    return Promise.resolve(ids(a).map((id) => ({ productId: id, quantity: 999, expiresAt: new Date(Date.now() + 600_000) })))
  }) as never)
  productUpdateMany.mockResolvedValue({ count: 1 } as never)
  userFindUnique.mockImplementation((({ where }: { where: { email: string } }) =>
    Promise.resolve(kunden.get(where.email) ?? null)) as never)
  userCreate.mockImplementation((({ data }: { data: { email: string } }) => {
    const kunde = { id: `kunde_${kunden.size + 1}`, role: 'CUSTOMER' }
    kunden.set(data.email, kunde)
    return Promise.resolve(kunde)
  }) as never)
  orderFindUnique.mockResolvedValue(null)
  orderCreate.mockResolvedValue({ id: 'order_1', createdAt: new Date() } as never)
  orderUpdate.mockResolvedValue({} as never)
  vi.mocked(sendOnsiteConfirmation).mockResolvedValue(undefined as never)
})

describe('Kein Kundenkonto im Checkout (E8)', () => {
  it('legt beim Bestellen kein Konto an und hängt die Bestellung an keines', async () => {
    const res = await POST(anfrage())

    expect(res.status).toBe(200)
    expect(userCreate).not.toHaveBeenCalled()
    expect(kunden.size).toBe(0)
    expect(amKonto(0)).toBe(false)
  })

  it('zwei Bestellungen mit gleicher Adresse (verschieden geschrieben) verknüpfen nichts', async () => {
    const erste = await POST(anfrage({ customerEmail: 'Max.Mustermann@Example.org' }))
    const zweite = await POST(anfrage({ customerEmail: 'max.mustermann@example.org' }))

    expect(erste.status).toBe(200)
    expect(zweite.status).toBe(200)
    expect(amKonto(0)).toBe(false)
    expect(amKonto(1)).toBe(false)
    expect(userCreate).not.toHaveBeenCalled()
    expect(kunden.size).toBe(0)
  })

  it('ein bestehendes Konto mit derselben Adresse bekommt die Bestellung nicht — auch nicht das eines Hofs', async () => {
    kunden.set('max.mustermann@example.org', { id: 'hof_inhaber', role: 'FARMER' })

    const res = await POST(anfrage({ customerEmail: 'MAX.MUSTERMANN@EXAMPLE.ORG' }))

    expect(res.status).toBe(200)
    expect(amKonto(0)).toBe(false)
    expect(userFindUnique).not.toHaveBeenCalled()
    expect(userCreate).not.toHaveBeenCalled()
  })

  it('speichert die bereinigte, klein geschriebene Adresse samt Name und Telefon auf der Bestellung', async () => {
    const res = await POST(anfrage({ customerEmail: ' Max.Mustermann@Example.ORG ' }))

    expect(res.status).toBe(200)
    expect(bestellDaten(0)).toMatchObject({
      customerEmail: 'max.mustermann@example.org',
      customerName: 'Max Mustermann',
      customerPhone: '+43 660 0000000',
    })
  })
})

describe('Weg zur Bestätigungsseite', () => {
  it('die Antwort trägt den signierten Pfad der Bestätigungsseite — Formular und Stripe nehmen genau ihn', async () => {
    const res = await POST(anfrage())

    const { bestaetigung } = await res.json()
    const ziel = new URL(bestaetigung, 'http://localhost')
    expect(ziel.pathname).toBe('/hof-test/confirm/order_1')
    expect(bestellLinkGilt('order_1', ziel.searchParams.get('sig') ?? '')).toBe(true)
  })

  it('Stripe hängt seine Parameter an — die Signatur bleibt gültig', async () => {
    const { bestaetigung } = await (await POST(anfrage())).json()

    const rueckkehr = new URL(`http://localhost${bestaetigung}&payment_intent=pi_1&redirect_status=succeeded`)
    expect(bestellLinkGilt('order_1', rueckkehr.searchParams.get('sig') ?? '')).toBe(true)
  })
})

describe('Obergrenzen am Checkout-Handler', () => {
  it('lehnt eine Notiz über 500 Zeichen ab, ohne Bestand zu buchen oder eine Bestellung anzulegen', async () => {
    const res = await POST(anfrage({ customerNote: 'x'.repeat(501) }))

    expect(res.status).toBe(400)
    expect(productUpdateMany).not.toHaveBeenCalled()
    expect(orderCreate).not.toHaveBeenCalled()
  })

  it('nimmt ein Produkt mit zu langem Altnamen an und kürzt nur die Momentaufnahme', async () => {
    // Der Name kommt aus der Datenbank (Product.name), nicht aus dem Request.
    produktName = 'x'.repeat(130)
    const res = await POST(anfrage({ items: [{ productId: 'prod_1', quantity: 1, unitPrice: 5 }] }))

    expect(res.status).toBe(200)
    const daten = (orderCreate.mock.calls[0][0] as { data: { items: { create: { productName: string }[] } } }).data
    expect(daten.items.create[0].productName).toBe('x'.repeat(100))
  })

  it('nimmt eine Notiz mit genau 500 Zeichen an', async () => {
    const res = await POST(anfrage({ customerNote: 'x'.repeat(500) }))

    expect(res.status).toBe(200)
    expect(orderCreate).toHaveBeenCalledTimes(1)
  })
})
