/**
 * Integrationstest — Checkout ohne Kundenkonto (E8, Nachtlauf Nr. 17a) in der
 * echten Datenbank.
 *
 * Die Aussage ist der ZUSTAND danach:
 *  - Eine Bestellung mit neuer Adresse legt kein Konto an; `customerId`
 *    bleibt null, die Adresse steht bereinigt und klein auf der Bestellung.
 *  - Zwei Bestellungen mit derselben Adresse (verschieden geschrieben)
 *    verknüpfen nichts: kein Konto, beide ohne `customerId`.
 *  - Ein bestehendes ruhendes Konto mit derselben Adresse bleibt unangetastet
 *    und bekommt die Bestellung nicht.
 *  - Bestellt jemand unter der Adresse eines Hofs, hängt die Bestellung nicht
 *    am Konto des Inhabers (Morgenbericht Lauf 3, Folge 2: so eine Bestellung
 *    sperrte das Ablehnen des Hofs).
 *  - Die Hof-Kundenliste bleibt, wie sie ist: Sie fasst Bestellungen nach der
 *    Adresse zusammen, Gast-Bestellungen ohne Konto genauso wie eine ältere
 *    Bestellung, die noch an einem ruhenden Konto hängt.
 * Mail und Stripe sind gemockt; bar bei Abholung braucht Stripe nicht.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/email', () => ({ sendOnsiteConfirmation: vi.fn() }))
vi.mock('@/lib/stripe', () => ({
  stripe: { paymentIntents: { create: vi.fn(), retrieve: vi.fn() } },
}))

import { POST as checkout } from '@/app/api/checkout/route'
import { prisma } from '@/lib/prisma'
import { getCustomersForFarm } from '@/server/queries/customers'
import { checkoutAnfrage, erstelleHof, erstelleProdukt, intKennung, raeumeAuf, setzeHalt } from './setup/basis'

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(async () => {
  await raeumeAuf()
})

/** Bestellt eine Einheit mit eigener Sitzung (samt Halt) unter der Adresse. */
async function bestelle(farm: { id: string; slug: string }, produktId: string, customerEmail: string): Promise<Response> {
  const sitzung = intKennung('sitzung')
  await setzeHalt(produktId, sitzung, 1)
  return checkout(
    checkoutAnfrage({
      farm,
      sessionId: sitzung,
      customerEmail,
      positionen: [{ productId: produktId, name: 'Testprodukt', quantity: 1, unitPrice: 10 }],
    })
  )
}

describe('POST /api/checkout — kein Kundenkonto (E8)', () => {
  it('neue Adresse: Bestellung ohne Konto, kein User angelegt', async () => {
    const { farm } = await erstelleHof()
    const produkt = await erstelleProdukt(farm.id, { stock: 5 })
    const email = `${intKennung('kundin')}@example.com`
    const kontenVorher = await prisma.user.count()

    const res = await bestelle(farm, produkt.id, email)

    expect(res.status).toBe(200)
    const bestellung = await prisma.order.findFirstOrThrow({ where: { farmId: farm.id } })
    expect(bestellung.customerId).toBeNull()
    expect(bestellung.customerEmail).toBe(email)
    expect(await prisma.user.count({ where: { email } })).toBe(0)
    expect(await prisma.user.count()).toBe(kontenVorher)
  })

  it('zwei Bestellungen mit gleicher Adresse, verschieden geschrieben: nichts verknüpft, kein Konto', async () => {
    const { farm } = await erstelleHof()
    const produkt = await erstelleProdukt(farm.id, { stock: 5 })
    const email = `${intKennung('kundin')}@example.com`
    const kontenVorher = await prisma.user.count()

    expect((await bestelle(farm, produkt.id, email.toUpperCase())).status).toBe(200)
    expect((await bestelle(farm, produkt.id, email)).status).toBe(200)

    const bestellungen = await prisma.order.findMany({ where: { farmId: farm.id } })
    expect(bestellungen).toHaveLength(2)
    expect(bestellungen.map((b) => b.customerId)).toEqual([null, null])
    // Beide unter derselben, klein geschriebenen Adresse — die Hof-Kundenliste
    // fasst sie darüber zusammen (src/server/queries/customers.ts).
    expect(bestellungen.map((b) => b.customerEmail)).toEqual([email, email])
    expect(await prisma.user.count()).toBe(kontenVorher)
  })

  it('ein bestehendes ruhendes Konto mit derselben Adresse bleibt unangetastet und bekommt die Bestellung nicht', async () => {
    const { farm } = await erstelleHof()
    const produkt = await erstelleProdukt(farm.id, { stock: 5 })
    const email = `${intKennung('kundin')}@example.com`
    const konto = await prisma.user.create({
      data: { id: intKennung('konto'), email, name: 'Alter Name', phone: null, role: 'CUSTOMER', emailVerified: false },
    })

    const res = await bestelle(farm, produkt.id, email)

    expect(res.status).toBe(200)
    const bestellung = await prisma.order.findFirstOrThrow({ where: { farmId: farm.id } })
    expect(bestellung.customerId).toBeNull()
    expect(await prisma.user.findUniqueOrThrow({ where: { id: konto.id } })).toEqual(konto)
  })

  it('Bestellung unter der Adresse des Hof-Inhabers hängt nicht an dessen Konto', async () => {
    const { farm, owner } = await erstelleHof()
    const produkt = await erstelleProdukt(farm.id, { stock: 5 })

    const res = await bestelle(farm, produkt.id, owner.email)

    expect(res.status).toBe(200)
    expect(await prisma.order.count({ where: { customerId: owner.id } })).toBe(0)
    expect(await prisma.order.count({ where: { farmId: farm.id, customerEmail: owner.email } })).toBe(1)
  })

  it('Hof-Kundenliste unverändert: Gast-Bestellungen und eine alte Bestellung am ruhenden Konto ergeben EINE Kundin', async () => {
    const { farm } = await erstelleHof()
    const produkt = await erstelleProdukt(farm.id, { stock: 5 })
    const email = `${intKennung('kundin')}@example.com`
    // Eine Bestellung aus der Zeit vor Nr. 17a: an einem ruhenden Konto.
    const konto = await prisma.user.create({
      data: { id: intKennung('konto'), email, name: 'Erika Mustermann', role: 'CUSTOMER' },
    })
    expect((await bestelle(farm, produkt.id, email)).status).toBe(200)
    await prisma.order.updateMany({ where: { farmId: farm.id }, data: { customerId: konto.id } })

    expect((await bestelle(farm, produkt.id, email.toUpperCase())).status).toBe(200)
    expect((await bestelle(farm, produkt.id, email)).status).toBe(200)

    const kundinnen = await getCustomersForFarm(farm.id)
    expect(kundinnen).toHaveLength(1)
    expect(kundinnen[0]).toMatchObject({ customerEmail: email, orderCount: 3, customerName: 'Erika Mustermann' })
  })
})
