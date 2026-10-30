/**
 * Integrationstest — Widerruf online (§ 13a FAGG, Register N39, Nr. 200).
 *
 * Was nur die echte Datenbank beantworten kann:
 *  - Vor der Abholung storniert der Widerruf über `storniere`: Status,
 *    Bestand zurück, Erstattung an Stripe, Stand `erstattet` ohne den Hof.
 *    Einzelne Positionen über „Artikel fehlt": dieselben Beträge in Cent.
 *  - Nach der Abholung erstattet der Hof über teilerstattung.ts: Artikelpreis
 *    plus Gebührendifferenz an die Kundin, genau der Artikelpreis vom Hof (in
 *    Cent); ein zweiter Klick bucht nichts. Bar: kein Stripe, Vermerk.
 *  - Ohne Link: zugeordnet nur bei Nummer UND Adresse; das Protokoll vermerkt es.
 *  - Ablehnen nur für den eigenen Hof; die Mail mit Grund steht als Auftrag.
 *
 * Stripe ist gemockt (Buchungen werden gezählt, Idempotenz je Schlüssel).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/stripe', () => ({
  stripe: {
    refunds: { create: vi.fn(), list: vi.fn() },
    paymentIntents: { create: vi.fn(), retrieve: vi.fn() },
    transfers: { createReversal: vi.fn(), listReversals: vi.fn() },
  },
}))
vi.mock('@/lib/email', async (original) => ({ ...(await original<typeof import('@/lib/email')>()), sendWiderrufEingang: vi.fn(async () => ({ id: 'mail' })) }))

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { sendWiderrufEingang } from '@/lib/email'
import { erstatteWiderruf, legeWiderrufAn, lehneWiderrufAb, verarbeiteWiderruf } from '@/server/widerruf'
import { BAR_ERSTATTET } from '@/lib/widerruf'
import { INT_PRAEFIX, auftraege, erstelleHof, erstelleProdukt, intKennung, raeumeAuf } from './setup/basis'

type Buchung = { schluessel: string; betrag: number; metadata: Record<string, string> }
let erstattungen: Buchung[] = []
let rueckbuchungen: Buchung[] = []
let bezahlt = 0

beforeEach(() => {
  vi.clearAllMocks()
  erstattungen = []
  rueckbuchungen = []
  const buche = (liste: Buchung[], schluessel: string, betrag: number, metadata: Record<string, string> = {}) => {
    const alt = liste.find((b) => b.schluessel === schluessel)
    if (alt) return alt
    const neu = { schluessel, betrag, metadata }
    liste.push(neu)
    return neu
  }
  vi.mocked(stripe.refunds.create).mockImplementation((async (w: { amount?: number; metadata?: Record<string, string> }, o: { idempotencyKey: string }) => {
    const b = buche(erstattungen, o.idempotencyKey, w.amount ?? bezahlt, w.metadata)
    return { id: `re_${erstattungen.indexOf(b)}`, amount: b.betrag, status: 'succeeded', metadata: b.metadata }
  }) as never)
  vi.mocked(stripe.transfers.createReversal).mockImplementation((async (_t: string, w: { amount: number; metadata?: Record<string, string> }, o: { idempotencyKey: string }) => {
    const b = buche(rueckbuchungen, o.idempotencyKey, w.amount, w.metadata)
    return { id: `trr_${rueckbuchungen.indexOf(b)}`, amount: b.betrag, metadata: b.metadata }
  }) as never)
  vi.mocked(stripe.refunds.list).mockImplementation((async () => ({
    data: erstattungen.map((b) => ({ amount: b.betrag, metadata: b.metadata, status: 'succeeded' })),
    has_more: false,
  })) as never)
  vi.mocked(stripe.transfers.listReversals).mockImplementation((async () => ({
    data: rueckbuchungen.map((b) => ({ amount: b.betrag, metadata: b.metadata })),
    has_more: false,
  })) as never)
  vi.mocked(stripe.paymentIntents.retrieve).mockImplementation((async () => ({ id: 'pi', latest_charge: { id: 'ch', transfer: 'tr_test', amount: bezahlt } })) as never)
})

afterEach(async () => {
  await prisma.widerruf.deleteMany({ where: { email: { startsWith: INT_PRAEFIX } } })
  await raeumeAuf()
})

/** Eine Bestellung mit Eier (4,50) und Brot (5,80); Vorrat je 5. */
async function bestellung(e: { online: boolean; abgeholt: boolean; gebuehrCents: number }) {
  const { farm } = await erstelleHof()
  const eier = await erstelleProdukt(farm.id, { stock: 5, price: 4.5, name: 'Eier' })
  const brot = await erstelleProdukt(farm.id, { stock: 5, price: 5.8, name: 'Brot' })
  bezahlt = e.online ? 1030 + e.gebuehrCents : 0
  const order = await prisma.order.create({
    data: {
      orderNumber: intKennung('nr').toUpperCase(),
      farmId: farm.id,
      customerEmail: `${intKennung('kundin')}@example.com`,
      customerName: 'Erika Test',
      customerPhone: '+43 660 0000000',
      status: e.abgeholt ? 'PICKED_UP' : e.online ? 'PAID' : 'CONFIRMED',
      pickedUpAt: e.abgeholt ? new Date() : null,
      totalAmount: new Prisma.Decimal(1030).div(100),
      pickupDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      pickupTimeStart: '15:00',
      pickupTimeEnd: '18:00',
      paymentMethod: e.online ? 'ONLINE' : 'ONSITE_CASH',
      paymentStatus: e.online ? 'PAID' : 'PENDING',
      stripePaymentIntentId: e.online ? `pi_${intKennung('zahlung')}` : null,
      serviceFeeCents: e.gebuehrCents,
      serviceFeePercentApplied: e.gebuehrCents > 0 ? 5 : null,
      serviceFeeMinCentsApplied: 50,
      items: {
        create: [
          { productId: eier.id, productName: 'Eier', unitPrice: 4.5, quantity: 1, totalPrice: 4.5, vatRate: 10 },
          { productId: brot.id, productName: 'Brot', unitPrice: 5.8, quantity: 1, totalPrice: 5.8, vatRate: 10 },
        ],
      },
    },
    include: { items: true },
  })
  const position = (name: string) => order.items.find((i) => i.productName === name)!.id
  return { farm, order, eier, brot, position }
}

