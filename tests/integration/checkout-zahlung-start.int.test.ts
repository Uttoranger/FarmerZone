/**
 * Integrationstest — der Start der Online-Zahlung im Checkout.
 *
 * Die Aussage: Scheitert Stripe beim Anlegen des PaymentIntents, bleibt keine
 * Bestellung mit gebuchtem Bestand ohne Zahlungsweg zurück. Und eine
 * Wiederholung mit demselben Idempotenz-Schlüssel hängt nie für immer in
 * „wird gerade angelegt".
 *
 * Vorher: `paymentIntents.create` stand nach Bestellung und Bestandsbuchung
 * ohne try und ohne Stripe-Schlüssel. Ein Stripe-Fehler (Ausfall, Hof-Konto
 * eingeschränkt) hinterließ beides; jede Wiederholung bekam 409.
 *
 * Echt sind Datenbank, Transaktion und Checkout-Handler. Gemockt sind Stripe
 * und Mail — kein Netz, kein Geld.
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
import { checkoutAnfrage, erstelleHof, erstelleProdukt, intKennung, raeumeAuf, setzeHalt } from './setup/basis'

const anlegen = vi.mocked(stripe.paymentIntents.create)
const abbrechen = vi.mocked(stripe.paymentIntents.cancel)

/** Fester Schlüssel je Bestellung, kurze Leine (route.ts, intentOptionen). */
const optionen = (orderId: string) => ({ idempotencyKey: `pi-${orderId}`, timeout: 20_000, maxNetworkRetries: 2 })

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(async () => {
  await raeumeAuf()
})

const BESTAND = 5
const MENGE = 2

async function onlineHof() {
  const { farm } = await erstelleHof({
    acceptsOnline: true,
    stripeAccountReady: true,
    stripeAccountId: intKennung('acct'),
  })
  const produkt = await erstelleProdukt(farm.id, { stock: BESTAND, price: 10 })
  return { farm, produkt }
}

async function bestand(produktId: string) {
  return (await prisma.product.findUniqueOrThrow({ where: { id: produktId } })).stock
}

describe('Stripe scheitert beim Anlegen des PaymentIntents', () => {
  it('storniert die Bestellung, bucht den Bestand zurück und antwortet 503 mit Code', async () => {
    const { farm, produkt } = await onlineHof()
    const sitzung = intKennung('sitzung')
    await setzeHalt(produkt.id, sitzung, MENGE)
    anlegen.mockRejectedValue(new Error('Stripe nicht erreichbar'))
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
      error: 'Online-Zahlung ist gerade nicht möglich. Bitte versuch es später oder wähle Barzahlung.',
    })
    const bestellung = await prisma.order.findUniqueOrThrow({ where: { idempotencyKey: schluessel } })
    expect(bestellung).toMatchObject({ status: 'CANCELLED', cancelReason: 'Zahlung konnte nicht gestartet werden' })
    expect(await bestand(produkt.id)).toBe(BESTAND)
    // Stripe bekam einen festen Schlüssel je Bestellung.
    expect(anlegen.mock.calls[0]![1]).toEqual(optionen(bestellung.id))
  })

  it('Stripe meldet 409 (Doppelklick, derselbe Schlüssel läuft gerade): kein Storno, 409 „wird gerade angelegt"', async () => {
    const { farm, produkt } = await onlineHof()
    const sitzung = intKennung('sitzung')
    await setzeHalt(produkt.id, sitzung, MENGE)
    anlegen.mockRejectedValue(Object.assign(new Error('another in-progress request'), { statusCode: 409 }))
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

    expect(antwort.status).toBe(409)
    expect(await antwort.json()).toMatchObject({ code: 'BESTELLUNG_IN_ARBEIT' })
    expect((await prisma.order.findUniqueOrThrow({ where: { idempotencyKey: schluessel } })).status).toBe(
      'PENDING_CONFIRMATION'
    )
    expect(await bestand(produkt.id)).toBe(BESTAND - MENGE)
  })

  it('während des Stripe-Aufrufs storniert: Intent abgebrochen, kein Client-Secret, 503', async () => {
    const { farm, produkt } = await onlineHof()
    const sitzung = intKennung('sitzung')
    await setzeHalt(produkt.id, sitzung, MENGE)
    const schluessel = intKennung('idem')
    anlegen.mockImplementation((async () => {
      // Eine Wiederholung nach der Wartezeit (oder die Frist) war schneller.
      await prisma.order.updateMany({ where: { idempotencyKey: schluessel }, data: { status: 'CANCELLED' } })
      return { id: 'pi_int_zu_spaet', client_secret: 'geheim_zu_spaet' }
    }) as never)

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
    expect(JSON.stringify(await antwort.json())).not.toContain('geheim_zu_spaet')
    expect(abbrechen).toHaveBeenCalledWith(
      'pi_int_zu_spaet',
      { cancellation_reason: 'abandoned' },
      { timeout: 20_000, maxNetworkRetries: 2 }
    )
    expect((await prisma.order.findUniqueOrThrow({ where: { idempotencyKey: schluessel } })).stripePaymentIntentId).toBeNull()
  })

  it('danach geht Barzahlung: Der Halt der Sitzung blieb, die Kundin muss nichts neu reservieren', async () => {
    const { farm, produkt } = await onlineHof()
    const sitzung = intKennung('sitzung')
    await setzeHalt(produkt.id, sitzung, MENGE)
    anlegen.mockRejectedValue(new Error('Stripe nicht erreichbar'))
    const positionen = [{ productId: produkt.id, name: 'Testprodukt', quantity: MENGE, unitPrice: 10 }]

    await checkout(
      checkoutAnfrage({ farm, sessionId: sitzung, idempotencyKey: intKennung('idem'), paymentMethod: 'ONLINE', positionen })
    )
    // Der Browser nimmt nach ZAHLUNG_NICHT_MOEGLICH einen neuen Schlüssel.
    const bar = await checkout(
      checkoutAnfrage({ farm, sessionId: sitzung, idempotencyKey: intKennung('idem'), paymentMethod: 'ONSITE_CASH', positionen })
    )

    expect(bar.status).toBe(200)
    expect(await bestand(produkt.id)).toBe(BESTAND - MENGE)
  })
})

