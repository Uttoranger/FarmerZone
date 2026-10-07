/**
 * Integrationstest — eine Erstattung scheitert erst NACH dem Buchen (Nr. 19c).
 *
 * Der Fehler: Stripe meldet eine Erstattung zunächst als `pending`; die
 * Datenbank zählt sie in `erstattetCents` (eine zweite wäre doppelt). Scheitert
 * sie Tage später (`refund.failed`, `charge.refund.updated`), stand die
 * Bestellung in der Datenbank weiter als „erstattet" — die Kundin hatte ihr
 * Geld nicht, und niemand erfuhr davon.
 *
 * Die Aussagen, die nur die echte Datenbank beantworten kann:
 *  - Die gescheiterte Erstattung wird GENAU EINMAL zurückgenommen: auch bei
 *    doppelter Zustellung, bei beiden Ereignissen derselben Erstattung und bei
 *    zwei gleichzeitigen Zustellungen. Nie unter Stripes Summe.
 *  - Nach einem gescheiterten Rest-Storno ist die Zahlung wieder offen
 *    (REFUNDED → PAID), die Bestellung bleibt storniert.
 *  - Eine Erstattung ohne unsere Merkmale (Vollstorno, von Hand) oder mit den
 *    Merkmalen einer anderen Bestellung ändert nichts — sie wird gemeldet,
 *    einmal je Erstattung.
 *  - Eine Erstattung, die nicht gescheitert ist, bleibt still.
 *
 * Echt sind Datenbank und Signaturprüfung (Platzhalter-Secret der
 * Integrationsschicht). Gemockt sind Stripes Listen, Mail und Sentry.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/stripe', async () => {
  // Die echten Webhook-Helfer des SDK — Signatur prüfen und im Test erzeugen —,
  // aber keine echte Buchung.
  const { default: Stripe } = await import('stripe')
  const echt = new Stripe('sk_test_integration_dummy')
  return {
    stripe: {
      webhooks: echt.webhooks,
      paymentIntents: { retrieve: vi.fn() },
      refunds: { create: vi.fn(), list: vi.fn() },
      transfers: { createReversal: vi.fn(), listReversals: vi.fn() },
    },
  }
})
vi.mock('@/lib/email', () => ({
  sendOrderConfirmation: vi.fn(),
  sendOrderPaidToFarmer: vi.fn(),
  sendZahlungZuSpaet: vi.fn(),
  sendErstattungOffen: vi.fn(),
}))

import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import * as Sentry from '@sentry/nextjs'
import { POST } from '@/app/api/stripe/webhook/route'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { sendErstattungOffen } from '@/lib/email'
import { INTEGRATIONS_ENV } from './setup/integrations-umgebung'
import { erstelleHof, erstelleProdukt, intKennung, raeumeAuf } from './setup/basis'

type Erstattung = { id: string; amount: number; status: string; metadata: Record<string, string> }

/** Was Stripe zu der Zahlung kennt — die Listen, die `ladeStripeStand` liest. */
let erstattungen: Erstattung[] = []
let rueckbuchungen: Array<{ amount: number; metadata: Record<string, string> }> = []

beforeEach(() => {
  vi.clearAllMocks()
  erstattungen = []
  rueckbuchungen = []
  vi.mocked(stripe.paymentIntents.retrieve).mockResolvedValue({ latest_charge: { id: 'ch_test', transfer: 'tr_test', amount: 1082 } } as never)
  vi.mocked(stripe.refunds.list).mockImplementation((async () => ({ data: erstattungen, has_more: false })) as never)
  vi.mocked(stripe.transfers.listReversals).mockImplementation((async () => ({ data: rueckbuchungen, has_more: false })) as never)
})

afterEach(async () => {
  await raeumeAuf()
})

/**
 * Eine Online-Bestellung Eier € 4,50 + Brot € 5,80 (Gebühr € 0,52, bezahlt
 * € 10,82), bei der das Brot als fehlend gebucht ist: Warenpreis 450, Gebühr
 * 50, erstattet 582. Optional danach storniert (Rest 500 erstattet).
 */