const cents = (d: Prisma.Decimal) => Math.round(d.mul(100).toNumber())

describe('vor der Abholung: der Widerruf storniert', () => {
  it('ganz, online: storniert, Bestand zurück, Erstattung des ganzen Betrags, Stand erstattet, Eingangsbestätigung', async () => {
    const { order, eier, brot } = await bestellung({ online: true, abgeholt: false, gebuehrCents: 52 })
    const angelegt = await legeWiderrufAn({ art: 'link', orderId: order.id, umfang: 'ganz', positionen: [], name: 'Erika Test' }, new Date())
    if (!('ok' in angelegt)) throw new Error('nicht angelegt')
    await verarbeiteWiderruf(angelegt.widerrufId, true)

    const nachher = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(nachher.status).toBe('CANCELLED')
    expect(nachher.paymentStatus).toBe('REFUNDED')
    expect((await prisma.product.findUniqueOrThrow({ where: { id: eier.id } })).stock).toBe(6)
    expect((await prisma.product.findUniqueOrThrow({ where: { id: brot.id } })).stock).toBe(6)
    expect(vi.mocked(stripe.refunds.create)).toHaveBeenCalledTimes(1)
    expect((await prisma.widerruf.findUniqueOrThrow({ where: { id: angelegt.widerrufId } })).stand).toBe('erstattet')
    expect(sendWiderrufEingang).toHaveBeenCalledWith(order.customerEmail, expect.objectContaining({ bestellnummer: order.orderNumber }), expect.objectContaining({ bestellungId: order.id }))
    // Die Storno-Mail steht wie beim Storno als Auftrag.
    expect((await auftraege({ bestellungId: order.id, art: 'storniert' })).length).toBe(1)
  })

  it('eine Position, online: dieselbe Teilerstattung wie „Artikel fehlt" (Brot 5,80 + Gebührendifferenz), in Cent', async () => {
    const { order, position } = await bestellung({ online: true, abgeholt: false, gebuehrCents: 52 })
    const angelegt = await legeWiderrufAn({ art: 'link', orderId: order.id, umfang: 'teil', positionen: [position('Brot')], name: 'Erika Test' }, new Date())
    if (!('ok' in angelegt)) throw new Error('nicht angelegt')
    await verarbeiteWiderruf(angelegt.widerrufId, true)

    expect(erstattungen.map((b) => b.betrag)).toEqual([582])
    expect(rueckbuchungen.map((b) => b.betrag)).toEqual([580])
    const nachher = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(nachher.status).toBe('PAID')
    expect(cents(nachher.totalAmount)).toBe(450)
    expect(nachher.erstattetCents).toBe(582)
    expect((await prisma.widerruf.findUniqueOrThrow({ where: { id: angelegt.widerrufId } })).stand).toBe('erstattet')
  })
})

