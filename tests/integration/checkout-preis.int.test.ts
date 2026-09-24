/**
 * Integrationstest — der Preis kommt aus der Datenbank.
 *
 * Die Aussage: Was eine Position kostet, steht am PRODUKT in der Datenbank
 * (`Product.price`) — nicht in dem, was der Browser schickt. Weicht der Preis
 * der Anfrage ab, lehnt der Handler mit 409 ab, BEVOR Bestand gebucht oder
 * eine Bestellung angelegt wird. Stimmt er, stehen Positionen und Summe mit
 * dem DB-Preis in der Bestellung.
 *
 * Geprüft wird der Zustand danach, nicht der Weg.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/email', () => ({ sendOnsiteConfirmation: vi.fn() }))
vi.mock('@/lib/stripe', () => ({
  stripe: { paymentIntents: { create: vi.fn(), retrieve: vi.fn() } },
}))

import { POST as checkout } from '@/app/api/checkout/route'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import {
  checkoutAnfrage,
  erstelleHof,
  erstelleProdukt,
  intKennung,
  raeumeAuf,
  setzeHalt,
} from './setup/basis'

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(async () => {
  await raeumeAuf()
})

describe('POST /api/checkout — Preis in der echten Datenbank', () => {
  it('ein manipulierter Preis legt keine Bestellung an und bucht keinen Bestand', async () => {
    const { farm } = await erstelleHof()
    const produkt = await erstelleProdukt(farm.id, { stock: 5, price: 12.5 })
    const sitzung = intKennung('sitzung')
    await setzeHalt(produkt.id, sitzung, 2)

    const antwort = await checkout(
      checkoutAnfrage({
        farm,
        sessionId: sitzung,
        positionen: [{ productId: produkt.id, name: 'Testprodukt', quantity: 2, unitPrice: 0.01 }],
      })
    )

    expect(antwort.status).toBe(409)
    expect(await antwort.json()).toMatchObject({
      code: 'WARENKORB_GEAENDERT',
      preise: [{ productId: produkt.id, price: 12.5 }],
    })
    expect(await prisma.order.count({ where: { farmId: farm.id } })).toBe(0)
    expect(await prisma.product.findUniqueOrThrow({ where: { id: produkt.id } })).toMatchObject({ stock: 5 })
    expect(stripe.paymentIntents.create).not.toHaveBeenCalled()
  })

  it('mit dem richtigen Preis stehen Positionen und Summe aus der DB in der Bestellung', async () => {
    const { farm } = await erstelleHof()
    const produkt = await erstelleProdukt(farm.id, { stock: 5, price: 12.5 })
    const sitzung = intKennung('sitzung')
    await setzeHalt(produkt.id, sitzung, 2)

    const antwort = await checkout(
      checkoutAnfrage({
        farm,
        sessionId: sitzung,
        positionen: [{ productId: produkt.id, name: 'Testprodukt', quantity: 2, unitPrice: 12.5 }],
      })
    )

    expect(antwort.status).toBe(200)
    const bestellung = await prisma.order.findFirstOrThrow({
      where: { farmId: farm.id },
      include: { items: true },
    })
    expect(bestellung.totalAmount.toFixed(2)).toBe('25.00')
    expect(bestellung.items[0].unitPrice.toFixed(2)).toBe('12.50')
    expect(bestellung.items[0].totalPrice.toFixed(2)).toBe('25.00')
  })
})
