/**
 * Integrationstest — ein gespeichertes Hof-Konto, das Stripe nicht kennt
 * (Register Z2, Nachtlauf Nr. 42), etwa ein Test-Konto nach der
 * Live-Umstellung.
 *
 * Die Aussage steht in der Datenbank:
 *  - Kasse: Die Online-Bestellung wird storniert, der Bestand ist zurück, die
 *    Halte der Sitzung bleiben — und Bar geht danach sofort. Der Hof gilt als
 *    nicht bereit, die Kennung bleibt stehen; Online bietet der Checkout ihm
 *    nicht mehr an.
 *  - Sentry höchstens einmal je Hof und Tag: gezählt in `RateLimitZaehler`
 *    über alle Instanzen, auch bei zwei gleichzeitigen Fällen.
 *  - Der Vermerk trifft nur dieselbe Kennung: Ein inzwischen neu
 *    eingerichtetes Konto bleibt bereit.
 *
 * Echt sind Datenbank, Transaktionen, Checkout-Handler und Drossel. Gemockt
 * sind Stripe (es meldet das Zielkonto als unbekannt), Mail und Sentry.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendOnsiteConfirmation: vi.fn(), sendBestellungVerfallen: vi.fn() }))
vi.mock('@/lib/stripe', () => ({
  stripe: { paymentIntents: { create: vi.fn(), retrieve: vi.fn(), cancel: vi.fn() } },
}))

import Stripe from 'stripe'
import * as Sentry from '@sentry/nextjs'
import { POST as checkout } from '@/app/api/checkout/route'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { stripe } from '@/lib/stripe'
import { DB_BREMSEN, bremsSchluessel } from '@/lib/bremse-datenbank'
import { hofKontoUnbekanntText } from '@/lib/stripe-konto'
import { vermerkeUnbekanntesHofKonto } from '@/server/hofkonto-unbekannt'
import { checkoutAnfrage, erstelleHof, erstelleProdukt, intKennung, raeumeAuf, setzeHalt } from './setup/basis'

const anlegen = vi.mocked(stripe.paymentIntents.create)
const BESTAND = 5
const MENGE = 2

/** Die Drossel-Zeilen der Höfe dieses Tests — sie tragen kein int-Präfix (der Schlüssel ist ein Hash). */
const drosselHoefe: string[] = []
const drosselSchluessel = (farmId: string) => bremsSchluessel(env.BETTER_AUTH_SECRET, DB_BREMSEN.stripeKontoUnbekannt.zweck, farmId)

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(async () => {
  await prisma.rateLimitZaehler.deleteMany({ where: { schluessel: { in: drosselHoefe.map(drosselSchluessel) } } })
  drosselHoefe.length = 0
  await raeumeAuf()
})

const unbekannt = (konto: string) =>
  new Stripe.errors.StripeInvalidRequestError({
    type: 'invalid_request_error',
    code: 'resource_missing',
    message: `No such destination: '${konto}'`,
    param: 'transfer_data[destination]',
    statusCode: 400,
  })

async function onlineHof() {
  const konto = intKennung('acct')
  const { farm } = await erstelleHof({ acceptsOnline: true, stripeAccountReady: true, stripeAccountId: konto })
  drosselHoefe.push(farm.id)
  const produkt = await erstelleProdukt(farm.id, { stock: BESTAND, price: 10 })
  return { farm, produkt, konto }
}

const hofStand = (farmId: string) =>
  prisma.farm.findUniqueOrThrow({ where: { id: farmId }, select: { stripeAccountId: true, stripeAccountReady: true } })
const bestand = async (produktId: string) => (await prisma.product.findUniqueOrThrow({ where: { id: produktId } })).stock
const meldungenFuer = (farmId: string) =>
  vi.mocked(Sentry.captureMessage).mock.calls.filter(([, kontext]) => JSON.stringify(kontext).includes(farmId)).length

