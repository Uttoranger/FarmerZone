/**
 * Integrationstest — E5 (Karte bei Abholung für neue Bestellungen) in der
 * echten Datenbank (Nachtlauf Nr. 12).
 *
 * Die Aussage ist der ZUSTAND danach: Eine neue Bestellung mit ONSITE_CARD
 * legt keine Bestellung an, bucht keinen Bestand und lässt den Halt der
 * Sitzung stehen, und es entsteht kein (ruhendes) Kundenkonto. Gegenprobe mit
 * bar bei Abholung: Bestellung da, Bestand gebucht. Eine schon bestehende
 * ONSITE_CARD-Bestellung zum Schlüssel (alter Tab) bekommt weiter ihre Antwort.
 * Stripe und Mail sind gemockt und werden mitgeprüft.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/email', () => ({ sendOnsiteConfirmation: vi.fn() }))
vi.mock('@/lib/stripe', () => ({
  stripe: { paymentIntents: { create: vi.fn(), retrieve: vi.fn() } },
}))

import { POST as checkout } from '@/app/api/checkout/route'
import { prisma } from '@/lib/prisma'
import { sendOnsiteConfirmation } from '@/lib/email'
import { stripe } from '@/lib/stripe'
import { CODE_ZAHLART_NICHT_ANGEBOTEN } from '@/lib/kasse'
import { checkoutAnfrage, erstelleHof, erstelleProdukt, intKennung, raeumeAuf, setzeHalt } from './setup/basis'

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(async () => {
  await raeumeAuf()
})

describe('POST /api/checkout — E5 in der echten Datenbank', () => {
  it('Karte bei Abholung: keine Bestellung, kein Bestand gebucht, Halt bleibt, kein Konto, keine Mail, kein Stripe', async () => {
    const { farm } = await erstelleHof()
    const produkt = await erstelleProdukt(farm.id, { stock: 5 })
    const sitzung = intKennung('sitzung')
    await setzeHalt(produkt.id, sitzung, 2)
    const email = `${intKennung('kundin')}@example.com`
    const kontenVorher = await prisma.user.count()

    const res = await checkout(
      checkoutAnfrage({
        farm,
        sessionId: sitzung,
        customerEmail: email,
        paymentMethod: 'ONSITE_CARD',
        positionen: [{ productId: produkt.id, name: 'Testprodukt', quantity: 2, unitPrice: 10 }],
      })
    )

    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe(CODE_ZAHLART_NICHT_ANGEBOTEN)
    expect(await prisma.order.count({ where: { farmId: farm.id } })).toBe(0)
    expect((await prisma.product.findUniqueOrThrow({ where: { id: produkt.id } })).stock).toBe(5)
    expect(await prisma.stockReservation.count({ where: { sessionId: sitzung } })).toBe(1)
    // Kein Konto zur Adresse — der Checkout legt seit Nr. 17a ohnehin keines an (E8).
    expect(await prisma.user.count({ where: { email } })).toBe(0)
    expect(await prisma.user.count()).toBe(kontenVorher)
    expect(sendOnsiteConfirmation).not.toHaveBeenCalled()
    expect(stripe.paymentIntents.create).not.toHaveBeenCalled()
  })

  it('bestehende ONSITE_CARD-Bestellung zum Schlüssel: 200 mit ihrer Antwort, nichts Neues angelegt oder gebucht', async () => {
    const { farm } = await erstelleHof()
    const produkt = await erstelleProdukt(farm.id, { stock: 5 })
    const sitzung = intKennung('sitzung')
    await setzeHalt(produkt.id, sitzung, 2)
    const schluessel = intKennung('idem')
    // Angelegt, bevor E5 galt (alter Tab mit demselben Schlüssel).
    const alt = await prisma.order.create({
      data: {
        orderNumber: intKennung('bestellung').toUpperCase(),
        idempotencyKey: schluessel,
        farmId: farm.id,
        customerEmail: `${intKennung('kundin')}@example.com`,
        customerName: 'Erika Mustermann',
        customerPhone: '+43 660 0000000',
        status: 'PENDING_CONFIRMATION',
        totalAmount: 20,
        pickupDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        pickupTimeStart: '15:00',
        pickupTimeEnd: '18:00',
        paymentMethod: 'ONSITE_CARD',
        paymentStatus: 'PENDING',
        items: {
          create: [{ productId: produkt.id, productName: 'Testprodukt', unitPrice: 10, quantity: 2, totalPrice: 20, vatRate: 10 }],
        },
      },
    })
    const kontenVorher = await prisma.user.count()

    const res = await checkout(
      checkoutAnfrage({
        farm,
        sessionId: sitzung,
        idempotencyKey: schluessel,
        paymentMethod: 'ONSITE_CARD',
        positionen: [{ productId: produkt.id, name: 'Testprodukt', quantity: 2, unitPrice: 10 }],
      })
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ orderId: alt.id, orderNumber: alt.orderNumber, requiresConfirmation: true, wiederholt: true })
    expect(await prisma.order.count({ where: { farmId: farm.id } })).toBe(1)
    expect((await prisma.product.findUniqueOrThrow({ where: { id: produkt.id } })).stock).toBe(5)
    expect(await prisma.user.count()).toBe(kontenVorher)
    expect(sendOnsiteConfirmation).not.toHaveBeenCalled()
    expect(stripe.paymentIntents.create).not.toHaveBeenCalled()
  })

  it('Gegenprobe: bar bei Abholung legt die Bestellung an und bucht den Bestand', async () => {
    const { farm } = await erstelleHof()
    const produkt = await erstelleProdukt(farm.id, { stock: 5 })
    const sitzung = intKennung('sitzung')
    await setzeHalt(produkt.id, sitzung, 2)

    const res = await checkout(
      checkoutAnfrage({
        farm,
        sessionId: sitzung,
        paymentMethod: 'ONSITE_CASH',
        positionen: [{ productId: produkt.id, name: 'Testprodukt', quantity: 2, unitPrice: 10 }],
      })
    )

    expect(res.status).toBe(200)
    const bestellungen = await prisma.order.findMany({ where: { farmId: farm.id }, select: { paymentMethod: true } })
    expect(bestellungen).toEqual([{ paymentMethod: 'ONSITE_CASH' }])
    expect((await prisma.product.findUniqueOrThrow({ where: { id: produkt.id } })).stock).toBe(3)
  })
})
