/**
 * Integrationstest — verwaiste Bestellungen geben ihren Bestand frei.
 *
 * Der Checkout bucht den Bestand, bevor bezahlt (online) oder bestätigt (bar)
 * wird. Ohne Zahlung, ohne Klick blieb die Bestellung für immer offen und
 * hielt ihre Ware. Jetzt gilt eine Frist (src/lib/fristen.ts), und
 * `gibVerwaisteBestellungenFrei` beendet, was darüber ist — beim Lesen und
 * täglich per Cron.
 *
 * Echt sind Datenbank, Transaktion und `/api/reserve`. Gemockt sind Stripe,
 * Mail und Sentry — kein Netz, kein Geld.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/stripe', () => ({
  stripe: { paymentIntents: { retrieve: vi.fn(), cancel: vi.fn() } },
}))
vi.mock('@/lib/email', () => ({
  sendBestellungVerfallen: vi.fn(),
  sendOrderConfirmation: vi.fn(),
  sendOrderConfirmedToFarmer: vi.fn(),
  sendOnsiteConfirmation: vi.fn(),
}))

import { NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { gibVerwaisteBestellungenFrei, gibVerwaisteFreiFuerSlug } from '@/server/verwaiste-bestellungen'
import { POST as reservieren } from '@/app/api/reserve/route'
import { GET as bestaetigen } from '@/app/api/orders/confirm/[token]/route'
import { POST as bestellen } from '@/app/api/checkout/route'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { sendBestellungVerfallen } from '@/lib/email'
import { checkoutAnfrage, erstelleHof, erstelleProdukt, intKennung, raeumeAuf } from './setup/basis'

const holen = vi.mocked(stripe.paymentIntents.retrieve)
const abbrechen = vi.mocked(stripe.paymentIntents.cancel)

/** Stripe-Zustand je PaymentIntent, wie ihn `retrieve` liefert. */
const intentStatus = new Map<string, string>()

beforeEach(() => {
  vi.clearAllMocks()
  intentStatus.clear()
  holen.mockImplementation((async (id: string) => ({ id, status: intentStatus.get(id) ?? 'requires_payment_method' })) as never)
  abbrechen.mockImplementation((async (id: string) => {
    intentStatus.set(id, 'canceled')
    return { id, status: 'canceled' }
  }) as never)
})

afterEach(async () => {
  await raeumeAuf()
})

const MENGE = 2
const BESTAND_NACH_CHECKOUT = 5
const MINUTE = 60 * 1000

/** Eine offene Bestellung, wie der Checkout sie hinterlässt — Bestand schon gebucht. */
async function offeneBestellung(eingabe: {
  zahlart: 'ONLINE' | 'ONSITE_CASH'
  bestelltVorMinuten: number
  bestand?: number
  mitIntent?: boolean
}) {
  const { farm } = await erstelleHof({ acceptsOnline: true })
  const produkt = await erstelleProdukt(farm.id, { stock: eingabe.bestand ?? BESTAND_NACH_CHECKOUT })
  const paymentIntentId = eingabe.zahlart === 'ONLINE' && eingabe.mitIntent !== false ? intKennung('pi') : null

  const bestellung = await prisma.order.create({
    data: {
      orderNumber: intKennung('bestellung').toUpperCase(),
      farmId: farm.id,
      customerEmail: `${intKennung('kundin')}@example.com`,
      customerName: 'Erika Mustermann',
      customerPhone: '+43 660 0000000',
      status: 'PENDING_CONFIRMATION',
      totalAmount: 10 * MENGE,
      // Abholung in drei Tagen — der Bestellschluss liegt weit hinter der Frist.
      pickupDate: new Date(Date.now() + 3 * 24 * 60 * MINUTE),
      pickupTimeStart: '15:00',
      pickupTimeEnd: '18:00',
      paymentMethod: eingabe.zahlart,
      paymentStatus: 'PENDING',
      stripePaymentIntentId: paymentIntentId,
      confirmationToken: eingabe.zahlart === 'ONLINE' ? null : intKennung('token'),
      platformFeeAmount: 0,
      serviceFeeCents: 100,
      serviceFeePercentApplied: 4.9,
      createdAt: new Date(Date.now() - eingabe.bestelltVorMinuten * MINUTE),
      items: {
        create: [
          {
            productId: produkt.id,
            productName: 'Testprodukt',
            unitPrice: 10,
            quantity: MENGE,
            totalPrice: 10 * MENGE,
            vatRate: 10,
          },
        ],
      },
    },
  })

  return { farm, produkt, bestellung, paymentIntentId }
}

