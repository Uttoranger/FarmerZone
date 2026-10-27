/**
 * Der Geld-Abgleich gegen ein ECHTES Postgres (Register N37, Nr. 191) — die
 * Abfrage der Bestellungen und die Zeilen in BetriebMessung sind die Aussage.
 * Stripe ist eine Attrappe (nur list/retrieve; kein Live-Aufruf).
 *
 * Beweist:
 *  - Der Lauf findet die Bestellungen zu den gelesenen Zahlungen über die
 *    echte Abfrage (ONLINE, PaymentIntent, ohne Testzahlungen) und schreibt
 *    eine Abweichung als `geldAbweichung:<Bestellung>:gebuehr` mit Datenbank −
 *    Stripe in Cent; eine gleiche Bestellung schreibt nichts.
 *  - Die Stripe-Gebühren stehen je UTC-Tag als `stripeGebuehrCents`; ein
 *    zweiter Lauf überschreibt den Tag (upsert), statt zu addieren.
 *  - Heute liest die offene Abweichung mit Bestellnummer
 *    (`ladeOffeneAbweichungen`); stimmt die Zahlung im nächsten Lauf, ist die
 *    Zeile weg. Geld zählt die Gebühren des Monats (`ladeGeldMonat`).
 *
 * Daten: Hof und Bestellungen mit `int-`-Präfix; Stripe-Gebühren an einem Tag
 * im Jahr 2001 (fern von jedem echten Tag). Abweichungen anderer Dateien, die
 * der Lauf über „bezahlt in den letzten 48 Stunden“ mitliest, räumt afterEach
 * mit weg (nur Zeilen dieser Art).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const stripeAttrappe = vi.hoisted(() => ({
  paymentIntents: { list: vi.fn(), retrieve: vi.fn() },
  refunds: { list: vi.fn() },
  balanceTransactions: { list: vi.fn() },
}))
vi.mock('@/lib/stripe', () => ({ stripe: stripeAttrappe }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { gleicheGeldAb } from '@/server/geld-abgleich'
import { ladeGeldMonat, ladeOffeneAbweichungen } from '@/server/queries/geld'
import { erstelleHof, erstelleProdukt, intKennung, raeumeAuf } from './setup/basis'

const TAG_2001 = new Date('2001-03-05T00:00:00.000Z')

function liste<T>(eintraege: T[]): AsyncIterable<T> {
  return {
    async *[Symbol.asyncIterator]() {
      yield* eintraege
    },
  }
}

/** Eine bezahlte Online-Bestellung: 2 × 10,00 € Ware, 1,00 € Servicegebühr → bezahlt 21,00 €. */
async function bestellung(farmId: string, produktId: string): Promise<{ id: string; orderNumber: string; pi: string }> {
  const pi = intKennung('pi')
  const b = await prisma.order.create({
    data: {
      orderNumber: intKennung('bestellung').toUpperCase(),
      farmId,
      customerEmail: `${intKennung('kundin')}@example.com`,
      customerName: 'Erika Beispiel',
      customerPhone: '+43 660 0000000',
      status: 'CONFIRMED',
      totalAmount: 20,
      pickupDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      pickupTimeStart: '15:00',
      pickupTimeEnd: '18:00',
      paymentMethod: 'ONLINE',
      paymentStatus: 'PAID',
      paidAt: new Date(),
      stripePaymentIntentId: pi,
      platformFeeAmount: 0,
      serviceFeeCents: 100,
      items: { create: [{ productId: produktId, productName: 'Testprodukt', unitPrice: 10, quantity: 2, totalPrice: 20, vatRate: 10 }] },
    },
    select: { id: true, orderNumber: true },
  })
  return { ...b, pi }
}

const pi = (id: string, gebuehr: number) => ({ id, amount_received: 2100, application_fee_amount: gebuehr, latest_charge: { amount_refunded: 0 } })

beforeEach(() => {
  vi.clearAllMocks()
  stripeAttrappe.refunds.list.mockReturnValue(liste([]))
  // Zahlungen anderer Dateien (bezahlt in den letzten 48 Stunden) kennt die Attrappe nicht.
  stripeAttrappe.paymentIntents.retrieve.mockRejectedValue(Object.assign(new Error('No such payment_intent'), { code: 'resource_missing', statusCode: 404 }))
})

afterEach(async () => {
  await prisma.betriebMessung.deleteMany({ where: { OR: [{ art: { startsWith: 'geldAbweichung:' } }, { tag: { lt: new Date('2002-01-01T00:00:00.000Z') } }] } })
  await raeumeAuf()
})

describe('gleicheGeldAb gegen Postgres', () => {
  it('Abweichung und Gebühren geschrieben, in Heute mit Nummer gelesen, im nächsten Lauf geklärt; Geld zählt die Gebühren des Monats', async () => {
    const { farm } = await erstelleHof()
    const produkt = await erstelleProdukt(farm.id, { stock: 10 })
    const gleich = await bestellung(farm.id, produkt.id)
    const anders = await bestellung(farm.id, produkt.id)

    stripeAttrappe.paymentIntents.list.mockReturnValue(liste([pi(gleich.pi, 100), pi(anders.pi, 50)]))
    stripeAttrappe.balanceTransactions.list.mockReturnValue(liste([{ created: Math.floor(TAG_2001.getTime() / 1000) + 3600, fee: 77, type: 'charge', amount: 2100 }]))
    await gleicheGeldAb(new Date())

    const zeilen = await prisma.betriebMessung.findMany({ where: { art: { in: [`geldAbweichung:${gleich.id}:gebuehr`, `geldAbweichung:${anders.id}:gebuehr`] } } })
    expect(zeilen.map((z) => [z.art, z.wert])).toEqual([[`geldAbweichung:${anders.id}:gebuehr`, BigInt(50)]])
    expect(await prisma.betriebMessung.findUnique({ where: { tag_art: { tag: TAG_2001, art: 'stripeGebuehrCents' } } })).toMatchObject({ wert: BigInt(77) })

    const offen = (await ladeOffeneAbweichungen()).filter((o) => o.orderId === anders.id)
    expect(offen).toEqual([{ orderId: anders.id, orderNumber: anders.orderNumber, feld: 'gebuehr', differenzCents: 50, seit: expect.any(Date) }])
    expect((await ladeGeldMonat('2001-03', null)).stripeGebuehrCents).toBe(77)

    // Nächster Lauf: Stripe stimmt jetzt, der Tag hat neu 80 Cent (überschrieben, nicht addiert).
    stripeAttrappe.paymentIntents.list.mockReturnValue(liste([pi(gleich.pi, 100), pi(anders.pi, 100)]))
    stripeAttrappe.balanceTransactions.list.mockReturnValue(liste([{ created: Math.floor(TAG_2001.getTime() / 1000) + 3600, fee: 80, type: 'charge', amount: 2100 }]))
    await gleicheGeldAb(new Date())
    expect(await prisma.betriebMessung.count({ where: { art: { startsWith: `geldAbweichung:${anders.id}:` } } })).toBe(0)
    expect(await prisma.betriebMessung.findUnique({ where: { tag_art: { tag: TAG_2001, art: 'stripeGebuehrCents' } } })).toMatchObject({ wert: BigInt(80) })
  })
})