async function nachBrotFehlt(eingabe: { storniert?: boolean } = {}) {
  const { farm } = await erstelleHof()
  const eier = await erstelleProdukt(farm.id, { stock: 5, price: 4.5, name: 'Eier' })
  const brot = await erstelleProdukt(farm.id, { stock: 5, price: 5.8, name: 'Brot' })
  const paymentIntentId = intKennung('pi')
  const order = await prisma.order.create({
    data: {
      orderNumber: intKennung('bestellung').toUpperCase(),
      farmId: farm.id,
      customerEmail: `${intKennung('kundin')}@example.com`,
      customerName: 'Anna Muster',
      customerPhone: '+43 660 0000000',
      status: eingabe.storniert ? 'CANCELLED' : 'PAID',
      totalAmount: new Prisma.Decimal(450).div(100),
      pickupDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      pickupTimeStart: '15:00',
      pickupTimeEnd: '18:00',
      paymentMethod: 'ONLINE',
      paymentStatus: eingabe.storniert ? 'REFUNDED' : 'PAID',
      stripePaymentIntentId: paymentIntentId,
      serviceFeeCents: 50,
      serviceFeePercentApplied: 5,
      serviceFeeMinCentsApplied: 50,
      erstattetCents: eingabe.storniert ? 1082 : 582,
      items: {
        create: [
          { productId: eier.id, productName: 'Eier', unitPrice: 4.5, quantity: 1, totalPrice: 4.5, vatRate: 10 },
          { productId: brot.id, productName: 'Brot', unitPrice: 5.8, quantity: 1, totalPrice: 5.8, vatRate: 10, fehltSeit: new Date() },
        ],
      },
    },
    include: { items: true },
  })
  const brotPosition = order.items.find((i) => i.productName === 'Brot')!
  const teil: Erstattung = {
    id: intKennung('re-teil'),
    amount: 582,
    status: 'succeeded',
    metadata: { orderId: order.id, anlass: 'teilstorno', positionId: brotPosition.id, art: 'kunde' },
  }
  erstattungen.push(teil)
  rueckbuchungen.push({ amount: 580, metadata: { orderId: order.id, anlass: 'teilstorno', positionId: brotPosition.id, art: 'hof' } })
  let rest: Erstattung | null = null
  if (eingabe.storniert) {
    rest = { id: intKennung('re-rest'), amount: 500, status: 'succeeded', metadata: { orderId: order.id, anlass: 'reststorno', art: 'kunde' } }
    erstattungen.push(rest)
    rueckbuchungen.push({ amount: 450, metadata: { orderId: order.id, anlass: 'reststorno', art: 'hof' } })
  }
  return { order, paymentIntentId, teil, rest }
}

/** Stripe meldet die Erstattung jetzt als gescheitert — in der Liste und im Ereignis. */
function scheitert(erstattung: Erstattung): void {
  erstattung.status = 'failed'
}

type Ereignistyp = 'refund.failed' | 'charge.refund.updated'

function ereignis(typ: Ereignistyp, erstattung: Erstattung, paymentIntentId: string, id: string = intKennung('evt'), account?: string) {
  return {
    id,
    object: 'event',
    type: typ,
    ...(account ? { account } : {}),
    data: {
      object: {
        id: erstattung.id,
        object: 'refund',
        amount: erstattung.amount,
        status: erstattung.status,
        failure_reason: erstattung.status === 'failed' ? 'expired_or_canceled_card' : null,
        payment_intent: paymentIntentId,
        metadata: erstattung.metadata,
      },
    },
  }
}

/** Signiert wie Stripe und ruft den Handler direkt — kein HTTP-Server. */
async function zustellen(ev: ReturnType<typeof ereignis>) {
  const koerper = JSON.stringify(ev)
  const signatur = stripe.webhooks.generateTestHeaderString({ payload: koerper, secret: INTEGRATIONS_ENV.STRIPE_WEBHOOK_SECRET })
  return POST(
    new NextRequest('http://localhost:3000/api/stripe/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': signatur, 'content-type': 'application/json' },
      body: koerper,
    })
  )
}

/** Den Nachlauf (Mails über nachDerAntwort) beider Zustellungen ganz abwarten, dann erst zählen. */
async function nachlaufFertig(): Promise<void> {
  await new Promise((fertig) => setTimeout(fertig, 200))
}

