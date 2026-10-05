/**
 * Integrationstest — E5 (Karte bei Abholung für neue Bestellungen) in der
 * echten Datenbank (Nachtlauf Nr. 12).
 *
 * Die Aussage ist der ZUSTAND danach: Eine neue Bestellung mit ONSITE_CARD
 * legt keine Bestellung an, bucht keinen Bestand und lässt den Halt der
 * Sitzung stehen. Gegenprobe mit bar bei Abholung: Bestellung da, Bestand
 * gebucht. Stripe und Mail sind gemockt und werden mitgeprüft.
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
  it('Karte bei Abholung: keine Bestellung, kein Bestand gebucht, Halt bleibt, keine Mail, kein Stripe', async () => {
    const { farm } = await erstelleHof()
    const produkt = await erstelleProdukt(farm.id, { stock: 5 })
    const sitzung = intKennung('sitzung')
    await setzeHalt(produkt.id, sitzung, 2)

    const res = await checkout(
      checkoutAnfrage({
        farm,
        sessionId: sitzung,
        paymentMethod: 'ONSITE_CARD',
        positionen: [{ productId: produkt.id, name: 'Testprodukt', quantity: 2, unitPrice: 10 }],
      })
    )

    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe(CODE_ZAHLART_NICHT_ANGEBOTEN)
    expect(await prisma.order.count({ where: { farmId: farm.id } })).toBe(0)
    expect((await prisma.product.findUniqueOrThrow({ where: { id: produkt.id } })).stock).toBe(5)
    expect(await prisma.stockReservation.count({ where: { sessionId: sitzung } })).toBe(1)
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