async function bestand(produktId: string) {
  return (await prisma.product.findUniqueOrThrow({ where: { id: produktId } })).stock
}

async function zustand(bestellungId: string) {
  return prisma.order.findUniqueOrThrow({ where: { id: bestellungId } })
}

describe('online — Zahlungsfrist 30 Minuten', () => {
  it('abgelaufen: Intent abgebrochen, storniert, Bestand einmal zurück', async () => {
    const { farm, produkt, bestellung, paymentIntentId } = await offeneBestellung({
      zahlart: 'ONLINE',
      bestelltVorMinuten: 31,
    })

    await gibVerwaisteBestellungenFrei(new Date(), farm.id)

    expect(abbrechen).toHaveBeenCalledTimes(1)
    expect(abbrechen).toHaveBeenCalledWith(paymentIntentId, { cancellation_reason: 'abandoned' })
    const danach = await zustand(bestellung.id)
    expect(danach.status).toBe('CANCELLED')
    expect(danach.cancelledAt).not.toBeNull()
    expect(await bestand(produkt.id)).toBe(BESTAND_NACH_CHECKOUT + MENGE)
    // Online gibt es keine Mail — die Kundin hat die Zahlung selbst nicht abgeschlossen.
    expect(sendBestellungVerfallen).not.toHaveBeenCalled()
  })

  it('noch in der Frist: unberührt, Stripe wird nicht gefragt', async () => {
    const { farm, produkt, bestellung } = await offeneBestellung({ zahlart: 'ONLINE', bestelltVorMinuten: 29 })

    await gibVerwaisteBestellungenFrei(new Date(), farm.id)

    expect(holen).not.toHaveBeenCalled()
    expect((await zustand(bestellung.id)).status).toBe('PENDING_CONFIRMATION')
    expect(await bestand(produkt.id)).toBe(BESTAND_NACH_CHECKOUT)
  })

  it('Intent inzwischen bezahlt: bleibt unangetastet — der Webhook gewinnt', async () => {
    const { farm, produkt, bestellung, paymentIntentId } = await offeneBestellung({
      zahlart: 'ONLINE',
      bestelltVorMinuten: 45,
    })
    intentStatus.set(paymentIntentId!, 'succeeded')

    await gibVerwaisteBestellungenFrei(new Date(), farm.id)

    expect(abbrechen).not.toHaveBeenCalled()
    expect((await zustand(bestellung.id)).status).toBe('PENDING_CONFIRMATION')
    expect(await bestand(produkt.id)).toBe(BESTAND_NACH_CHECKOUT)
  })

  it('bezahlt, Webhook steht aus: Stripe wird höchstens alle fünf Minuten gefragt', async () => {
    const { farm, bestellung, paymentIntentId } = await offeneBestellung({ zahlart: 'ONLINE', bestelltVorMinuten: 45 })
    intentStatus.set(paymentIntentId!, 'succeeded')
    const jetzt = new Date()

    const erster = await gibVerwaisteBestellungenFrei(jetzt, farm.id)
    await gibVerwaisteBestellungenFrei(new Date(jetzt.getTime() + 60 * 1000), farm.id)
    await gibVerwaisteBestellungenFrei(new Date(jetzt.getTime() + 4 * MINUTE), farm.id)

    expect(holen).toHaveBeenCalledTimes(1)
    expect(erster.uebersprungenIds).toEqual([bestellung.id])

    await gibVerwaisteBestellungenFrei(new Date(jetzt.getTime() + 6 * MINUTE), farm.id)
    expect(holen).toHaveBeenCalledTimes(2)
  })

  it('Intent wird gerade bezahlt (processing): bleibt unangetastet', async () => {
    const { farm, bestellung, paymentIntentId } = await offeneBestellung({ zahlart: 'ONLINE', bestelltVorMinuten: 45 })
    intentStatus.set(paymentIntentId!, 'processing')

    await gibVerwaisteBestellungenFrei(new Date(), farm.id)

    expect(abbrechen).not.toHaveBeenCalled()
    expect((await zustand(bestellung.id)).status).toBe('PENDING_CONFIRMATION')
  })

  it('Abbruch scheitert, weil die Zahlung genau jetzt durchging: unangetastet, kein Fehler', async () => {
    const { farm, produkt, bestellung, paymentIntentId } = await offeneBestellung({
      zahlart: 'ONLINE',
      bestelltVorMinuten: 45,
    })
    abbrechen.mockImplementationOnce((async () => {
      intentStatus.set(paymentIntentId!, 'succeeded')
      throw new Error('You cannot cancel this PaymentIntent because it has a status of succeeded.')
    }) as never)

    await gibVerwaisteBestellungenFrei(new Date(), farm.id)

    expect((await zustand(bestellung.id)).status).toBe('PENDING_CONFIRMATION')
    expect(await bestand(produkt.id)).toBe(BESTAND_NACH_CHECKOUT)
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })

  it('ohne PaymentIntent (Checkout brach nach der Bestellung ab): direkt storniert', async () => {
    const { farm, produkt, bestellung } = await offeneBestellung({
      zahlart: 'ONLINE',
      bestelltVorMinuten: 31,
      mitIntent: false,
    })

    await gibVerwaisteBestellungenFrei(new Date(), farm.id)

    expect(holen).not.toHaveBeenCalled()
    expect((await zustand(bestellung.id)).status).toBe('CANCELLED')
    expect(await bestand(produkt.id)).toBe(BESTAND_NACH_CHECKOUT + MENGE)
  })
})