describe('Wiederholung mit demselben Idempotenz-Schlüssel', () => {
  /** Der Zustand, wenn Stripe den Intent anlegte, aber das Speichern der ID scheiterte. */
  async function bestellungOhneIntent(alterSekunden: number, mitKonto = true) {
    const { farm, produkt } = await onlineHof()
    if (!mitKonto) await prisma.farm.update({ where: { id: farm.id }, data: { stripeAccountId: null } })
    // Der Checkout hat den Bestand schon gebucht.
    await prisma.product.update({ where: { id: produkt.id }, data: { stock: BESTAND - MENGE } })
    const schluessel = intKennung('idem')
    const bestellung = await prisma.order.create({
      data: {
        orderNumber: intKennung('bestellung').toUpperCase(),
        idempotencyKey: schluessel,
        farmId: farm.id,
        customerEmail: `${intKennung('kundin')}@example.com`,
        customerName: 'Erika Mustermann',
        customerPhone: '+43 660 0000000',
        status: 'PENDING_CONFIRMATION',
        totalAmount: 10 * MENGE,
        pickupDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        pickupTimeStart: '15:00',
        pickupTimeEnd: '18:00',
        paymentMethod: 'ONLINE',
        paymentStatus: 'PENDING',
        platformFeeAmount: 0,
        serviceFeeCents: 100,
        serviceFeePercentApplied: 4.9,
        createdAt: new Date(Date.now() - alterSekunden * 1000),
        items: {
          create: [
            { productId: produkt.id, productName: 'Testprodukt', unitPrice: 10, quantity: MENGE, totalPrice: 10 * MENGE, vatRate: 10 },
          ],
        },
      },
    })
    const nochmal = () =>
      checkout(
        checkoutAnfrage({
          farm,
          sessionId: intKennung('sitzung'),
          idempotencyKey: schluessel,
          paymentMethod: 'ONLINE',
          positionen: [{ productId: produkt.id, name: 'Testprodukt', quantity: MENGE, unitPrice: 10 }],
        })
      )
    return { farm, produkt, bestellung, nochmal }
  }

  it('Speichern der Intent-ID war gescheitert: derselbe Intent über denselben Stripe-Schlüssel, ID nachgetragen, kein 409', async () => {
    const { farm, bestellung, nochmal } = await bestellungOhneIntent(30)
    anlegen.mockResolvedValue({ id: 'pi_int_derselbe', client_secret: 'geheim_derselbe' } as never)

    const antwort = await nochmal()

    expect(antwort.status).toBe(200)
    expect(await antwort.json()).toMatchObject({ orderId: bestellung.id, clientSecret: 'geheim_derselbe', wiederholt: true })
    // Dieselben Parameter wie beim ersten Anlegen — sonst lehnt Stripe den Schlüssel ab.
    expect(anlegen).toHaveBeenCalledWith(
      {
        amount: 2100,
        currency: 'eur',
        metadata: { orderId: bestellung.id, orderNumber: bestellung.orderNumber, farmId: farm.id },
        transfer_data: { destination: farm.stripeAccountId },
        application_fee_amount: 100,
      },
      optionen(bestellung.id)
    )
    expect((await prisma.order.findUniqueOrThrow({ where: { id: bestellung.id } })).stripePaymentIntentId).toBe(
      'pi_int_derselbe'
    )
  })

  it('älter als zwei Minuten ohne Intent: gescheitert — storniert, Bestand zurück, 503', async () => {
    const { produkt, bestellung, nochmal } = await bestellungOhneIntent(150)

    const antwort = await nochmal()

    expect(antwort.status).toBe(503)
    expect(await antwort.json()).toMatchObject({ code: 'ZAHLUNG_NICHT_MOEGLICH' })
    expect(anlegen).not.toHaveBeenCalled()
    expect(await prisma.order.findUniqueOrThrow({ where: { id: bestellung.id } })).toMatchObject({ status: 'CANCELLED' })
    expect(await bestand(produkt.id)).toBe(BESTAND)
  })

  it('jung und ohne Hof-Konto: noch kein Urteil — 409, nichts storniert', async () => {
    const { bestellung, nochmal } = await bestellungOhneIntent(10, false)

    const antwort = await nochmal()

    expect(antwort.status).toBe(409)
    expect(anlegen).not.toHaveBeenCalled()
    expect((await prisma.order.findUniqueOrThrow({ where: { id: bestellung.id } })).status).toBe('PENDING_CONFIRMATION')
  })

  it('jung und Stripe gerade nicht erreichbar: weiter 409 „wird gerade angelegt", nichts storniert', async () => {
    const { bestellung, nochmal } = await bestellungOhneIntent(10)
    anlegen.mockRejectedValue(new Error('Stripe nicht erreichbar'))

    const antwort = await nochmal()

    expect(antwort.status).toBe(409)
    expect(await antwort.json()).toMatchObject({ code: 'BESTELLUNG_IN_ARBEIT' })
    expect((await prisma.order.findUniqueOrThrow({ where: { id: bestellung.id } })).status).toBe('PENDING_CONFIRMATION')
  })
})

