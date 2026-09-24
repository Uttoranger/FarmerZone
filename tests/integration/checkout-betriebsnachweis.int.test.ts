/**
 * Integrationstest 6 — Abgabe nur an Betriebe.
 *
 * Die Aussage: Ob ein Produkt nur an landwirtschaftliche Betriebe geht, steht am
 * PRODUKT in der Datenbank (`Product.abgabe`) — nicht in dem, was der Browser
 * schickt. Der Handler liest es selbst (src/app/api/checkout/route.ts, 3b) und
 * lehnt ab, BEVOR Bestand gebucht oder eine Bestellung angelegt wird (3c).
 *
 * Drei Fälle, und in jedem wird der Zustand danach geprüft: Privat mit
 * Betriebsware → keine Bestellung und unveränderter Bestand; Betrieb mit Nummer
 * → Nummer im Snapshot; Privat ohne Betriebsware → Nummer bleibt leer.
 *
 * Die Mocks sind Prüfstellen: Eine abgelehnte Bestellung darf keine Mail und
 * keinen Stripe-Aufruf auslösen.
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
import { CODE_BETRIEBSNACHWEIS_FEHLT } from '@/lib/betriebsnachweis'
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

describe('POST /api/checkout — Betriebsnachweis in der echten Datenbank', () => {
  it('lehnt Betriebsware für eine Privatkundin ab, ohne Bestand zu buchen', async () => {
    const { farm } = await erstelleHof()
    const hafer = await erstelleProdukt(farm.id, {
      stock: 6,
      abgabe: 'NUR_BETRIEBE',
      name: 'Hafer im Big Bag',
      price: 180,
    })
    const sitzung = intKennung('sitzung')
    await setzeHalt(hafer.id, sitzung, 1)

    const antwort = await checkout(
      checkoutAnfrage({
        farm,
        sessionId: sitzung,
        kaeuferArt: 'PRIVAT',
        positionen: [{ productId: hafer.id, name: 'Hafer im Big Bag', quantity: 1, unitPrice: 180 }],
      })
    )

    expect(antwort.status).toBe(400)
    expect(await antwort.json()).toMatchObject({ code: CODE_BETRIEBSNACHWEIS_FEHLT })

    // Der Zustand danach: nichts angelegt, nichts abgebucht.
    expect(await prisma.order.count({ where: { farmId: farm.id } })).toBe(0)
    expect(await prisma.product.findUniqueOrThrow({ where: { id: hafer.id } })).toMatchObject({
      stock: 6,
    })
    expect(sendOnsiteConfirmation).not.toHaveBeenCalled()
    expect(stripe.paymentIntents.create).not.toHaveBeenCalled()
  })

  it('lehnt auch ab, wenn der Browser PRIVAT schickt und die Abgabe nur am Produkt steht', async () => {
    // Die Anfrage behauptet nichts über die Abgabe — der Handler liest sie aus
    // der Datenbank. Ein manipulierter Warenkorb hilft deshalb nicht.
    const { farm } = await erstelleHof()
    const harmlos = await erstelleProdukt(farm.id, { stock: 5, name: 'Eier', price: 3.6 })
    const hafer = await erstelleProdukt(farm.id, {
      stock: 6,
      abgabe: 'NUR_BETRIEBE',
      name: 'Hafer im Big Bag',
      price: 180,
    })
    const sitzung = intKennung('sitzung')
    await setzeHalt(harmlos.id, sitzung, 1)
    await setzeHalt(hafer.id, sitzung, 1)

    const antwort = await checkout(
      checkoutAnfrage({
        farm,
        sessionId: sitzung,
        kaeuferArt: 'PRIVAT',
        positionen: [
          { productId: harmlos.id, name: 'Eier', quantity: 1, unitPrice: 3.6 },
          { productId: hafer.id, name: 'Hafer im Big Bag', quantity: 1, unitPrice: 180 },
        ],
      })
    )

    // Auf den Code prüfen, nicht nur auf 400: Ein Zod-Fehler antwortet ebenfalls
    // mit 400, der Test bliebe also grün, wenn der Betriebsnachweis gar nicht
    // mehr greift.
    expect(antwort.status).toBe(400)
    expect(await antwort.json()).toMatchObject({ code: CODE_BETRIEBSNACHWEIS_FEHLT })
    expect(await prisma.product.findUniqueOrThrow({ where: { id: harmlos.id } })).toMatchObject({
      stock: 5,
    })
    expect(await prisma.product.findUniqueOrThrow({ where: { id: hafer.id } })).toMatchObject({
      stock: 6,
    })
  })

  it('schreibt die Betriebsnummer in die Bestellung, wenn ein Betrieb sie angibt', async () => {
    const { farm } = await erstelleHof()
    const hafer = await erstelleProdukt(farm.id, {
      stock: 6,
      abgabe: 'NUR_BETRIEBE',
      name: 'Hafer im Big Bag',
      price: 180,
    })
    const sitzung = intKennung('sitzung')
    await setzeHalt(hafer.id, sitzung, 1)

    const antwort = await checkout(
      checkoutAnfrage({
        farm,
        sessionId: sitzung,
        kaeuferArt: 'BETRIEB',
        betriebsnummer: 'LFBIS 7654321',
        positionen: [{ productId: hafer.id, name: 'Hafer im Big Bag', quantity: 1, unitPrice: 180 }],
      })
    )

    expect(antwort.status).toBe(200)
    const bestellung = await prisma.order.findFirstOrThrow({ where: { farmId: farm.id } })
    expect(bestellung.kaeuferArt).toBe('BETRIEB')
    expect(bestellung.betriebsnummer).toBe('LFBIS 7654321')
    expect(await prisma.product.findUniqueOrThrow({ where: { id: hafer.id } })).toMatchObject({
      stock: 5,
    })
  })

  it('lässt die Betriebsnummer leer, wenn keine Betriebsware im Korb liegt', async () => {
    const { farm } = await erstelleHof()
    const eier = await erstelleProdukt(farm.id, { stock: 5, name: 'Eier', price: 3.6 })
    const sitzung = intKennung('sitzung')
    await setzeHalt(eier.id, sitzung, 1)

    const antwort = await checkout(
      checkoutAnfrage({
        farm,
        sessionId: sitzung,
        kaeuferArt: 'PRIVAT',
        positionen: [{ productId: eier.id, name: 'Eier', quantity: 1, unitPrice: 3.6 }],
      })
    )

    expect(antwort.status).toBe(200)
    const bestellung = await prisma.order.findFirstOrThrow({ where: { farmId: farm.id } })
    expect(bestellung.kaeuferArt).toBe('PRIVAT')
    expect(bestellung.betriebsnummer).toBeNull()
  })
})