function meldungen(grund: string): number {
  return vi.mocked(Sentry.captureMessage).mock.calls.filter(([, kontext]) => {
    const tags = (kontext as { tags?: Record<string, string> } | undefined)?.tags
    return tags?.grund === grund
  }).length
}

describe('refund.failed — Teilerstattung nach „Artikel fehlt" gescheitert', () => {
  it('nimmt genau diesen Betrag zurück, meldet an Sentry und den Betreiber — ohne Daten der Kundin', async () => {
    const { order, paymentIntentId, teil } = await nachBrotFehlt()
    scheitert(teil)

    const antwort = await zustellen(ereignis('refund.failed', teil, paymentIntentId))

    expect(antwort.status).toBe(200)
    const danach = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(danach.erstattetCents).toBe(0)
    // Die Position fehlt weiter (sie ist nicht da), Warenpreis und Gebühr bleiben.
    expect(danach.status).toBe('PAID')
    expect(danach.paymentStatus).toBe('PAID')
    expect(danach.serviceFeeCents).toBe(50)
    expect(meldungen('erstattung_gescheitert_zurueckgenommen')).toBe(1)
    await vi.waitFor(() => expect(sendErstattungOffen).toHaveBeenCalledTimes(1))
    const meldung = vi.mocked(sendErstattungOffen).mock.calls[0]![0]
    expect(meldung).toMatchObject({ bestellId: order.id, betraege: [expect.objectContaining({ cents: 582 })] })
    const sentryText = JSON.stringify(vi.mocked(Sentry.captureMessage).mock.calls)
    for (const text of [JSON.stringify(meldung), sentryText]) {
      expect(text).not.toContain('Anna')
      expect(text).not.toContain('@example.com')
    }
  })

  it('dasselbe Ereignis zweimal und dazu charge.refund.updated: genau einmal zurückgenommen, einmal gemeldet', async () => {
    const { order, paymentIntentId, teil } = await nachBrotFehlt()
    scheitert(teil)
    const ev = ereignis('refund.failed', teil, paymentIntentId)

    const antworten = [
      await zustellen(ev),
      await zustellen(ev),
      await zustellen(ereignis('charge.refund.updated', teil, paymentIntentId)),
    ]

    expect(antworten.map((a) => a.status)).toEqual([200, 200, 200])
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).erstattetCents).toBe(0)
    expect(meldungen('erstattung_gescheitert_zurueckgenommen')).toBe(1)
    await vi.waitFor(() => expect(sendErstattungOffen).toHaveBeenCalledTimes(1))
  })

  it('zwei gleichzeitige Zustellungen (beide Ereignisse): nie doppelt zurückgenommen', async () => {
    const { order, paymentIntentId, teil } = await nachBrotFehlt()
    scheitert(teil)

    const antworten = await Promise.all([
      zustellen(ereignis('refund.failed', teil, paymentIntentId)),
      zustellen(ereignis('charge.refund.updated', teil, paymentIntentId)),
    ])

    // Welcher Zweig gewinnt, entscheidet die Maschine; eine 500 heißt
    // „Stripe stellt erneut zu" und ist ein gültiger Ausgang.
    for (const a of antworten) expect([200, 500]).toContain(a.status)
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).erstattetCents).toBe(0)
    // Auch die Neuzustellung einer 500 meldet nichts mehr (Vermerk der Zurücknahme).
    await zustellen(ereignis('refund.failed', teil, paymentIntentId))
    await nachlaufFertig()
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
    expect(meldungen('erstattung_gescheitert_zurueckgenommen')).toBe(1)
    expect(sendErstattungOffen).toHaveBeenCalledTimes(1)
  })

  it('stimmt die Datenbank weder vorher noch nachher mit Stripe überein: nichts geändert, als unklar gemeldet', async () => {
    const { order, paymentIntentId, teil } = await nachBrotFehlt()
    await prisma.order.update({ where: { id: order.id }, data: { erstattetCents: 900 } })
    scheitert(teil)

    const antwort = await zustellen(ereignis('refund.failed', teil, paymentIntentId))

    expect(antwort.status).toBe(200)
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).erstattetCents).toBe(900)
    expect(meldungen('erstattung_gescheitert_unklar')).toBe(1)
    await vi.waitFor(() => expect(sendErstattungOffen).toHaveBeenCalledTimes(1))
  })
})