describe('Kasse: Stripe kennt das Zielkonto nicht', () => {
  it('storniert, bucht zurück, lässt die Halte stehen — der Hof ist nicht bereit, die Kennung bleibt', async () => {
    const { farm, produkt, konto } = await onlineHof()
    const sitzung = intKennung('sitzung')
    await setzeHalt(produkt.id, sitzung, MENGE)
    anlegen.mockRejectedValue(unbekannt(konto))
    const schluessel = intKennung('idem')

    const antwort = await checkout(
      checkoutAnfrage({
        farm,
        sessionId: sitzung,
        idempotencyKey: schluessel,
        paymentMethod: 'ONLINE',
        positionen: [{ productId: produkt.id, name: 'Testprodukt', quantity: MENGE, unitPrice: 10 }],
      })
    )

    expect(antwort.status).toBe(503)
    expect(await antwort.json()).toEqual({
      code: 'ZAHLUNG_NICHT_MOEGLICH',
      error: hofKontoUnbekanntText(true),
      onlineAus: true,
    })
    expect((await prisma.order.findUniqueOrThrow({ where: { idempotencyKey: schluessel } })).status).toBe('CANCELLED')
    expect(await bestand(produkt.id)).toBe(BESTAND)
    expect(await prisma.stockReservation.count({ where: { sessionId: sitzung } })).toBe(1)
    expect(await hofStand(farm.id)).toEqual({ stripeAccountId: konto, stripeAccountReady: false })
    expect(meldungenFuer(farm.id)).toBe(1)
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('danach bietet der Checkout Online nicht mehr an — und Bar geht sofort mit denselben Halten', async () => {
    const { farm, produkt, konto } = await onlineHof()
    const sitzung = intKennung('sitzung')
    await setzeHalt(produkt.id, sitzung, MENGE)
    anlegen.mockRejectedValue(unbekannt(konto))
    const position = [{ productId: produkt.id, name: 'Testprodukt', quantity: MENGE, unitPrice: 10 }]
    await checkout(checkoutAnfrage({ farm, sessionId: sitzung, idempotencyKey: intKennung('idem'), paymentMethod: 'ONLINE', positionen: position }))
    anlegen.mockClear()

    const nochmalOnline = await checkout(
      checkoutAnfrage({ farm, sessionId: sitzung, idempotencyKey: intKennung('idem'), paymentMethod: 'ONLINE', positionen: position })
    )
    const bar = await checkout(
      checkoutAnfrage({ farm, sessionId: sitzung, idempotencyKey: intKennung('idem'), paymentMethod: 'ONSITE_CASH', positionen: position })
    )

    expect(nochmalOnline.status).toBe(400)
    expect(anlegen).not.toHaveBeenCalled()
    expect(bar.status).toBe(200)
    expect(await bar.json()).toMatchObject({ requiresConfirmation: true })
    expect(await bestand(produkt.id)).toBe(BESTAND - MENGE)
  })
})

describe('Sentry höchstens einmal je Hof und Tag', () => {
  it('derselbe Hof zweimal: eine Meldung; ein anderer Hof: seine eigene', async () => {
    const a = await onlineHof()
    const b = await onlineHof()

    await vermerkeUnbekanntesHofKonto(a.farm.id, a.konto)
    await vermerkeUnbekanntesHofKonto(a.farm.id, a.konto)
    await vermerkeUnbekanntesHofKonto(b.farm.id, b.konto)

    expect(meldungenFuer(a.farm.id)).toBe(1)
    expect(meldungenFuer(b.farm.id)).toBe(1)
  })

  it('zwei gleichzeitige Fälle (zwei Instanzen): genau eine Meldung, beide gezählt', async () => {
    const { farm, konto } = await onlineHof()

    await Promise.all([vermerkeUnbekanntesHofKonto(farm.id, konto), vermerkeUnbekanntesHofKonto(farm.id, konto)])

    expect(meldungenFuer(farm.id)).toBe(1)
    const zeilen = await prisma.rateLimitZaehler.findMany({ where: { schluessel: drosselSchluessel(farm.id) } })
    expect(zeilen.map((z) => z.zaehler)).toEqual([2])
  })

  it('die Zeile trägt weder Hof-ID noch Konto-Kennung im Klartext', async () => {
    const { farm, konto } = await onlineHof()

    await vermerkeUnbekanntesHofKonto(farm.id, konto)

    const zeilen = await prisma.rateLimitZaehler.findMany({ where: { schluessel: drosselSchluessel(farm.id) } })
    expect(zeilen).toHaveLength(1)
    expect(zeilen[0].schluessel).not.toContain(farm.id)
    expect(zeilen[0].schluessel).not.toContain(konto)
  })
})

describe('der Vermerk trifft nur dieselbe Kennung', () => {
  it('ein inzwischen neu eingerichtetes Konto bleibt bereit', async () => {
    const { farm } = await onlineHof()
    const neu = intKennung('acct')
    await prisma.farm.update({ where: { id: farm.id }, data: { stripeAccountId: neu, stripeAccountReady: true } })

    await vermerkeUnbekanntesHofKonto(farm.id, intKennung('acct-alt'))

    expect(await hofStand(farm.id)).toEqual({ stripeAccountId: neu, stripeAccountReady: true })
  })
})