describe('bar — Bestätigungsfrist 2 Stunden', () => {
  it('über der Frist: storniert, Bestand zurück, Mail an die Kundin', async () => {
    const { farm, produkt, bestellung } = await offeneBestellung({ zahlart: 'ONSITE_CASH', bestelltVorMinuten: 121 })

    await gibVerwaisteBestellungenFrei(new Date(), farm.id)

    expect((await zustand(bestellung.id)).status).toBe('CANCELLED')
    expect(await bestand(produkt.id)).toBe(BESTAND_NACH_CHECKOUT + MENGE)
    expect(holen).not.toHaveBeenCalled()
    await vi.waitFor(() => expect(sendBestellungVerfallen).toHaveBeenCalledTimes(1))
  })

  it('Altfall (Frist seit über einem Tag vorbei): storniert, Bestand zurück, aber keine Mail', async () => {
    // Der erste Lauf nach dem Deploy trifft Bestellungen, die schon lange liegen.
    const { farm, produkt, bestellung } = await offeneBestellung({
      zahlart: 'ONSITE_CASH',
      bestelltVorMinuten: 3 * 24 * 60,
    })

    await gibVerwaisteBestellungenFrei(new Date(), farm.id)

    expect((await zustand(bestellung.id)).status).toBe('CANCELLED')
    expect(await bestand(produkt.id)).toBe(BESTAND_NACH_CHECKOUT + MENGE)
    await new Promise((r) => setTimeout(r, 50))
    expect(sendBestellungVerfallen).not.toHaveBeenCalled()
  })

  it('in der Frist: unberührt', async () => {
    const { farm, bestellung } = await offeneBestellung({ zahlart: 'ONSITE_CASH', bestelltVorMinuten: 100 })

    await gibVerwaisteBestellungenFrei(new Date(), farm.id)

    expect((await zustand(bestellung.id)).status).toBe('PENDING_CONFIRMATION')
    expect(sendBestellungVerfallen).not.toHaveBeenCalled()
  })
})

describe('Wiederholung und Nebenläufigkeit', () => {
  it('zweimal hintereinander und zweimal gleichzeitig: Bestand genau einmal zurück, eine Mail', async () => {
    const bar = await offeneBestellung({ zahlart: 'ONSITE_CASH', bestelltVorMinuten: 180 })
    const online = await offeneBestellung({ zahlart: 'ONLINE', bestelltVorMinuten: 60 })
    const jetzt = new Date()

    await Promise.all([gibVerwaisteBestellungenFrei(jetzt), gibVerwaisteBestellungenFrei(jetzt)])
    await gibVerwaisteBestellungenFrei(jetzt)

    expect(await bestand(bar.produkt.id)).toBe(BESTAND_NACH_CHECKOUT + MENGE)
    expect(await bestand(online.produkt.id)).toBe(BESTAND_NACH_CHECKOUT + MENGE)
    await vi.waitFor(() => expect(sendBestellungVerfallen).toHaveBeenCalledTimes(1))
    await new Promise((r) => setTimeout(r, 50))
    expect(sendBestellungVerfallen).toHaveBeenCalledTimes(1)
  })

  it('mit farmId: nur dieser Hof', async () => {
    const meiner = await offeneBestellung({ zahlart: 'ONSITE_CASH', bestelltVorMinuten: 180 })
    const fremder = await offeneBestellung({ zahlart: 'ONSITE_CASH', bestelltVorMinuten: 180 })

    await gibVerwaisteBestellungenFrei(new Date(), meiner.farm.id)

    expect((await zustand(meiner.bestellung.id)).status).toBe('CANCELLED')
    expect((await zustand(fremder.bestellung.id)).status).toBe('PENDING_CONFIRMATION')
  })

  it('bestätigte, bezahlte und stornierte Bestellungen bleiben, wie sie sind', async () => {
    const bestaetigt = await offeneBestellung({ zahlart: 'ONSITE_CASH', bestelltVorMinuten: 600 })
    await prisma.order.update({ where: { id: bestaetigt.bestellung.id }, data: { status: 'CONFIRMED' } })

    await gibVerwaisteBestellungenFrei(new Date(), bestaetigt.farm.id)

    expect((await zustand(bestaetigt.bestellung.id)).status).toBe('CONFIRMED')
    expect(await bestand(bestaetigt.produkt.id)).toBe(BESTAND_NACH_CHECKOUT)
  })
})