describe('refund.failed — Rest-Storno gescheitert', () => {
  it('nimmt den Rest zurück und öffnet die Zahlung wieder (REFUNDED → PAID), die Bestellung bleibt storniert', async () => {
    const { order, paymentIntentId, rest } = await nachBrotFehlt({ storniert: true })
    scheitert(rest!)

    const antwort = await zustellen(ereignis('charge.refund.updated', rest!, paymentIntentId))

    expect(antwort.status).toBe(200)
    const danach = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(danach.erstattetCents).toBe(582)
    expect(danach.status).toBe('CANCELLED')
    expect(danach.paymentStatus).toBe('PAID')
    expect(meldungen('erstattung_gescheitert_zurueckgenommen')).toBe(1)
  })
})

describe('Erstattungen, die nicht nachweislich zu einer unserer Buchungen gehören', () => {
  it('ohne unsere Merkmale (Vollstorno, von Hand): nichts geändert, einmal gemeldet — auch beim zweiten Ereignis', async () => {
    const { order, paymentIntentId } = await nachBrotFehlt({ storniert: true })
    const fremd: Erstattung = { id: intKennung('re-hand'), amount: 300, status: 'failed', metadata: {} }

    await zustellen(ereignis('refund.failed', fremd, paymentIntentId))
    await zustellen(ereignis('charge.refund.updated', fremd, paymentIntentId))

    const danach = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(danach.erstattetCents).toBe(1082)
    expect(danach.paymentStatus).toBe('REFUNDED')
    expect(meldungen('erstattung_gescheitert_fremd')).toBe(1)
    await vi.waitFor(() => expect(sendErstattungOffen).toHaveBeenCalledTimes(1))
    // Die Bestellung zur Zahlung wird zum Wiederfinden genannt, nicht geändert.
    expect(vi.mocked(sendErstattungOffen).mock.calls[0]![0]).toMatchObject({ bestellId: order.id })
    expect(stripe.refunds.list).not.toHaveBeenCalled()
  })

  it('mit den Merkmalen einer ANDEREN Bestellung als der der Zahlung: nichts geändert, gemeldet', async () => {
    const a = await nachBrotFehlt()
    const b = await nachBrotFehlt()
    scheitert(a.teil)

    await zustellen(ereignis('refund.failed', a.teil, b.paymentIntentId))

    expect((await prisma.order.findUniqueOrThrow({ where: { id: a.order.id } })).erstattetCents).toBe(582)
    expect((await prisma.order.findUniqueOrThrow({ where: { id: b.order.id } })).erstattetCents).toBe(582)
    expect(meldungen('erstattung_gescheitert_fremd')).toBe(1)
  })

  it('eine Erstattung, die nicht gescheitert ist (charge.refund.updated mit succeeded): still, nichts geändert', async () => {
    const { order, paymentIntentId, teil } = await nachBrotFehlt()

    const antwort = await zustellen(ereignis('charge.refund.updated', teil, paymentIntentId))

    expect(antwort.status).toBe(200)
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).erstattetCents).toBe(582)
    expect(Sentry.captureMessage).not.toHaveBeenCalled()
    expect(sendErstattungOffen).not.toHaveBeenCalled()
  })
})