describe('Erfolgsweg', () => {
  it('legt den Intent mit festem Schlüssel an und speichert die ID', async () => {
    const { farm, produkt } = await onlineHof()
    const sitzung = intKennung('sitzung')
    await setzeHalt(produkt.id, sitzung, MENGE)
    anlegen.mockResolvedValue({ id: 'pi_int_neu', client_secret: 'geheim_neu' } as never)
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

    expect(antwort.status).toBe(200)
    const bestellung = await prisma.order.findUniqueOrThrow({ where: { idempotencyKey: schluessel } })
    expect(bestellung.stripePaymentIntentId).toBe('pi_int_neu')
    expect(anlegen.mock.calls[0]![1]).toEqual(optionen(bestellung.id))
    // Erst nach dem Intent räumt der Checkout die Halte der Sitzung ab.
    expect(await prisma.stockReservation.count({ where: { sessionId: sitzung } })).toBe(0)
  })

  it('Wiederholung schickt EXAKT dieselben Parameter wie der erste Aufruf — sonst lehnte Stripe den Schlüssel ab', async () => {
    const { farm, produkt } = await onlineHof()
    const sitzung = intKennung('sitzung')
    await setzeHalt(produkt.id, sitzung, MENGE)
    anlegen.mockResolvedValue({ id: 'pi_int_gleich', client_secret: 'geheim_gleich' } as never)
    const schluessel = intKennung('idem')
    const anfrage = () =>
      checkout(
        checkoutAnfrage({
          farm,
          sessionId: sitzung,
          idempotencyKey: schluessel,
          paymentMethod: 'ONLINE',
          positionen: [{ productId: produkt.id, name: 'Testprodukt', quantity: MENGE, unitPrice: 10 }],
        })
      )

    expect((await anfrage()).status).toBe(200)
    // So, als wäre das Speichern der Intent-ID gescheitert.
    await prisma.order.updateMany({ where: { idempotencyKey: schluessel }, data: { stripePaymentIntentId: null } })
    expect((await anfrage()).status).toBe(200)

    expect(anlegen).toHaveBeenCalledTimes(2)
    expect(anlegen.mock.calls[1]).toEqual(anlegen.mock.calls[0])
  })
})
