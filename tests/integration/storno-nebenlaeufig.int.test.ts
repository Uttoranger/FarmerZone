/**
 * Integrationstest 8 — Storno unter Nebenläufigkeit.
 *
 * Die Aussage: Der bedingte Statuswechsel IST die Sperre (`updateMany` mit
 * Statusbedingung in `prisma.$transaction`, src/server/actions/orders.ts).
 * Zwei gleichzeitige Aufrufe — Doppeltipp auf dem Telefon — dürfen nur EINE
 * Stornierung erzeugen und den Bestand nur EINMAL zurückbuchen.
 *
 * WARUM ES DIESEN TEST BRAUCHT, obwohl `tests/storno-atomar.test.ts` denselben
 * Fall abdeckt: Dort bildet ein Fake die Datenbank-Semantik nach und nimmt
 * dabei an, ein `updateMany` mit Bedingung sei unteilbar wie ein einzelnes
 * `UPDATE … WHERE` in PostgreSQL. Genau diese Annahme prüft hier die echte
 * Datenbank — mit echter Zeilensperre, echter Transaktion und echtem
 * Better-Auth-Login des Hofes.
 *
 * Gemockt sind nur Mail, Stripe, Sentry und der Request-Kontext. Die
 * Berechtigung läuft echt: Der Hof meldet sich mit Passwort an und die Action
 * liest die Sitzung aus der Datenbank.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/lib/stripe', () => ({ stripe: { refunds: { create: vi.fn() } } }))
vi.mock('@/lib/email', () => ({
  sendOrderReady: vi.fn(),
  sendOrderCancelled: vi.fn(),
  sendOrderNotReady: vi.fn(),
}))

import { headers } from 'next/headers'
import { cancelOrder } from '@/server/actions/orders'
import { prisma } from '@/lib/prisma'
import { sendOrderCancelled } from '@/lib/email'
import { stripe } from '@/lib/stripe'
import { erstelleHofMitAnmeldung, erstelleProdukt, intKennung, raeumeAuf } from './setup/basis'

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(async () => {
  await raeumeAuf()
})

const EINZELPREIS = 10

/** Ein Hof mit Anmeldung, ein Produkt und eine bestätigte Bestellung darauf. */
async function bestellungZumStornieren(menge = 2) {
  const { farm, cookie } = await erstelleHofMitAnmeldung()
  const produkt = await erstelleProdukt(farm.id, { stock: 5 })

  // Der Request-Kontext der Server-Action: echtes Sitzungs-Cookie, damit
  // Better Auth die Sitzung wirklich in der Datenbank nachschlägt.
  vi.mocked(headers).mockResolvedValue(new Headers({ cookie }) as never)

  const bestellung = await prisma.order.create({
    data: {
      orderNumber: intKennung('bestellung').toUpperCase(),
      farmId: farm.id,
      customerEmail: `${intKennung('kundin')}@example.com`,
      customerName: 'Erika Mustermann',
      customerPhone: '+43 660 0000000',
      status: 'CONFIRMED',
      // Aus der Menge abgeleitet, nicht verdrahtet: Ein Fixture mit einem
      // Gesamtbetrag, der seinen Positionen widerspricht, wäre ein unmöglicher
      // Geldzustand in der Datenbank.
      totalAmount: EINZELPREIS * menge,
      pickupDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      pickupTimeStart: '15:00',
      pickupTimeEnd: '18:00',
      paymentMethod: 'ONSITE_CASH',
      paymentStatus: 'PENDING',
      serviceFeeCents: 100,
      serviceFeePercentApplied: 4.9,
      items: {
        create: [
          {
            productId: produkt.id,
            productName: 'Testprodukt',
            unitPrice: EINZELPREIS,
            quantity: menge,
            totalPrice: EINZELPREIS * menge,
            vatRate: 10,
          },
        ],
      },
    },
  })

  return { farm, produkt, bestellung }
}

describe('cancelOrder — Nebenläufigkeit in der echten Datenbank', () => {
  it('storniert bei zwei gleichzeitigen Aufrufen genau einmal und bucht den Bestand nur einmal zurück', async () => {
    const { produkt, bestellung } = await bestellungZumStornieren(2)

    const [a, b] = await Promise.all([
      cancelOrder(bestellung.id, 'Ware verdorben'),
      cancelOrder(bestellung.id, 'Ware verdorben'),
    ])

    const erfolge = [a, b].filter((r) => !r.error)
    const abgelehnt = [a, b].filter((r) => r.error)
    expect(erfolge).toHaveLength(1)
    expect(abgelehnt).toHaveLength(1)
    expect(abgelehnt[0]!.error).toContain('schon storniert')

    const danach = await prisma.order.findUniqueOrThrow({ where: { id: bestellung.id } })
    expect(danach.status).toBe('CANCELLED')
    expect(danach.cancelledAt).not.toBeNull()
    expect(danach.cancelReason).toBe('Ware verdorben')

    // 5 + 2: genau einmal zurückgebucht. Doppelt wären es 9 — das war der Fehler.
    expect(await prisma.product.findUniqueOrThrow({ where: { id: produkt.id } })).toMatchObject({
      stock: 7,
    })

    // Prüfstelle: Die Kundin bekommt EINE Storno-Mail, nicht zwei.
    await vi.waitFor(() => expect(sendOrderCancelled).toHaveBeenCalledTimes(1))
    // Vor-Ort-Zahlung ohne PaymentIntent: keine Erstattung über Stripe.
    expect(stripe.refunds.create).not.toHaveBeenCalled()
  })

  it('vermerkt die entfallene Servicegebühr genau einmal', async () => {
    const { bestellung } = await bestellungZumStornieren(1)

    await Promise.all([cancelOrder(bestellung.id), cancelOrder(bestellung.id)])

    const danach = await prisma.order.findUniqueOrThrow({ where: { id: bestellung.id } })
    expect(danach.serviceFeeCents).toBe(100)
    expect(danach.serviceFeeRefundedAt).not.toBeNull()

    // Ein dritter Aufruf trifft die Sperre und darf den Vermerk nicht neu setzen.
    const vermerk = danach.serviceFeeRefundedAt
    const dritter = await cancelOrder(bestellung.id)
    expect(dritter.error).toBeDefined()
    const nochmal = await prisma.order.findUniqueOrThrow({ where: { id: bestellung.id } })
    expect(nochmal.serviceFeeRefundedAt).toEqual(vermerk)
  })

  it('storniert eine abgeholte Bestellung nicht und bucht nichts zurück', async () => {
    const { produkt, bestellung } = await bestellungZumStornieren(2)
    await prisma.order.update({
      where: { id: bestellung.id },
      data: { status: 'PICKED_UP', pickedUpAt: new Date() },
    })

    const ergebnis = await cancelOrder(bestellung.id)

    expect(ergebnis.error).toContain('schon storniert')
    expect(await prisma.order.findUniqueOrThrow({ where: { id: bestellung.id } })).toMatchObject({
      status: 'PICKED_UP',
    })
    expect(await prisma.product.findUniqueOrThrow({ where: { id: produkt.id } })).toMatchObject({
      stock: 5,
    })
    expect(sendOrderCancelled).not.toHaveBeenCalled()
  })
})
