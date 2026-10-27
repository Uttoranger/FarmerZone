/**
 * Plattformgebühr im Hofpreis am echten Handler /api/checkout (Register N38,
 * Nr. 197) — Prisma, Stripe (Attrappe, nie live) und Mail gemockt.
 *
 * Beweist: Ab dem Stichtag „Hofpreis-Modell ab“ zahlt die Kundin für denselben
 * Korb online und bar denselben Gesamtbetrag (Ware + Summe der Gebühren je
 * Stück); online gehen amount = Gesamt, application_fee_amount = Gebühr,
 * transfer_data.destination und on_behalf_of = Hofkonto an Stripe — dem Hof
 * bleibt genau der Warenpreis. Mindestbestellwert 10 € (400), bar ohne Weg
 * für die Gebühr 409, Gründungshof vor dem Einzug „erlassen“, ohne
 * Mandatspflicht „ueberweisung“. Vor dem Stichtag bleibt alles wie bisher.
 * Teilstorno: „Artikel fehlt“ zieht genau die Gebühr der Position ab.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/rate-limit', () => ({ enforceRateLimit: vi.fn(() => null) }))
vi.mock('@/lib/stripe', () => ({ stripe: { paymentIntents: { create: vi.fn() } } }))
vi.mock('@/lib/email', () => ({ sendOnsiteConfirmation: vi.fn() }))
// Die Freigabe verwaister Bestellungen hat eigene Tests
// (tests/integration/verwaiste-bestellungen.int.test.ts); hier zählt nur der Checkout.
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
    plattformEinstellung: { findUnique: vi.fn() },
    // Die Platzvergabe der Gründungshöfe (ladeHoefeFuerGruendung) — nur im Hofpreis-Modell ohne Farm.einzugAb gelesen.
    farm: { findUnique: vi.fn(), findMany: vi.fn() },
    product: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    stockReservation: { aggregate: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
    user: { findUnique: vi.fn(), create: vi.fn() },
    order: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      // Der Intent hängt sich bedingt an die offene Bestellung (route.ts, haengeIntentAn).
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    customerFarmSubscription: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}))

import { POST } from '@/app/api/checkout/route'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { sendOnsiteConfirmation } from '@/lib/email'
import { artikelFehltRechnung } from '@/lib/artikel-fehlt'
import { CODE_BAR_NICHT_MOEGLICH, CODE_MINDESTBESTELLWERT } from '@/lib/kasse'
import { BAR_NICHT_MOEGLICH_SATZ, MINDESTBESTELLWERT_SATZ } from '@/lib/konditionen'
import { einstellungsZeile } from './fabrik/plattform-einstellung'

/** Der Stichtag liegt in der Vergangenheit (Admin-Einstellung), die Uhr steht danach. */
const STICHTAG = new Date('2026-10-01T00:00:00.000Z')
const JETZT = new Date('2026-11-15T10:00:00.000Z')

let einzelpreis = 10

function warenkorbBereit() {
  const ids = (a: unknown): string[] => {
    const w = (a as { where?: { id?: { in?: string[] }; productId?: { in?: string[] } } })?.where
    return w?.id?.in ?? w?.productId?.in ?? []
  }
  vi.mocked(prisma.product.findMany).mockImplementation(((a: unknown) =>
    Promise.resolve(ids(a).map((id) => ({ id, name: 'Wels', stock: 999, isAvailable: true, price: einzelpreis })))) as never)
  vi.mocked(prisma.stockReservation.findMany).mockImplementation(((a: unknown) => {
    const sess = (a as { where?: { sessionId?: unknown } })?.where?.sessionId
    // { not: ... } = fremde Sitzungen; die blockieren hier nichts.
    if (sess && typeof sess === 'object') return Promise.resolve([])
    return Promise.resolve(
      ids(a).map((id) => ({ productId: id, quantity: 999, expiresAt: new Date(Date.now() + 600_000) }))
    )
  }) as never)
  vi.mocked(prisma.product.updateMany).mockResolvedValue({ count: 1 } as never)
}