describe('Nachbesserung Runde 1', () => {
  it('die Liste führt die gescheiterte Erstattung noch als pending: trotzdem genau einmal zurückgenommen', async () => {
    const { order, paymentIntentId, teil } = await nachBrotFehlt()
    // Das Ereignis sagt verbindlich „gescheitert", refunds.list hinkt hinterher.
    teil.status = 'pending'
    const ev = ereignis('refund.failed', { ...teil, status: 'failed' }, paymentIntentId)

    const antworten = [await zustellen(ev), await zustellen(ereignis('charge.refund.updated', { ...teil, status: 'failed' }, paymentIntentId))]

    expect(antworten.map((a) => a.status)).toEqual([200, 200])
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).erstattetCents).toBe(0)
    expect(meldungen('erstattung_gescheitert_zurueckgenommen')).toBe(1)
    await vi.waitFor(() => expect(sendErstattungOffen).toHaveBeenCalledTimes(1))
  })

  it('nie gezählt (Datenbank = Stripe ohne die gescheiterte): nichts geändert, genau eine Meldung, auch beim zweiten Ereignis', async () => {
    const { order, paymentIntentId, teil } = await nachBrotFehlt()
    await prisma.order.update({ where: { id: order.id }, data: { erstattetCents: 0 } })
    scheitert(teil)

    await zustellen(ereignis('refund.failed', teil, paymentIntentId))
    expect(meldungen('erstattung_gescheitert_nicht_gezaehlt')).toBe(1)
    vi.mocked(Sentry.captureMessage).mockClear()
    await zustellen(ereignis('charge.refund.updated', teil, paymentIntentId))

    // Das zweite Ereignis meldet nichts.
    expect(meldungen('erstattung_gescheitert_nicht_gezaehlt')).toBe(0)
    expect(Sentry.captureMessage).not.toHaveBeenCalled()
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).erstattetCents).toBe(0)
    await nachlaufFertig()
    expect(sendErstattungOffen).toHaveBeenCalledTimes(1)
  })

  it('nie gezählt, beide Ereignisse gleichzeitig: genau eine Meldung und eine Mail', async () => {
    const { order, paymentIntentId, teil } = await nachBrotFehlt()
    await prisma.order.update({ where: { id: order.id }, data: { erstattetCents: 0 } })
    scheitert(teil)

    const antworten = await Promise.all([
      zustellen(ereignis('refund.failed', teil, paymentIntentId)),
      zustellen(ereignis('charge.refund.updated', teil, paymentIntentId)),
    ])

    expect(antworten.map((a) => a.status)).toEqual([200, 200])
    await nachlaufFertig()
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
    expect(sendErstattungOffen).toHaveBeenCalledTimes(1)
  })

  it('zurückgenommen, danach das zweite Ereignis: es findet den Vermerk der Zurücknahme und meldet nichts', async () => {
    const { paymentIntentId, teil } = await nachBrotFehlt()
    scheitert(teil)

    await zustellen(ereignis('refund.failed', teil, paymentIntentId))
    expect(meldungen('erstattung_gescheitert_zurueckgenommen')).toBe(1)
    vi.mocked(Sentry.captureMessage).mockClear()
    await zustellen(ereignis('charge.refund.updated', teil, paymentIntentId))

    expect(Sentry.captureMessage).not.toHaveBeenCalled()
    await nachlaufFertig()
    expect(sendErstattungOffen).toHaveBeenCalledTimes(1)
  })

  it('Zahlung ohne Überweisung: 200, nichts geändert, als unklar gemeldet (keine stumme Neuzustellung)', async () => {
    const { order, paymentIntentId, teil } = await nachBrotFehlt()
    vi.mocked(stripe.paymentIntents.retrieve).mockResolvedValue({ latest_charge: { id: 'ch_test', transfer: null, amount: 1082 } } as never)
    scheitert(teil)

    const antwort = await zustellen(ereignis('refund.failed', teil, paymentIntentId))

    expect(antwort.status).toBe(200)
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).erstattetCents).toBe(582)
    expect(meldungen('erstattung_gescheitert_unklar')).toBe(1)
  })

  it('charge.refund.updated mit Status pending: still, nichts geändert', async () => {
    const { order, paymentIntentId, teil } = await nachBrotFehlt()
    teil.status = 'pending'

    const antwort = await zustellen(ereignis('charge.refund.updated', teil, paymentIntentId))

    expect(antwort.status).toBe(200)
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).erstattetCents).toBe(582)
    expect(Sentry.captureMessage).not.toHaveBeenCalled()
    expect(sendErstattungOffen).not.toHaveBeenCalled()
  })

  it('refund.failed eines verbundenen Hof-Kontos (event.account gesetzt): ignoriert', async () => {
    const { order, paymentIntentId, teil } = await nachBrotFehlt()
    scheitert(teil)

    const antwort = await zustellen(ereignis('refund.failed', teil, paymentIntentId, intKennung('evt'), 'acct_int_hof'))

    expect(antwort.status).toBe(200)
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).erstattetCents).toBe(582)
    expect(stripe.refunds.list).not.toHaveBeenCalled()
    expect(Sentry.captureMessage).not.toHaveBeenCalled()
    expect(sendErstattungOffen).not.toHaveBeenCalled()
  })
})

