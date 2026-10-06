/**
 * Integrationstest — Kunden des Hofs (/customers, Nachtlauf Nr. 22a) in der
 * echten Datenbank.
 *
 * Die Aussage ist, was die Abfragen zurückgeben:
 *  - Eine Kennung findet nur Kundinnen des eigenen Hofs: Die Kennung einer
 *    Kundin von Hof B führt bei Hof A ins Leere, auch wenn dieselbe Adresse
 *    bei Hof A nie bestellt hat; das Detail von Hof A zeigt nie Bestellungen
 *    von Hof B.
 *  - Groß-/Kleinschreibung und Rand fassen zusammen, „_" ist kein Platzhalter:
 *    „a_b@…" und „axb@…" bleiben zwei Kundinnen, im Detail wie im Abo.
 *  - Fehlende Artikel (fehltSeit) zählen nicht als gekauft, Umsatz in Cent.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { findeKundenAdressen, getCustomerDetail, getCustomersForFarm, kundeIdFuer } from '@/server/queries/customers'
import { erstelleHof, erstelleProdukt, intKennung, raeumeAuf } from './setup/basis'

afterEach(async () => {
  await raeumeAuf()
})

let zaehler = 0
async function bestelle(
  farmId: string,
  customerEmail: string,
  teil: { totalAmount?: string; status?: 'PICKED_UP' | 'CANCELLED'; artikel?: { name: string; fehlt?: boolean }[] } = {}
) {
  zaehler += 1
  const produkt = teil.artikel?.length ? await erstelleProdukt(farmId, { stock: 5 }) : null
  return prisma.order.create({
    data: {
      orderNumber: intKennung(`kd${zaehler}`).toUpperCase(),
      farmId,
      customerEmail,
      customerName: 'Erika Mustermann',
      customerPhone: '+43 660 0000000',
      status: teil.status ?? 'PICKED_UP',
      paymentMethod: 'ONSITE_CASH',
      paymentStatus: 'PAID',
      totalAmount: teil.totalAmount ?? '10.00',
      serviceFeeCents: 0,
      pickupDate: new Date(),
      pickupTimeStart: '15:00',
      pickupTimeEnd: '18:00',
      items: {
        create: (teil.artikel ?? []).map((a) => ({
          productId: produkt!.id,
          productName: a.name,
          quantity: 1,
          unitPrice: '5.00',
          totalPrice: '5.00',
          vatRate: '10.00',
          fehltSeit: a.fehlt ? new Date() : null,
        })),
      },
    },
  })
}

describe('Kunden des Hofs — nur der eigene Hof', () => {
  it('die Kennung einer Kundin von Hof B findet bei Hof A nichts, das Detail von A zeigt nur A', async () => {
    const { farm: a } = await erstelleHof()
    const { farm: b } = await erstelleHof()
    const gemeinsam = `${intKennung('kundin')}@example.com`
    const nurB = `${intKennung('kundin')}@example.com`
    await bestelle(a.id, gemeinsam, { totalAmount: '3.00' })
    await bestelle(b.id, gemeinsam, { totalAmount: '50.00' })
    await bestelle(b.id, nurB)

    // Fremde Kennung (aus Hof B) und eigene Kennung für eine Adresse, die nur bei B kaufte.
    expect(await findeKundenAdressen(a.id, kundeIdFuer(b.id, nurB))).toEqual([])
    expect(await findeKundenAdressen(a.id, kundeIdFuer(a.id, nurB))).toEqual([])
    expect(await findeKundenAdressen(a.id, kundeIdFuer(b.id, gemeinsam))).toEqual([])

    const adressen = await findeKundenAdressen(a.id, kundeIdFuer(a.id, gemeinsam))
    expect(adressen).toEqual([gemeinsam])
    const detail = await getCustomerDetail(a.id, adressen)
    expect(detail?.orderCount).toBe(1)
    expect(detail?.umsatzCents).toBe(300)

    const listeA = await getCustomersForFarm(a.id)
    expect(listeA.map((k) => k.customerEmail)).toEqual([gemeinsam])
  })

  it('„_" ist kein Platzhalter: a_b und axb bleiben zwei Kundinnen, auch im Abo', async () => {
    const { farm } = await erstelleHof()
    const basis = intKennung('kundin')
    const mitStrich = `${basis}a_b@example.com`
    const ohne = `${basis}axb@example.com`
    await bestelle(farm.id, mitStrich, { totalAmount: '1.00' })
    await bestelle(farm.id, ohne, { totalAmount: '7.00' })
    await bestelle(farm.id, ohne, { totalAmount: '7.00' })
    await prisma.customerFarmSubscription.create({
      data: { farmId: farm.id, customerEmail: ohne, optInEmail: true, optInWhatsApp: false },
    })

    const adressen = await findeKundenAdressen(farm.id, kundeIdFuer(farm.id, mitStrich))
    const detail = await getCustomerDetail(farm.id, adressen)
    expect(detail?.orderCount).toBe(1)
    expect(detail?.umsatzCents).toBe(100)
    expect(detail?.subscription).toBeNull()
    expect(detail?.isSubscribed).toBe(false)

    const liste = await getCustomersForFarm(farm.id)
    expect(liste.map((k) => [k.customerEmail, k.orderCount]).toSorted()).toEqual([
      [mitStrich, 1],
      [ohne, 2],
    ])
  })

  it('verschiedene Schreibweisen sind eine Kundin — in Liste und Detail', async () => {
    const { farm } = await erstelleHof()
    const email = `${intKennung('kundin')}@example.com`
    await bestelle(farm.id, email, { totalAmount: '0.10' })
    await bestelle(farm.id, email.toUpperCase(), { totalAmount: '0.20' })
    await bestelle(farm.id, `${email} `, { totalAmount: '19.99' })

    const liste = await getCustomersForFarm(farm.id)
    expect(liste).toHaveLength(1)
    expect(liste[0].umsatzCents).toBe(2029)

    const adressen = await findeKundenAdressen(farm.id, liste[0].kundeId)
    expect(adressen.toSorted()).toEqual([email, `${email} `, email.toUpperCase()].toSorted())
    const detail = await getCustomerDetail(farm.id, adressen)
    expect(detail?.orderCount).toBe(3)
    expect(detail?.umsatzCents).toBe(2029)
  })

  it('fehlende Artikel zählen nicht als Lieblingsprodukt, Storno nicht als Umsatz', async () => {
    const { farm } = await erstelleHof()
    const email = `${intKennung('kundin')}@example.com`
    await bestelle(farm.id, email, { artikel: [{ name: 'Eier' }, { name: 'Brot', fehlt: true }] })
    await bestelle(farm.id, email, { status: 'CANCELLED', totalAmount: '99.00', artikel: [{ name: 'Speck' }] })

    const [kundin] = await getCustomersForFarm(farm.id)
    expect(kundin.topProducts).toEqual([{ name: 'Eier', count: 1 }])
    expect(kundin.umsatzCents).toBe(1000)
    const detail = await getCustomerDetail(farm.id, [email])
    expect(detail?.topProducts).toEqual([{ name: 'Eier', count: 1 }])
    expect(detail?.recentOrders.find((o) => o.status === 'PICKED_UP')?.items).toEqual([{ productName: 'Eier', quantity: 1 }])
  })
})