const farmFindUnique = vi.mocked(prisma.farm.findUnique)
const productFindUnique = vi.mocked(prisma.product.findUnique)
const reservationAggregate = vi.mocked(prisma.stockReservation.aggregate)
const userFindUnique = vi.mocked(prisma.user.findUnique)
const orderFindUnique = vi.mocked(prisma.order.findUnique)
const orderCreate = vi.mocked(prisma.order.create)
const orderUpdate = vi.mocked(prisma.order.update)
const productUpdate = vi.mocked(prisma.product.update)
const reservationDeleteMany = vi.mocked(prisma.stockReservation.deleteMany)
const paymentIntentCreate = vi.mocked(stripe.paymentIntents.create)

const HOF = {
  id: 'farm_1',
  name: 'Welszucht Probe',
  slug: 'welszucht-probe',
  email: 'hof@test.local',
  ownerName: 'Franz',
  address: 'Teichweg 1',
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
  // Die Servicegebühr des Modells `bisher` — im Hofpreis-Modell zählt sie nicht.
  serviceFeePercent: { toString: () => '4.90' },
  serviceFeeMinCents: 50,
  serviceFeeActiveFrom: new Date('2026-09-01T00:00:00.000Z'),
  owner: { name: 'Franz' },
  // N38 (Nr. 188): Satz null = 6 %, Einzug abgeleitet, Mandat Pflicht, keins da.
  gruendungBis: null,
  plattformgebuehrProzent: null,
  einzugAb: null,
  barMandatPflicht: true,
  sepaMandatAm: null,
}

function anfrage(overrides: Record<string, unknown> = {}) {
  return new NextRequest('http://localhost/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      farmId: 'farm_1',
      farmSlug: 'welszucht-probe',
      sessionId: 'sid_1',
      customerName: 'Anna Testerin',
      customerEmail: 'anna@test.local',
      customerPhone: '+43 699 0000000',
      customerNote: '',
      pickupDate: '2026-09-25',
      pickupTimeStart: '14:00',
      pickupTimeEnd: '16:00',
      paymentMethod: 'ONLINE',
      items: [{ productId: 'prod_1', name: 'Wels', quantity: 3, unitPrice: 4 }],
      ...overrides,
    }),
  })
}

/** Decimal-Beträge als Zahl — nur für den Vergleich im Test; gerechnet wird im Handler mit Decimal. */
function alsZahl(v: unknown): unknown {
  return v !== null && typeof v === 'object' && 'toFixed' in v ? Number(String(v)) : v
}