describe('nach der Abholung: der Hof erstattet oder lehnt ab', () => {
  it('Position online: Kundin 582 Cent, vom Hof 580 Cent; ein zweiter Klick bucht nichts; Mail mit Betrag', async () => {
    const { farm, order, position } = await bestellung({ online: true, abgeholt: true, gebuehrCents: 52 })
    const angelegt = await legeWiderrufAn({ art: 'link', orderId: order.id, umfang: 'teil', positionen: [position('Brot')], name: 'Erika Test' }, new Date())
    if (!('ok' in angelegt)) throw new Error('nicht angelegt')
    await verarbeiteWiderruf(angelegt.widerrufId, true)
    // Nach der Abholung geht er an den Hof — nichts gebucht, Stand offen, Mail an den Hof.
    expect(erstattungen).toEqual([])
    expect((await auftraege({ bestellungId: order.id, art: 'widerruf-hof' })).length).toBe(1)

    const ergebnis = await erstatteWiderruf({ id: farm.id }, angelegt.widerrufId, new Date())
    expect(ergebnis).toEqual({ ok: true, erstattetCents: 582 })
    expect(erstattungen.map((b) => b.betrag)).toEqual([582])
    expect(rueckbuchungen.map((b) => b.betrag)).toEqual([580])
    const nachher = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect([nachher.status, cents(nachher.totalAmount), nachher.serviceFeeCents, nachher.erstattetCents]).toEqual(['PICKED_UP', 450, 50, 582])

    expect(await erstatteWiderruf({ id: farm.id }, angelegt.widerrufId, new Date())).toEqual({ error: 'nicht_offen' })
    expect(erstattungen).toHaveLength(1)
    const [mail] = await auftraege({ bestellungId: order.id, art: 'widerruf-erstattet' })
    expect(mail?.bezug).toEqual({ widerrufId: angelegt.widerrufId, erstattetCents: '582' })
  })

  it('ganz bar: kein Stripe, Warenpreis und Gebühr 0, Vermerk „bar erstattet“', async () => {
    const { farm, order } = await bestellung({ online: false, abgeholt: true, gebuehrCents: 52 })
    const angelegt = await legeWiderrufAn({ art: 'link', orderId: order.id, umfang: 'ganz', positionen: [], name: 'Erika Test' }, new Date())
    if (!('ok' in angelegt)) throw new Error('nicht angelegt')
    expect(await erstatteWiderruf({ id: farm.id }, angelegt.widerrufId, new Date())).toEqual({ ok: true, erstattetCents: null })
    expect(stripe.refunds.create).not.toHaveBeenCalled()
    const nachher = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect([cents(nachher.totalAmount), nachher.serviceFeeCents]).toEqual([0, 0])
    const w = await prisma.widerruf.findUniqueOrThrow({ where: { id: angelegt.widerrufId } })
    expect([w.stand, w.grund]).toEqual(['erstattet', BAR_ERSTATTET])
  })

  it('Ablehnen: fremder Hof nie; eigener Hof mit Grund, Mail als Auftrag', async () => {
    const { farm, order } = await bestellung({ online: true, abgeholt: true, gebuehrCents: 52 })
    const { farm: fremd, owner } = await erstelleHof()
    const angelegt = await legeWiderrufAn({ art: 'link', orderId: order.id, umfang: 'ganz', positionen: [], name: 'Erika Test' }, new Date())
    if (!('ok' in angelegt)) throw new Error('nicht angelegt')
    expect(await lehneWiderrufAb({ id: fremd.id }, angelegt.widerrufId, 'Ware verdorben', owner.id, new Date())).toBe(false)
    expect(await erstatteWiderruf({ id: fremd.id }, angelegt.widerrufId, new Date())).toEqual({ error: 'nicht_offen' })
    expect(await lehneWiderrufAb({ id: farm.id }, angelegt.widerrufId, 'Frische Eier, schnell verderblich', owner.id, new Date())).toBe(true)
    const w = await prisma.widerruf.findUniqueOrThrow({ where: { id: angelegt.widerrufId } })
    expect([w.stand, w.grund]).toEqual(['abgelehnt', 'Frische Eier, schnell verderblich'])
    expect((await auftraege({ bestellungId: order.id, art: 'widerruf-abgelehnt' })).length).toBe(1)
    expect(await prisma.adminAktion.count({ where: { art: 'widerruf_abgelehnt', bezugId: order.id } })).toBe(1)
    await prisma.adminAktion.deleteMany({ where: { bezugId: order.id } })
  })
})

describe('ohne Link', () => {
  it('Nummer UND Adresse → zugeordnet (Protokoll); andere Adresse → nicht zugeordnet', async () => {
    const { order } = await bestellung({ online: false, abgeholt: true, gebuehrCents: 0 })
    const passt = await legeWiderrufAn(
      { art: 'frei', name: 'Erika Test', email: order.customerEmail.toUpperCase(), bestellnummer: order.orderNumber.toLowerCase(), umfang: 'ganz' },
      new Date()
    )
    const fremd = await legeWiderrufAn(
      { art: 'frei', name: 'Erika Test', email: `${intKennung('andere')}@example.com`, bestellnummer: order.orderNumber, umfang: 'ganz' },
      new Date()
    )
    if (!('ok' in passt) || !('ok' in fremd)) throw new Error('nicht angelegt')
    expect((await prisma.widerruf.findUniqueOrThrow({ where: { id: passt.widerrufId } })).orderId).toBe(order.id)
    expect((await prisma.widerruf.findUniqueOrThrow({ where: { id: fremd.widerrufId } })).orderId).toBeNull()
    expect(await prisma.adminAktion.count({ where: { art: 'widerruf_zugeordnet', bezugId: order.id } })).toBe(1)
    await prisma.adminAktion.deleteMany({ where: { bezugId: order.id } })
    // Die Großschreibung der eingegebenen Adresse bleibt beim Widerruf; aufgeräumt wird über das Präfix.
    await prisma.widerruf.deleteMany({ where: { id: passt.widerrufId } })
  })
})