describe('refund.failed — Vollerstattung mit Merkmalen gescheitert (Nr. 27)', () => {
  /**
   * Eine Online-Bestellung Eier € 4,50 + Brot € 5,80 (Gebühr € 0,52, bezahlt
   * € 10,82), vom Hof storniert und voll erstattet (reverse_transfer): Die
   * Datenbank vermerkt das nur über REFUNDED, `erstattetCents` bleibt 0.
   */
  async function vollStorniert(eingabe: { merkmale?: boolean } = {}) {
    const { farm } = await erstelleHof()
    const eier = await erstelleProdukt(farm.id, { stock: 5, price: 4.5, name: 'Eier' })
    const paymentIntentId = intKennung('pi')
    const order = await prisma.order.create({
      data: {
        orderNumber: intKennung('bestellung').toUpperCase(),
        farmId: farm.id,
        customerEmail: `${intKennung('kundin')}@example.com`,
        customerName: 'Anna Muster',
        customerPhone: '+43 660 0000000',
        status: 'CANCELLED',
        totalAmount: new Prisma.Decimal(1030).div(100),
        pickupDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        pickupTimeStart: '15:00',
        pickupTimeEnd: '18:00',
        paymentMethod: 'ONLINE',
        paymentStatus: 'REFUNDED',
        stripePaymentIntentId: paymentIntentId,
        serviceFeeCents: 52,
        erstattetCents: 0,
        items: { create: [{ productId: eier.id, productName: 'Eier', unitPrice: 10.3, quantity: 1, totalPrice: 10.3, vatRate: 10 }] },
      },
    })
    const voll: Erstattung = {
      id: intKennung('re-voll'),
      amount: 1082,
      status: 'succeeded',
      metadata: eingabe.merkmale === false ? {} : { orderId: order.id, anlass: 'vollstorno', art: 'kunde' },
    }
    erstattungen.push(voll)
    return { order, paymentIntentId, voll }
  }

  it('öffnet die Zahlung wieder (REFUNDED → PAID), die Bestellung bleibt storniert; Meldung an Sentry und den Betreiber ohne Daten der Kundin', async () => {
    const { order, paymentIntentId, voll } = await vollStorniert()
    scheitert(voll)

    const antwort = await zustellen(ereignis('refund.failed', voll, paymentIntentId))

    expect(antwort.status).toBe(200)
    const danach = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(danach.status).toBe('CANCELLED')
    expect(danach.paymentStatus).toBe('PAID')
    expect(danach.erstattetCents).toBe(0)
    expect(meldungen('erstattung_gescheitert_zurueckgenommen')).toBe(1)
    await vi.waitFor(() => expect(sendErstattungOffen).toHaveBeenCalledTimes(1))
    const meldung = vi.mocked(sendErstattungOffen).mock.calls[0]![0]
    expect(meldung).toMatchObject({ bestellId: order.id, betraege: [expect.objectContaining({ cents: 1082 })] })
    expect(meldung.handanweisung).toContain('Vollerstattung')
    const sentryText = JSON.stringify(vi.mocked(Sentry.captureMessage).mock.calls)
    for (const text of [JSON.stringify(meldung), sentryText]) {
      expect(text).not.toContain('Anna')
      expect(text).not.toContain('@example.com')
    }
  })

  it('beide Ereignisse und eine erneute Zustellung: genau einmal zurückgenommen, einmal gemeldet', async () => {
    const { order, paymentIntentId, voll } = await vollStorniert()
    scheitert(voll)
    const ev = ereignis('refund.failed', voll, paymentIntentId)

    const antworten = [await zustellen(ev), await zustellen(ev), await zustellen(ereignis('charge.refund.updated', voll, paymentIntentId))]

    expect(antworten.map((a) => a.status)).toEqual([200, 200, 200])
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe('PAID')
    await nachlaufFertig()
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
    expect(sendErstattungOffen).toHaveBeenCalledTimes(1)
  })

  it('beide Ereignisse gleichzeitig: nie doppelt, genau eine Meldung', async () => {
    const { order, paymentIntentId, voll } = await vollStorniert()
    scheitert(voll)

    const antworten = await Promise.all([
      zustellen(ereignis('refund.failed', voll, paymentIntentId)),
      zustellen(ereignis('charge.refund.updated', voll, paymentIntentId)),
    ])

    for (const a of antworten) expect([200, 500]).toContain(a.status)
    await zustellen(ereignis('refund.failed', voll, paymentIntentId))
    await nachlaufFertig()
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe('PAID')
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
    expect(sendErstattungOffen).toHaveBeenCalledTimes(1)
  })

  it('Stripe kennt daneben eine weitere zählende Erstattung (von Hand nachgeholt): nichts geändert, als unklar gemeldet', async () => {
    const { order, paymentIntentId, voll } = await vollStorniert()
    erstattungen.push({ id: intKennung('re-hand'), amount: 1082, status: 'succeeded', metadata: {} })
    scheitert(voll)

    const antwort = await zustellen(ereignis('refund.failed', voll, paymentIntentId))

    expect(antwort.status).toBe(200)
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe('REFUNDED')
    expect(meldungen('erstattung_gescheitert_unklar')).toBe(1)
  })

  it('Betrag passt nicht zum bezahlten Betrag der Bestellung: nichts geändert, als unklar gemeldet', async () => {
    const { order, paymentIntentId, voll } = await vollStorniert()
    voll.amount = 900
    scheitert(voll)

    await zustellen(ereignis('refund.failed', voll, paymentIntentId))

    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe('REFUNDED')
    expect(meldungen('erstattung_gescheitert_unklar')).toBe(1)
  })

  it('Merkmale einer anderen Bestellung als der der Zahlung: nichts geändert, als fremd gemeldet', async () => {
    const a = await vollStorniert()
    const b = await vollStorniert()
    scheitert(a.voll)

    await zustellen(ereignis('refund.failed', a.voll, b.paymentIntentId))

    expect((await prisma.order.findUniqueOrThrow({ where: { id: a.order.id } })).paymentStatus).toBe('REFUNDED')
    expect((await prisma.order.findUniqueOrThrow({ where: { id: b.order.id } })).paymentStatus).toBe('REFUNDED')
    expect(meldungen('erstattung_gescheitert_fremd')).toBe(1)
  })

  it('Gegenprobe: eine Vollerstattung OHNE Merkmale (vor Nr. 27) bleibt wie bisher nur gemeldet', async () => {
    const { order, paymentIntentId, voll } = await vollStorniert({ merkmale: false })
    scheitert(voll)

    await zustellen(ereignis('refund.failed', voll, paymentIntentId))

    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).paymentStatus).toBe('REFUNDED')
    expect(meldungen('erstattung_gescheitert_fremd')).toBe(1)
    expect(stripe.refunds.list).not.toHaveBeenCalled()
  })
})

