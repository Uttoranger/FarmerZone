/**
 * Integrationstest — Register B1 (Nachtlauf 19a): keine Servicegebühr bei
 * Barzahlung bis zum SEPA-Start, in der echten Datenbank.
 *
 * Aussagen über den ZUSTAND danach:
 *  - Checkout bar vor dem Stichtag: Snapshot 0 Cent, Prozent und
 *    Mindestgebühr leer, kein Stripe. Online beim selben Hof: Gebühr im
 *    Snapshot und genau dieser Betrag bei Stripe.
 *  - Admin-Hofliste (rohes SQL) und Finanzseite (finanzen.ts) zählen
 *    Barbestellungen vor dem Stichtag nicht als geschuldet — auch eine ältere
 *    mit Gebühr nicht — und ab dem Stichtag wie bisher. Beide Sichten geben
 *    für denselben Monat dieselbe Summe.
 *
 * Der Checkout nimmt die Systemuhr (TESTING_GUIDELINES, „Zeit in der
 * Integrationsschicht"); die Checkout-Fälle laufen deshalb nur vor dem
 * Stichtag. Die Finanz-Fälle setzen `createdAt` selbst und laufen immer.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendOnsiteConfirmation: vi.fn(), sendBestellungVerfallen: vi.fn() }))
vi.mock('@/lib/stripe', () => ({
  stripe: { paymentIntents: { create: vi.fn(), retrieve: vi.fn(), cancel: vi.fn() } },
}))

import { POST as checkout } from '@/app/api/checkout/route'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { sendOnsiteConfirmation } from '@/lib/email'
import { BAR_SERVICEGEBUEHR_AB } from '@/lib/konditionen'
import { getAdminFarms } from '@/server/queries/admin'
import { getFinanzen } from '@/server/queries/finanzen'
import { checkoutAnfrage, erstelleHof, erstelleProdukt, intKennung, raeumeAuf, setzeHalt } from './setup/basis'

const anlegen = vi.mocked(stripe.paymentIntents.create)

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(async () => {
  await raeumeAuf()
})

/** Hof mit Gebühr nach E4 und fertiger Online-Zahlung. */
async function hofMitGebuehr() {
  const { farm } = await erstelleHof({
    serviceFeePercent: 5,
    serviceFeeMinCents: 50,
    serviceFeeActiveFrom: new Date('2026-09-01T00:00:00.000Z'),
    acceptsOnline: true,
    stripeAccountReady: true,
    stripeAccountId: intKennung('acct'),
  })
  const produkt = await erstelleProdukt(farm.id, { stock: 10, price: 10 })
  return { farm, produkt }
}

const VOR_DEM_STICHTAG = Date.now() < BAR_SERVICEGEBUEHR_AB.getTime()

describe.runIf(VOR_DEM_STICHTAG)('Checkout vor dem Stichtag — echte Datenbank', () => {
  it('bar: 0 Cent, Prozent und Mindestgebühr leer, kein Stripe, die Mail kennt 0', async () => {
    const { farm, produkt } = await hofMitGebuehr()
    const sitzung = intKennung('sitzung')
    await setzeHalt(produkt.id, sitzung, 2)

    const antwort = await checkout(
      checkoutAnfrage({
        farm,
        sessionId: sitzung,
        paymentMethod: 'ONSITE_CASH',
        positionen: [{ productId: produkt.id, name: 'Testprodukt', quantity: 2, unitPrice: 10 }],
      })
    )

    expect(antwort.status).toBe(200)
    const bestellt = await prisma.order.findFirstOrThrow({ where: { farmId: farm.id } })
    expect(bestellt.totalAmount.toFixed(2)).toBe('20.00')
    expect(bestellt.serviceFeeCents).toBe(0)
    expect(bestellt.serviceFeePercentApplied).toBeNull()
    expect(bestellt.serviceFeeMinCentsApplied).toBeNull()
    expect(anlegen).not.toHaveBeenCalled()
    expect(sendOnsiteConfirmation).toHaveBeenCalledWith(expect.objectContaining({ serviceFeeCents: 0 }), expect.any(String))
  })

  it('online beim selben Hof: Gebühr im Snapshot, Stripe bekommt Warenpreis + Gebühr', async () => {
    const { farm, produkt } = await hofMitGebuehr()
    const sitzung = intKennung('sitzung')
    await setzeHalt(produkt.id, sitzung, 2)
    anlegen.mockResolvedValue({ id: intKennung('pi'), client_secret: 'cs_test' } as never)

    const antwort = await checkout(
      checkoutAnfrage({
        farm,
        sessionId: sitzung,
        paymentMethod: 'ONLINE',
        positionen: [{ productId: produkt.id, name: 'Testprodukt', quantity: 2, unitPrice: 10 }],
      })
    )

    expect(antwort.status).toBe(200)
    expect(await antwort.json()).toMatchObject({ amountCents: 2100, serviceFeeCents: 100 })
    const bestellt = await prisma.order.findFirstOrThrow({ where: { farmId: farm.id } })
    expect(bestellt.serviceFeeCents).toBe(100)
    expect(bestellt.serviceFeeMinCentsApplied).toBe(50)
    expect(anlegen.mock.calls[0]![0]).toMatchObject({ amount: 2100, application_fee_amount: 100 })
  })
})