describe('Frist gilt beim Lesen — Hofseite (über den Slug)', () => {
  it('gibt die Ware einer verfallenen Bestellung frei, bevor die Hofseite den Bestand zeigt', async () => {
    const { farm, produkt, bestellung } = await offeneBestellung({ zahlart: 'ONSITE_CASH', bestelltVorMinuten: 180, bestand: 0 })

    await gibVerwaisteFreiFuerSlug(farm.slug)

    expect((await zustand(bestellung.id)).status).toBe('CANCELLED')
    expect(await bestand(produkt.id)).toBe(MENGE)
  })
})

describe('Frist gilt beim Lesen — /api/reserve', () => {
  it('eine verfallene Barbestellung blockiert den letzten Bestand nicht mehr', async () => {
    // Die Barbestellung hat den ganzen Bestand gebucht (0 übrig) und ist nie bestätigt worden.
    const { produkt } = await offeneBestellung({ zahlart: 'ONSITE_CASH', bestelltVorMinuten: 180, bestand: 0 })

    const antwort = await reservieren(
      new NextRequest('http://localhost:3000/api/reserve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productId: produkt.id, quantity: MENGE, sessionId: intKennung('sitzung') }),
      })
    )

    expect(antwort.status).toBe(200)
    expect(await bestand(produkt.id)).toBe(MENGE)
  })
})

describe('Frist gilt beim Lesen — Bestätigung per Link', () => {
  async function klick(token: string) {
    return bestaetigen(new NextRequest(`http://localhost:3000/api/orders/confirm/${token}`), {
      params: Promise.resolve({ token }),
    })
  }

  it('nach der Frist: verfällt statt zu bestätigen, Ware zurück', async () => {
    const { produkt, bestellung } = await offeneBestellung({ zahlart: 'ONSITE_CASH', bestelltVorMinuten: 121 })

    const antwort = await klick(bestellung.confirmationToken!)

    expect(antwort.status).toBe(307)
    expect(antwort.headers.get('location')).not.toContain('confirmed=true')
    expect((await zustand(bestellung.id)).status).toBe('CANCELLED')
    expect(await bestand(produkt.id)).toBe(BESTAND_NACH_CHECKOUT + MENGE)
  })

  it('in der Frist: bestätigt, Bestand bleibt gebucht', async () => {
    const { produkt, bestellung } = await offeneBestellung({ zahlart: 'ONSITE_CASH', bestelltVorMinuten: 30 })

    const antwort = await klick(bestellung.confirmationToken!)

    expect(antwort.headers.get('location')).toContain('confirmed=true')
    expect((await zustand(bestellung.id)).status).toBe('CONFIRMED')
    expect(await bestand(produkt.id)).toBe(BESTAND_NACH_CHECKOUT)
  })
})

describe('Checkout — Wiederholung einer verfallenen Bestellung', () => {
  it('derselbe Schlüssel nach der Frist: 409, keine tote Zahlung', async () => {
    const { farm, produkt, bestellung } = await offeneBestellung({ zahlart: 'ONLINE', bestelltVorMinuten: 31 })
    const schluessel = intKennung('schluessel')
    await prisma.order.update({ where: { id: bestellung.id }, data: { idempotencyKey: schluessel } })

    const antwort = await bestellen(
      checkoutAnfrage({
        farm,
        sessionId: intKennung('sitzung'),
        idempotencyKey: schluessel,
        positionen: [{ productId: produkt.id, name: 'Testprodukt', quantity: MENGE, unitPrice: 10 }],
      })
    )

    expect(antwort.status).toBe(409)
    expect(await antwort.json()).toMatchObject({ code: 'BESTELLUNG_BEENDET' })
    // Die Freigabe am Anfang des Checkouts hat die Bestellung beendet.
    expect((await zustand(bestellung.id)).status).toBe('CANCELLED')
  })
})
