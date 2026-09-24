/**
 * Integrationstest 7 — der MwSt-Satz ist ein Snapshot.
 *
 * Die Aussage (Invariante aus ARCHITECTURE.md §5): `OrderItem.vatRate` wird beim
 * Anlegen aus `Product.vatRate` geschrieben — im selben `create` wie die
 * Bestellung, also atomar mit ihr (src/app/api/checkout/route.ts, Schritt 9) —
 * und danach NIE mehr nachgelesen oder rückwirkend geändert.
 *
 * Genau das ist mit gemocktem Prisma nicht prüfbar: Dort steht am Ende nur, mit
 * welchem Argument `create` gerufen wurde. Hier wird der Satz am Produkt NACH
 * der Bestellung geändert und die gespeicherte Position noch einmal gelesen.
 *
 * Warum es Geld ist: Die Rechnung einer alten Bestellung muss den Satz zeigen,
 * der beim Kauf galt. Ein nachgelesener Satz änderte rückwirkend eine
 * Steuerangabe.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/email', () => ({ sendOnsiteConfirmation: vi.fn() }))
vi.mock('@/lib/stripe', () => ({
  stripe: { paymentIntents: { create: vi.fn(), retrieve: vi.fn() } },
}))

import { POST as checkout } from '@/app/api/checkout/route'
import { prisma } from '@/lib/prisma'
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

describe('POST /api/checkout — MwSt-Satz als Snapshot', () => {
  it('übernimmt den Satz aus der Datenbank, nicht aus der Anfrage', async () => {
    const { farm } = await erstelleHof()
    // 13 % statt der üblichen 10 — ein Wert, den die Anfrage nirgends nennt.
    const produkt = await erstelleProdukt(farm.id, { stock: 5, vatRate: 13 })
    const sitzung = intKennung('sitzung')
    await setzeHalt(produkt.id, sitzung, 2)

    const antwort = await checkout(
      checkoutAnfrage({
        farm,
        sessionId: sitzung,
        positionen: [{ productId: produkt.id, name: 'Testprodukt', quantity: 2, unitPrice: 10 }],
      })
    )
    expect(antwort.status).toBe(200)

    const position = await prisma.orderItem.findFirstOrThrow({
      where: { order: { farmId: farm.id } },
    })
    expect(Number(position.vatRate)).toBe(13)
  })

  it('lässt eine bestehende Position unverändert, wenn der Hof den Satz später ändert', async () => {
    const { farm } = await erstelleHof()
    const produkt = await erstelleProdukt(farm.id, { stock: 5, vatRate: 10 })
    const sitzung = intKennung('sitzung')
    await setzeHalt(produkt.id, sitzung, 1)

    const antwort = await checkout(
      checkoutAnfrage({
        farm,
        sessionId: sitzung,
        positionen: [{ productId: produkt.id, name: 'Testprodukt', quantity: 1, unitPrice: 10 }],
      })
    )
    expect(antwort.status).toBe(200)
    const { orderId } = await antwort.json()

    // Der Hof ändert den Satz — Monate später, für neue Bestellungen.
    await prisma.product.update({ where: { id: produkt.id }, data: { vatRate: 20 } })

    const position = await prisma.orderItem.findFirstOrThrow({ where: { orderId } })
    expect(Number(position.vatRate)).toBe(10)

    // Gegenprobe, damit der Test nicht nur beweist, dass das Update nichts tat.
    const produktDanach = await prisma.product.findUniqueOrThrow({ where: { id: produkt.id } })
    expect(Number(produktDanach.vatRate)).toBe(20)
  })
})