function createData(): Record<string, unknown> {
  const data = (orderCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data
  return { ...data, totalAmount: alsZahl(data.totalAmount), platformFeeAmount: alsZahl(data.platformFeeAmount) }
}

function intentParams(): Record<string, unknown> {
  return paymentIntentCreate.mock.calls[0]?.[0] as unknown as Record<string, unknown>
}


function onsiteMail(): Record<string, unknown> {
  return vi.mocked(sendOnsiteConfirmation).mock.calls[0]?.[0] as unknown as Record<string, unknown>
}

function stichtag(ab: Date): void {
  vi.mocked(prisma.plattformEinstellung.findUnique).mockResolvedValue(einstellungsZeile(ab) as never)
}

beforeEach(() => {
  einzelpreis = 4
  warenkorbBereit()
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(JETZT)
  stichtag(STICHTAG)
  vi.mocked(prisma.farm.findMany).mockResolvedValue([] as never)
  farmFindUnique.mockResolvedValue(HOF as never)
  productFindUnique.mockResolvedValue({ id: 'prod_1', stock: 10, isAvailable: true, name: 'Wels', unit: 'KG', unitSize: null } as never)
  reservationAggregate.mockResolvedValue({ _sum: { quantity: 0 } } as never)
  userFindUnique.mockResolvedValue({ id: 'cust_1' } as never)
  orderFindUnique.mockResolvedValue(null)
  orderCreate.mockImplementation((async ({ data }: { data: Record<string, unknown> }) => ({ id: 'order_1', createdAt: new Date(), ...data })) as never)
  orderUpdate.mockResolvedValue({} as never)
  productUpdate.mockResolvedValue({} as never)
  reservationDeleteMany.mockResolvedValue({ count: 0 } as never)
  paymentIntentCreate.mockResolvedValue({ id: 'pi_1', client_secret: 'cs_test' } as never)
  vi.mocked(sendOnsiteConfirmation).mockResolvedValue(undefined)
})

afterEach(() => {
  vi.useRealTimers()
})

/** Die Positionen, wie sie angelegt wurden. */
function positionen(): Array<Record<string, unknown>> {
  return (createData().items as { create: Array<Record<string, unknown>> }).create
}

describe('Hofpreis-Modell: derselbe Korb kostet online und bar dasselbe', () => {
  it('online 3 × 4,00 €: Gebühr 3 × 24 Cent, Stripe bekommt 1272 mit application_fee 72 und on_behalf_of', async () => {
    const res = await POST(anfrage())
    expect(res.status).toBe(200)
    expect(createData()).toEqual(
      expect.objectContaining({
        totalAmount: 12,
        serviceFeeCents: 72,
        serviceFeePercentApplied: '6.00',
        serviceFeeMinCentsApplied: 0,
        gebuehrModell: 'hofpreis',
        gebuehrEinzug: 'stripe',
      })
    )
    expect(positionen()[0]).toEqual(expect.objectContaining({ quantity: 3, gebuehrCents: 72 }))
    expect(intentParams()).toEqual(
      expect.objectContaining({
        amount: 1272,
        application_fee_amount: 72,
        transfer_data: { destination: 'acct_hof' },
        on_behalf_of: 'acct_hof',
      })
    )
    // Der Hof bekommt die volle Überweisung minus application_fee — genau den Warenpreis (100 %).
    const p = intentParams() as { amount: number; application_fee_amount: number }
    expect(p.amount - p.application_fee_amount).toBe(1200)
  })

  it('bar mit Mandat: derselbe Gesamtbetrag 12,72 €, Einzug sepa, kein Stripe', async () => {
    farmFindUnique.mockResolvedValue({ ...HOF, sepaMandatAm: new Date('2026-10-10T00:00:00.000Z') } as never)
    const res = await POST(anfrage({ paymentMethod: 'ONSITE_CASH' }))
    expect(res.status).toBe(200)
    expect(createData()).toEqual(expect.objectContaining({ totalAmount: 12, serviceFeeCents: 72, gebuehrModell: 'hofpreis', gebuehrEinzug: 'sepa' }))
    expect(paymentIntentCreate).not.toHaveBeenCalled()
    expect(onsiteMail()).toEqual(expect.objectContaining({ serviceFeeCents: 72, gebuehrModell: 'hofpreis' }))
  })

  it('mehrere Positionen: je Stück aufgerundet, die Summe der Positionen ist die Gebühr', async () => {
    einzelpreis = 1.01
    warenkorbBereit()
    const res = await POST(anfrage({ items: [{ productId: 'prod_1', name: 'Wels', quantity: 10, unitPrice: 1.01 }] }))
    expect(res.status).toBe(200)
    // 1,01 € × 6 % = 6,06 Cent → 7 Cent je Stück; 10 Stück = 70 Cent (nicht 61 auf die Summe).
    expect(createData()).toEqual(expect.objectContaining({ serviceFeeCents: 70 }))
    expect(intentParams()).toEqual(expect.objectContaining({ amount: 1080, application_fee_amount: 70 }))
  })
})

describe('Mindestbestellwert 10 € Warenwert', () => {
  it('9,99 € → 400 mit dem Satz, nichts angelegt', async () => {
    einzelpreis = 9.99
    warenkorbBereit()
    const res = await POST(anfrage({ items: [{ productId: 'prod_1', name: 'Wels', quantity: 1, unitPrice: 9.99 }] }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: MINDESTBESTELLWERT_SATZ, code: CODE_MINDESTBESTELLWERT })
    expect(orderCreate).not.toHaveBeenCalled()
  })

  it('Gegenprobe: 10,00 € → angelegt', async () => {
    einzelpreis = 10
    warenkorbBereit()
    const res = await POST(anfrage({ items: [{ productId: 'prod_1', name: 'Wels', quantity: 1, unitPrice: 10 }] }))
    expect(res.status).toBe(200)
    expect(createData()).toEqual(expect.objectContaining({ totalAmount: 10, serviceFeeCents: 60 }))
  })
})

describe('Bar nur mit einem Weg für die Gebühr (barMoeglich)', () => {
  it('normaler Hof nach dem Stichtag ohne Mandat: bar → 409 mit neutralem Satz, nichts angelegt', async () => {
    const res = await POST(anfrage({ paymentMethod: 'ONSITE_CASH' }))
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual(expect.objectContaining({ error: BAR_NICHT_MOEGLICH_SATZ, code: CODE_BAR_NICHT_MOEGLICH }))
    expect(orderCreate).not.toHaveBeenCalled()
  })

  it('Gegenprobe: online geht bei demselben Hof', async () => {
    expect((await POST(anfrage())).status).toBe(200)
  })

  it('Mandat nicht Pflicht und keins da: bar mit Einzug ueberweisung', async () => {
    farmFindUnique.mockResolvedValue({ ...HOF, barMandatPflicht: false } as never)
    const res = await POST(anfrage({ paymentMethod: 'ONSITE_CASH' }))
    expect(res.status).toBe(200)
    expect(createData()).toEqual(expect.objectContaining({ serviceFeeCents: 72, gebuehrEinzug: 'ueberweisung' }))
  })

  it('Gründungshof vor seinem Einzug: bar ohne Mandat, Gebühr erlassen — der Betrag bleibt derselbe', async () => {
    farmFindUnique.mockResolvedValue({ ...HOF, gruendungBis: new Date('2027-12-31T12:00:00.000Z') } as never)
    vi.mocked(prisma.farm.findMany).mockResolvedValue([
      {
        id: 'farm_1',
        ownerId: 'owner_1',
        approvedAt: new Date('2026-01-01T00:00:00.000Z'),
        createdAt: new Date('2025-12-01T00:00:00.000Z'),
        archivedAt: null,
        gruendungBis: new Date('2027-12-31T12:00:00.000Z'),
        gruendungAusgenommen: false,
        gruendungPlatz: null,
      },
    ] as never)
    const res = await POST(anfrage({ paymentMethod: 'ONSITE_CASH' }))
    expect(res.status).toBe(200)
    expect(createData()).toEqual(expect.objectContaining({ totalAmount: 12, serviceFeeCents: 72, gebuehrEinzug: 'erlassen' }))
  })

  it('Farm.einzugAb in der Zukunft geht vor: bar erlassen, ohne die Platzvergabe zu lesen', async () => {
    farmFindUnique.mockResolvedValue({ ...HOF, einzugAb: new Date('2027-03-01T00:00:00.000Z') } as never)
    const res = await POST(anfrage({ paymentMethod: 'ONSITE_CASH' }))
    expect(res.status).toBe(200)
    expect(createData()).toEqual(expect.objectContaining({ gebuehrEinzug: 'erlassen' }))
    expect(prisma.farm.findMany).not.toHaveBeenCalled()
  })
})

describe('Vor dem Stichtag: Modell bisher, Beträge und Intent-Parameter unverändert', () => {
  it('online: Servicegebühr 4,9 % wie bisher, kein on_behalf_of, keine Spalten des Hofpreis-Modells', async () => {
    stichtag(new Date('2099-01-01T00:00:00.000Z'))
    const res = await POST(anfrage())
    expect(res.status).toBe(200)
    // 12 € × 4,9 % = 58,8 Cent → 59 Cent (E4).
    expect(createData()).toEqual(expect.objectContaining({ totalAmount: 12, serviceFeeCents: 59, serviceFeePercentApplied: 4.9, gebuehrModell: null, gebuehrEinzug: null }))
    expect(positionen()[0]).toEqual(expect.objectContaining({ gebuehrCents: 0 }))
    expect(intentParams()).toEqual({
      amount: 1259,
      currency: 'eur',
      metadata: { orderId: 'order_1', orderNumber: expect.any(String), farmId: 'farm_1' },
      transfer_data: { destination: 'acct_hof' },
      application_fee_amount: 59,
    })
  })

  it('bar ohne Mandat geht wie bisher (kein Mindestbestellwert, keine Sperre)', async () => {
    stichtag(new Date('2099-01-01T00:00:00.000Z'))
    einzelpreis = 5
    warenkorbBereit()
    const res = await POST(anfrage({ paymentMethod: 'ONSITE_CASH', items: [{ productId: 'prod_1', name: 'Wels', quantity: 1, unitPrice: 5 }] }))
    expect(res.status).toBe(200)
    expect(createData()).toEqual(expect.objectContaining({ totalAmount: 5, gebuehrModell: null }))
  })
})

describe('Teilstorno im Hofpreis-Modell: genau die Gebühr der Position', () => {
  it('online: Eier 2 × 4,50 € (54 Cent) und Brot 5,80 € (35 Cent) — Brot fehlt → 5,80 € + 35 Cent zurück', () => {
    const r = artikelFehltRechnung(
      {
        status: 'PAID',
        paymentMethod: 'ONLINE',
        paymentStatus: 'PAID',
        stripePaymentIntentId: 'pi_test',
        warenpreisCents: 1480,
        serviceFeeCents: 89,
        serviceFeePercentApplied: 6,
        serviceFeeMinCentsApplied: 0,
        erstattetCents: 0,
        bestelltAm: JETZT,
        gebuehrModell: 'hofpreis',
        gebuehrEinzug: 'stripe',
        positionen: [
          { id: 'eier', betragCents: 900, fehlt: false, gebuehrCents: 54 },
          { id: 'brot', betragCents: 580, fehlt: false, gebuehrCents: 35 },
        ],
      },
      'brot'
    )
    expect(r).toEqual(expect.objectContaining({ art: 'teil', neuWarenCents: 900, neuGebuehrCents: 54, gebuehrDifferenzCents: 35, erstattungCents: 615, vomHofCents: 580 }))
  })

  it('Gegenprobe Modell bisher: die Gebühr wird auf den Rest neu gerechnet (E14), nicht abgezogen', () => {
    const r = artikelFehltRechnung(
      {
        status: 'PAID',
        paymentMethod: 'ONLINE',
        paymentStatus: 'PAID',
        stripePaymentIntentId: 'pi_test',
        warenpreisCents: 1480,
        serviceFeeCents: 89,
        serviceFeePercentApplied: 6,
        serviceFeeMinCentsApplied: 50,
        erstattetCents: 0,
        bestelltAm: JETZT,
        positionen: [
          { id: 'eier', betragCents: 900, fehlt: false, gebuehrCents: 0 },
          { id: 'brot', betragCents: 580, fehlt: false, gebuehrCents: 0 },
        ],
      },
      'brot'
    )
    // 9,00 € × 6 % = 54 Cent — hier zufällig gleich; der Weg ist die Neuberechnung.
    expect(r).toEqual(expect.objectContaining({ neuGebuehrCents: 54 }))
  })

  it('bar erlassen: die Monatsabrechnung nimmt nichts; sepa: sie nimmt die neue Gebühr', () => {
    const basis = {
      status: 'CONFIRMED' as const,
      paymentMethod: 'ONSITE_CASH' as const,
      paymentStatus: 'PENDING' as const,
      stripePaymentIntentId: null,
      warenpreisCents: 1480,
      serviceFeeCents: 89,
      serviceFeePercentApplied: 6,
      serviceFeeMinCentsApplied: 0,
      erstattetCents: 0,
      bestelltAm: JETZT,
      gebuehrModell: 'hofpreis',
      positionen: [
        { id: 'eier', betragCents: 900, fehlt: false, gebuehrCents: 54 },
        { id: 'brot', betragCents: 580, fehlt: false, gebuehrCents: 35 },
      ],
    }
    expect(artikelFehltRechnung({ ...basis, gebuehrEinzug: 'erlassen' }, 'brot')).toEqual(expect.objectContaining({ neuGesamtCents: 954, monatsabrechnung: false }))
    expect(artikelFehltRechnung({ ...basis, gebuehrEinzug: 'sepa' }, 'brot')).toEqual(expect.objectContaining({ neuGesamtCents: 954, monatsabrechnung: true }))
  })
})