describe('Admin-Summen — Barbestellungen vor dem Stichtag zählen nicht als geschuldet', () => {
  const JAENNER = new Date('2027-01-20T10:00:00.000Z')
  const FEBRUAR = new Date('2027-02-10T10:00:00.000Z')

  async function abgeholt(farmId: string, felder: { createdAt: Date; paymentMethod: 'ONSITE_CASH' | 'ONSITE_CARD' | 'ONLINE'; gebuehrCents: number }) {
    const online = felder.paymentMethod === 'ONLINE'
    await prisma.order.create({
      data: {
        orderNumber: intKennung('bestellung').toUpperCase(),
        farmId,
        customerEmail: `${intKennung('kundin')}@example.com`,
        customerName: 'Erika Mustermann',
        customerPhone: '+43 660 0000000',
        status: 'PICKED_UP',
        totalAmount: 20,
        pickupDate: felder.createdAt,
        pickupTimeStart: '15:00',
        pickupTimeEnd: '18:00',
        paymentMethod: felder.paymentMethod,
        paymentStatus: online ? 'PAID' : 'PENDING',
        serviceFeeCents: felder.gebuehrCents,
        serviceFeePercentApplied: felder.gebuehrCents > 0 ? 5 : null,
        createdAt: felder.createdAt,
      },
    })
  }

  it('Jänner: bar nichts (auch nicht die ältere mit Gebühr), Karte und online wie bisher; Februar: bar wieder geschuldet', async () => {
    const { farm } = await erstelleHof()
    await abgeholt(farm.id, { createdAt: JAENNER, paymentMethod: 'ONSITE_CASH', gebuehrCents: 0 }) // B1
    await abgeholt(farm.id, { createdAt: JAENNER, paymentMethod: 'ONSITE_CASH', gebuehrCents: 100 }) // älter, nicht eingezogen
    await abgeholt(farm.id, { createdAt: JAENNER, paymentMethod: 'ONSITE_CARD', gebuehrCents: 70 }) // B1 nennt Karte nicht
    await abgeholt(farm.id, { createdAt: JAENNER, paymentMethod: 'ONLINE', gebuehrCents: 52 })
    await abgeholt(farm.id, { createdAt: FEBRUAR, paymentMethod: 'ONSITE_CASH', gebuehrCents: 100 })

    const jaenner = (await getAdminFarms(JAENNER)).find((f) => f.id === farm.id)
    expect(jaenner?.monat).toEqual({ bestellungen: 4, gebuehrOnlineCents: 52, gebuehrBarCents: 70, gebuehrEntfallenCents: 0 })
    const februar = (await getAdminFarms(FEBRUAR)).find((f) => f.id === farm.id)
    expect(februar?.monat).toEqual({ bestellungen: 1, gebuehrOnlineCents: 0, gebuehrBarCents: 100, gebuehrEntfallenCents: 0 })

    // Die Finanzseite rechnet dieselbe Regel in TypeScript: dieselben Summen.
    // (Im Fenster liegen nur die Bestellungen dieses Tests — der Seed bestellt nicht in 2027.)
    const finanzenJaenner = await getFinanzen('2027-01', FEBRUAR)
    expect(finanzenJaenner.einnahmen).toMatchObject({ eingezogenCents: 52, geschuldetCents: 70, erwartetCents: 0, bestellungen: 2 })
    const finanzenFebruar = await getFinanzen('2027-02', FEBRUAR)
    expect(finanzenFebruar.einnahmen).toMatchObject({ eingezogenCents: 0, geschuldetCents: 100, bestellungen: 1 })
  })
})