describe('Nachbesserung Runde 1 (Nr. 27) — sofort gescheiterter Storno schon gemeldet', () => {
  it('der Storno hat den Vermerk gesetzt: ein späteres refund.failed ändert nichts und meldet nicht ein zweites Mal', async () => {
    const { order, paymentIntentId, teil } = await nachBrotFehlt()
    // Wie nach einem Storno, dessen Erstattung Stripe sofort als gescheitert
    // zurückgab: nie als erstattet gebucht, Betreiber schon benachrichtigt.
    const rest: Erstattung = { id: intKennung('re-rest'), amount: 500, status: 'failed', metadata: { orderId: order.id, anlass: 'reststorno', art: 'kunde' } }
    erstattungen.push(rest)
    await prisma.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } })
    await prisma.webhookEvent.create({ data: { stripeEventId: `${rest.id}#gescheitert-gemeldet`, type: 'meldung.erstattung_gescheitert' } })
    void teil

    const antwort = await zustellen(ereignis('refund.failed', rest, paymentIntentId))

    expect(antwort.status).toBe(200)
    const danach = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(danach.erstattetCents).toBe(582)
    expect(danach.paymentStatus).toBe('PAID')
    await nachlaufFertig()
    expect(Sentry.captureMessage).not.toHaveBeenCalled()
    expect(sendErstattungOffen).not.toHaveBeenCalled()
  })
})
