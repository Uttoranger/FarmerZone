/**
 * Integrationstest — die Höchstzahl eines Abholfensters unter Nebenläufigkeit.
 *
 * Die Aussage: Zwei gleichzeitige Bestellungen auf den LETZTEN Platz eines
 * Fensters (PickupSlot.maxOrders) überbuchen es nicht. Der Checkout zählt und
 * legt die Bestellung in einer Transaktion an, unter der Sperre der Zeile des
 * Fensters (src/server/abholfenster.ts, `imAbholfenster`). Mit gemocktem Prisma
 * nicht prüfbar — ob die zweite Zählung die erste Bestellung sieht,
 * entscheidet Postgres.
 *
 * Geprüft wird der ZUSTAND danach, nicht der Weg (TESTING_GUIDELINES §1): Die
 * Verliererin scheitert je nach Verschränkung an der Vorprüfung oder in der
 * Transaktion — in beiden Fällen mit ABHOLFENSTER_VOLL, und ihr Bestand ist
 * wieder frei.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/email', () => ({ sendOnsiteConfirmation: vi.fn() }))
vi.mock('@/lib/stripe', () => ({
  stripe: { paymentIntents: { create: vi.fn(), retrieve: vi.fn() } },
}))

import { POST as checkout } from '@/app/api/checkout/route'
import { prisma } from '@/lib/prisma'
import { CODE_ABHOLFENSTER_VOLL } from '@/lib/abholfenster'
import { checkoutAnfrage, erstelleHof, erstelleProdukt, intKennung, raeumeAuf, setzeHalt } from './setup/basis'

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(async () => {
  await raeumeAuf()
})

/** Ein Hof, dessen Fenster (täglich 15–18 Uhr) höchstens `max` Bestellungen nehmen. */
async function hofMitHoechstzahl(max: number) {
  const { farm } = await erstelleHof()
  await prisma.pickupSlot.updateMany({ where: { farmId: farm.id }, data: { maxOrders: max } })
  const produkt = await erstelleProdukt(farm.id, { stock: 10 })
  return { farm, produkt }
}

/** Eine Bestellung einer eigenen Kundin mit eigener Sitzung und eigenem Halt. */
async function bestellung(farm: { id: string; slug: string }, produktId: string) {
  const sitzung = intKennung('sitzung')
  await setzeHalt(produktId, sitzung, 1)
  return checkoutAnfrage({
    farm,
    sessionId: sitzung,
    customerEmail: `${intKennung('kundin')}@example.com`,
    positionen: [{ productId: produktId, name: 'Testprodukt', quantity: 1, unitPrice: 10 }],
  })
}

const offeneBestellungen = (farmId: string) =>
  prisma.order.count({ where: { farmId, status: { not: 'CANCELLED' } } })

describe('POST /api/checkout — Höchstzahl des Abholfensters in der echten Datenbank', () => {
  it('lässt von zwei gleichzeitigen Bestellungen auf den letzten Platz genau eine durch', async () => {
    const { farm, produkt } = await hofMitHoechstzahl(1)
    const [anfrageA, anfrageB] = await Promise.all([bestellung(farm, produkt.id), bestellung(farm, produkt.id)])

    const antworten = await Promise.all([checkout(anfrageA), checkout(anfrageB)])

    expect(antworten.map((r) => r.status).sort()).toEqual([200, 409])
    const abgelehnt = antworten.find((r) => r.status === 409)!
    expect((await abgelehnt.json()).code).toBe(CODE_ABHOLFENSTER_VOLL)

    // Der Zustand: eine Bestellung im Fenster, und nur ihre Ware ist gebucht.
    expect(await offeneBestellungen(farm.id)).toBe(1)
    const danach = await prisma.product.findUniqueOrThrow({ where: { id: produkt.id } })
    expect(danach.stock).toBe(9)
  })

  it('bei drei gleichzeitigen auf zwei Plätze: genau zwei', async () => {
    const { farm, produkt } = await hofMitHoechstzahl(2)
    const anfragen = await Promise.all([1, 2, 3].map(() => bestellung(farm, produkt.id)))

    const antworten = await Promise.all(anfragen.map((a) => checkout(a)))

    expect(antworten.filter((r) => r.status === 200)).toHaveLength(2)
    expect(await offeneBestellungen(farm.id)).toBe(2)
    expect((await prisma.product.findUniqueOrThrow({ where: { id: produkt.id } })).stock).toBe(8)
  })

  it('eine stornierte Bestellung gibt ihren Platz frei', async () => {
    const { farm, produkt } = await hofMitHoechstzahl(1)
    expect((await checkout(await bestellung(farm, produkt.id))).status).toBe(200)
    await prisma.order.updateMany({ where: { farmId: farm.id }, data: { status: 'CANCELLED' } })

    const zweite = await checkout(await bestellung(farm, produkt.id))

    expect(zweite.status).toBe(200)
    expect(await offeneBestellungen(farm.id)).toBe(1)
  })
})
