/**
 * Integrationstest — „Artikel fehlt" und Storno danach (E14, Nachtlauf Nr. 19).
 *
 * Die Aussagen, die nur die echte Datenbank beantworten kann:
 *  - Die Rechenbeispiele der Freigabe (freigabe.md 1a) landen so in der
 *    Datenbank: bar € 5,00 zu kassieren, online € 5,82 an die Kundin und
 *    genau € 5,80 vom Hof.
 *  - Doppeltipp (zwei gleichzeitige Aufrufe) = EINE Erstattung, EIN Vermerk.
 *  - Scheitert Stripe, steht die Bestellung unverändert da; der zweite Versuch
 *    geht durch. Kam die Antwort von Stripe nur nicht an, liefert der zweite
 *    Versuch über den Schlüssel dieselbe Erstattung — keine zweite.
 *  - Die Summe der Erstattungen übersteigt nie den bezahlten Betrag, auch
 *    nicht bei zwei fehlenden Artikeln gleichzeitig und einem Storno danach.
 *  - Storno doppelt geklickt = eine Erstattung, auch nach einer Teilerstattung.
 *  - Der Checkout schreibt den Snapshot der Mindestgebühr.
 *
 * Stripe ist gemockt, aber MIT der Idempotenz echter Schlüssel: Derselbe
 * Schlüssel mit denselben Werten liefert dieselbe Erstattung, mit anderen
 * Werten einen Fehler (wie Stripe). Gezählt wird, was Stripe wirklich
 * „ausgezahlt" hätte — das ist die Zusicherung, die das Geld schützt.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/lib/stripe', () => ({
  stripe: {
    refunds: { create: vi.fn(), list: vi.fn() },
    paymentIntents: { create: vi.fn(), retrieve: vi.fn() },
    transfers: { createReversal: vi.fn(), listReversals: vi.fn() },
  },
}))
vi.mock('@/lib/email', () => ({
  sendOrderReady: vi.fn(),
  sendOrderCancelled: vi.fn(),
  sendOrderNotReady: vi.fn(),
  sendArtikelFehlt: vi.fn(),
  sendOnsiteConfirmation: vi.fn(),
  sendErstattungOffen: vi.fn(),
}))

import { headers } from 'next/headers'
import * as Sentry from '@sentry/nextjs'
import { Prisma } from '@prisma/client'
import { cancelOrder, meldeArtikelFehlt } from '@/server/actions/orders'
import { getHofBestellDetail } from '@/server/queries/orders'
import { getTopProdukte, getYtdRevenue } from '@/server/queries/analytics'
import { getMeistverkaufteProduktIds } from '@/server/queries/manual-sales'
import { POST as checkout } from '@/app/api/checkout/route'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { sendArtikelFehlt, sendErstattungOffen, sendOrderCancelled } from '@/lib/email'
import {
  checkoutAnfrage,
  erstelleHof,
  erstelleHofMitAnmeldung,
  erstelleProdukt,
  intKennung,
  raeumeAuf,
  setzeHalt,
} from './setup/basis'

const refundCreate = vi.mocked(stripe.refunds.create)
const reversalCreate = vi.mocked(stripe.transfers.createReversal)
const intentRetrieve = vi.mocked(stripe.paymentIntents.retrieve)
const refundList = vi.mocked(stripe.refunds.list)
const reversalList = vi.mocked(stripe.transfers.listReversals)

type Buchung = { schluessel: string | null; werte: string; betrag: number; metadata: Record<string, string> }

/** Was Stripe „wirklich" getan hat: je Schlüssel EINE Buchung, mit ihren Merkmalen. */
let erstattungen: Buchung[] = []
let rueckbuchungen: Buchung[] = []
/** Was die Kundin laut Stripe bezahlt hat (latest_charge.amount) — setzt `bestellung()`. */
let bezahltBeiStripe = 0

/** Wie Stripe: derselbe Schlüssel mit denselben Werten liefert dieselbe Buchung, mit anderen einen Fehler. */
function idempotent(
  liste: () => Buchung[],
  schluessel: string,
  werte: { amount?: number; metadata?: Record<string, string> },
  betrag: number
): Buchung {
  const vorhanden = liste().find((b) => b.schluessel === schluessel)
  const text = JSON.stringify(werte)
  if (vorhanden) {
    if (vorhanden.werte !== text) throw new Error('idempotency_error: Schlüssel mit anderen Werten')
    return vorhanden
  }
  const neu = { schluessel, werte: text, betrag, metadata: werte.metadata ?? {} }
  liste().push(neu)
  return neu
}

/** Stripe vergisst Idempotenz-Schlüssel nach rund 24 Stunden — die Buchungen bleiben. */
function schluesselVerfallen(): void {
  for (const b of [...erstattungen, ...rueckbuchungen]) b.schluessel = null
}

beforeEach(() => {
  vi.clearAllMocks()
  erstattungen = []
  rueckbuchungen = []
  refundCreate.mockImplementation((async (werte: { amount?: number; metadata?: Record<string, string> }, optionen: { idempotencyKey: string }) => {
    const b = idempotent(() => erstattungen, optionen.idempotencyKey, werte, werte.amount ?? -1)
    return { id: `re_${erstattungen.indexOf(b)}`, amount: b.betrag, metadata: b.metadata, status: 'succeeded' }
  }) as never)
  reversalCreate.mockImplementation((async (_id: string, werte: { amount: number; metadata?: Record<string, string> }, optionen: { idempotencyKey: string }) => {
    const b = idempotent(() => rueckbuchungen, optionen.idempotencyKey, werte, werte.amount)
    return { id: `trr_${rueckbuchungen.indexOf(b)}`, amount: b.betrag, metadata: b.metadata }
  }) as never)
  refundList.mockImplementation((async () => ({
    data: erstattungen.map((b) => ({ amount: b.betrag, metadata: b.metadata, status: 'succeeded' })),
    has_more: false,
  })) as never)
  reversalList.mockImplementation((async () => ({
    data: rueckbuchungen.map((b) => ({ amount: b.betrag, metadata: b.metadata })),
    has_more: false,
  })) as never)
  intentRetrieve.mockImplementation((async () => ({
    id: 'pi_test',
    latest_charge: { id: 'ch_test', transfer: 'tr_test', amount: bezahltBeiStripe },
  })) as never)
})

afterEach(async () => {
  await raeumeAuf()
})

type Position = { name: string; preisCents: number; menge?: number }

/** Hof mit Anmeldung, je Position ein Produkt (Vorrat 5) und eine Bestellung darauf. */
async function bestellung(eingabe: {
  zahlung: 'bar' | 'online'
  positionen: Position[]
  gebuehrCents: number
  mindestCents?: number | null
}) {
  const { farm, cookie } = await erstelleHofMitAnmeldung()
  vi.mocked(headers).mockResolvedValue(new Headers({ cookie }) as never)

  const produkte = await Promise.all(
    eingabe.positionen.map((p) => erstelleProdukt(farm.id, { stock: 5, price: p.preisCents / 100, name: p.name }))
  )
  const warenCents = eingabe.positionen.reduce((s, p) => s + p.preisCents * (p.menge ?? 1), 0)
  const online = eingabe.zahlung === 'online'
  bezahltBeiStripe = online ? warenCents + eingabe.gebuehrCents : 0

  const order = await prisma.order.create({
    data: {
      orderNumber: intKennung('bestellung').toUpperCase(),
      farmId: farm.id,
      customerEmail: `${intKennung('kundin')}@example.com`,
      customerName: 'Anna Muster',
      customerPhone: '+43 660 0000000',
      status: online ? 'PAID' : 'CONFIRMED',
      totalAmount: new Prisma.Decimal(warenCents).div(100),
      pickupDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      pickupTimeStart: '15:00',
      pickupTimeEnd: '18:00',
      paymentMethod: online ? 'ONLINE' : 'ONSITE_CASH',
      paymentStatus: online ? 'PAID' : 'PENDING',
      stripePaymentIntentId: online ? `pi_${intKennung('zahlung')}` : null,
      serviceFeeCents: eingabe.gebuehrCents,
      serviceFeePercentApplied: eingabe.gebuehrCents > 0 ? 5 : null,
      serviceFeeMinCentsApplied: eingabe.mindestCents === undefined ? 50 : eingabe.mindestCents,
      items: {
        create: eingabe.positionen.map((p, i) => ({
          productId: produkte[i]!.id,
          productName: p.name,
          unitPrice: new Prisma.Decimal(p.preisCents).div(100),
          quantity: p.menge ?? 1,
          totalPrice: new Prisma.Decimal(p.preisCents * (p.menge ?? 1)).div(100),
          vatRate: 10,
        })),
      },
    },
    include: { items: true },
  })
  const position = (name: string) => order.items.find((i) => i.productName === name)!
  return { farm, order, produkte, position }
}

async function stand(orderId: string) {
  const o = await prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } })
  return {
    status: o.status,
    warenCents: Math.round(o.totalAmount.mul(100).toNumber()),
    gebuehrCents: o.serviceFeeCents,
    erstattetCents: o.erstattetCents,
    fehlend: o.items.filter((i) => i.fehltSeit !== null).map((i) => i.productName).sort(),
  }
}

const EIER_BROT: Position[] = [
  { name: 'Eier', preisCents: 450 },
  { name: 'Brot', preisCents: 580 },
]

describe('Artikel fehlt — Rechenbeispiele der Freigabe in der Datenbank', () => {
  it('bar vor dem SEPA-Start (Register B1, Snapshot ohne Gebühr): Brot fehlt → € 4,50, Gebühr bleibt 0', async () => {
    // So schreibt der Checkout eine Barbestellung vor BAR_SERVICEGEBUEHR_AB.
    const { order, position } = await bestellung({ zahlung: 'bar', positionen: EIER_BROT, gebuehrCents: 0, mindestCents: null })

    const ergebnis = await meldeArtikelFehlt({ orderId: order.id, itemId: position('Brot').id })

    expect(ergebnis).toEqual({ erstattetCents: 0, vomHofCents: 0, neuGesamtCents: 450 })
    expect(await stand(order.id)).toEqual({
      status: 'CONFIRMED',
      warenCents: 450,
      gebuehrCents: 0,
      erstattetCents: 0,
      fehlend: ['Brot'],
    })
    expect(refundCreate).not.toHaveBeenCalled()
  })

  it('bar: Brot fehlt → € 5,00 zu kassieren, Gebühr € 0,50 für die Abrechnung, kein Stripe, Mail', async () => {
    const { order, position, produkte } = await bestellung({ zahlung: 'bar', positionen: EIER_BROT, gebuehrCents: 52 })

    const ergebnis = await meldeArtikelFehlt({ orderId: order.id, itemId: position('Brot').id })

    expect(ergebnis).toEqual({ erstattetCents: 0, vomHofCents: 0, neuGesamtCents: 500 })
    expect(await stand(order.id)).toEqual({
      status: 'CONFIRMED',
      warenCents: 450,
      gebuehrCents: 50,
      erstattetCents: 0,
      fehlend: ['Brot'],
    })
    expect(refundCreate).not.toHaveBeenCalled()
    // Der fehlende Artikel geht nicht zurück in den Vorrat — er ist nicht da.
    expect((await prisma.product.findUniqueOrThrow({ where: { id: produkte[1]!.id } })).stock).toBe(5)
    await vi.waitFor(() => expect(sendArtikelFehlt).toHaveBeenCalledTimes(1))
    expect(vi.mocked(sendArtikelFehlt).mock.calls[0]![1]).toMatchObject({
      zahlung: 'vor_ort',
      bisherCents: 1082,
      neuCents: 500,
      erstattetCents: null,
    })
  })

  it('online: Kundin bekommt € 5,82, vom Hof genau € 5,80 per Rückbuchung mit festem Betrag', async () => {
    const { order, position } = await bestellung({ zahlung: 'online', positionen: EIER_BROT, gebuehrCents: 52 })
    const brot = position('Brot')

    const ergebnis = await meldeArtikelFehlt({ orderId: order.id, itemId: brot.id })

    expect(ergebnis).toEqual({ erstattetCents: 582, vomHofCents: 580, neuGesamtCents: 500 })
    expect(erstattungen).toEqual([
      expect.objectContaining({ schluessel: `teilstorno-${order.id}-${brot.id}`, betrag: 582 }),
    ])
    expect(rueckbuchungen).toEqual([
      expect.objectContaining({ schluessel: `teilstorno-hof-${order.id}-${brot.id}`, betrag: 580 }),
    ])
    // Merkmale, an denen ein späterer Versuch die Buchung wiederfindet.
    expect(erstattungen[0]!.metadata).toEqual({ orderId: order.id, anlass: 'teilstorno', art: 'kunde', positionId: brot.id })
    expect(rueckbuchungen[0]!.metadata).toEqual({ orderId: order.id, anlass: 'teilstorno', art: 'hof', positionId: brot.id })
    // Fester Betrag, nicht anteilig: keine Vollerstattungs-Schalter.
    const [werte] = refundCreate.mock.calls[0]!
    expect(werte).not.toHaveProperty('reverse_transfer')
    expect(werte).not.toHaveProperty('refund_application_fee')
    expect(await stand(order.id)).toEqual({
      status: 'PAID',
      warenCents: 450,
      gebuehrCents: 50,
      erstattetCents: 582,
      fehlend: ['Brot'],
    })
    await vi.waitFor(() => expect(sendArtikelFehlt).toHaveBeenCalledTimes(1))
    expect(vi.mocked(sendArtikelFehlt).mock.calls[0]![1]).toMatchObject({ zahlung: 'online', erstattetCents: 582, neuCents: 500 })
  })
})

describe('Artikel fehlt — Doppeltipp, Fehler, Wiederholung', () => {
  it('zwei gleichzeitige Aufrufe für denselben Artikel: genau EINE Erstattung und ein Vermerk', async () => {
    const { order, position } = await bestellung({ zahlung: 'online', positionen: EIER_BROT, gebuehrCents: 52 })
    const brot = position('Brot')

    const ergebnisse = await Promise.all([
      meldeArtikelFehlt({ orderId: order.id, itemId: brot.id }),
      meldeArtikelFehlt({ orderId: order.id, itemId: brot.id }),
    ])

    // Zustand, nicht Weg: einer gelingt, der andere ist eine der gültigen Absagen.
    expect(ergebnisse.filter((e) => !e.error)).toHaveLength(1)
    expect(erstattungen).toHaveLength(1)
    expect(rueckbuchungen).toHaveLength(1)
    expect(await stand(order.id)).toMatchObject({ erstattetCents: 582, warenCents: 450, gebuehrCents: 50 })
    await vi.waitFor(() => expect(sendArtikelFehlt).toHaveBeenCalledTimes(1))
  })

  it('zwei verschiedene Artikel gleichzeitig: beide vom jeweils aktuellen Stand, Summe nie über dem bezahlten Betrag', async () => {
    // € 20 + € 10 + € 0,80 = € 30,80, Gebühr 154 → bezahlt 3234
    const { order, position } = await bestellung({
      zahlung: 'online',
      positionen: [
        { name: 'Honig', preisCents: 2000 },
        { name: 'Käse', preisCents: 1000 },
        { name: 'Ei', preisCents: 80 },
      ],
      gebuehrCents: 154,
    })

    const ergebnisse = await Promise.all([
      meldeArtikelFehlt({ orderId: order.id, itemId: position('Honig').id }),
      meldeArtikelFehlt({ orderId: order.id, itemId: position('Käse').id }),
    ])

    expect(ergebnisse.every((e) => !e.error)).toBe(true)
    const danach = await stand(order.id)
    expect(danach).toMatchObject({ warenCents: 80, gebuehrCents: 50, fehlend: ['Honig', 'Käse'] })
    // Egal in welcher Reihenfolge: Artikel € 30 + Gebühr 154 − 50 = 3104.
    expect(danach.erstattetCents).toBe(3104)
    expect(erstattungen.reduce((s, b) => s + b.betrag, 0)).toBe(3104)
    expect(rueckbuchungen.reduce((s, b) => s + b.betrag, 0)).toBe(3000)
    expect(danach.erstattetCents + danach.warenCents + danach.gebuehrCents).toBe(3234)
  })

  it('Stripe lehnt ab: Bestellung unverändert, keine Mail; der zweite Versuch gelingt mit einer Erstattung', async () => {
    const { order, position } = await bestellung({ zahlung: 'online', positionen: EIER_BROT, gebuehrCents: 52 })
    const brot = position('Brot')
    refundCreate.mockRejectedValueOnce(new Error('Stripe nicht erreichbar'))

    const erster = await meldeArtikelFehlt({ orderId: order.id, itemId: brot.id })

    expect(erster.error).toContain('nichts doppelt erstattet')
    expect(await stand(order.id)).toEqual({
      status: 'PAID',
      warenCents: 1030,
      gebuehrCents: 52,
      erstattetCents: 0,
      fehlend: [],
    })
    expect(rueckbuchungen).toHaveLength(0)
    expect(Sentry.captureException).toHaveBeenCalled()

    const zweiter = await meldeArtikelFehlt({ orderId: order.id, itemId: brot.id })

    expect(zweiter).toEqual({ erstattetCents: 582, vomHofCents: 580, neuGesamtCents: 500 })
    expect(erstattungen).toHaveLength(1)
    await vi.waitFor(() => expect(sendArtikelFehlt).toHaveBeenCalledTimes(1))
  })

  it('Stripe hat erstattet, die Antwort kam nicht an: der zweite Versuch bekommt DIESELBE Erstattung', async () => {
    const { order, position } = await bestellung({ zahlung: 'online', positionen: EIER_BROT, gebuehrCents: 52 })
    const brot = position('Brot')
    const echt = refundCreate.getMockImplementation()!
    refundCreate.mockImplementationOnce((async (werte: never, optionen: never) => {
      await echt(werte, optionen)
      throw new Error('Verbindung abgebrochen')
    }) as never)

    const erster = await meldeArtikelFehlt({ orderId: order.id, itemId: brot.id })
    expect(erster.error).toBeDefined()
    // Stripe hat schon ausgezahlt, die Datenbank weiß nichts davon — noch.
    expect(erstattungen).toHaveLength(1)
    expect((await stand(order.id)).erstattetCents).toBe(0)

    const zweiter = await meldeArtikelFehlt({ orderId: order.id, itemId: brot.id })

    expect(zweiter).toEqual({ erstattetCents: 582, vomHofCents: 580, neuGesamtCents: 500 })
    // Über die Merkmale gefunden und nachgetragen — gar nicht erst neu gebucht.
    expect(refundCreate).toHaveBeenCalledTimes(1)
    expect(erstattungen).toHaveLength(1)
    expect(rueckbuchungen).toHaveLength(1)
    expect(await stand(order.id)).toMatchObject({ erstattetCents: 582, fehlend: ['Brot'] })
  })

  it('verlorene Antwort, danach ein ANDERER Artikel: die erste Erstattung wird nachgetragen, keine doppelt, Summe stimmt', async () => {
    // € 20 + € 10 + € 0,80, Gebühr 154 → bezahlt 3234
    const { order, position } = await bestellung({
      zahlung: 'online',
      positionen: [
        { name: 'Honig', preisCents: 2000 },
        { name: 'Käse', preisCents: 1000 },
        { name: 'Ei', preisCents: 80 },
      ],
      gebuehrCents: 154,
    })
    const echt = refundCreate.getMockImplementation()!
    refundCreate.mockImplementationOnce((async (werte: never, optionen: never) => {
      await echt(werte, optionen)
      throw new Error('Verbindung abgebrochen')
    }) as never)
    expect((await meldeArtikelFehlt({ orderId: order.id, itemId: position('Honig').id })).error).toBeDefined()

    const kaese = await meldeArtikelFehlt({ orderId: order.id, itemId: position('Käse').id })

    // Honig nachgetragen (2100), Käse vom berichtigten Stand: Rest € 0,80 → Gebühr 50 → 1000 + 4.
    expect(kaese).toEqual({ erstattetCents: 1004, vomHofCents: 1000, neuGesamtCents: 130 })
    expect(erstattungen.map((b) => b.betrag)).toEqual([2100, 1004])
    expect(rueckbuchungen.map((b) => b.betrag)).toEqual([2000, 1000])
    const danach = await stand(order.id)
    expect(danach).toMatchObject({ warenCents: 80, gebuehrCents: 50, erstattetCents: 3104, fehlend: ['Honig', 'Käse'] })
    expect(danach.erstattetCents + danach.warenCents + danach.gebuehrCents).toBe(3234)
  })

  it('Wiederholung nach mehr als 24 Stunden (Schlüssel verfallen): keine zweite Erstattung', async () => {
    const { order, position } = await bestellung({ zahlung: 'online', positionen: EIER_BROT, gebuehrCents: 52 })
    const brot = position('Brot')
    const echt = refundCreate.getMockImplementation()!
    refundCreate.mockImplementationOnce((async (werte: never, optionen: never) => {
      await echt(werte, optionen)
      throw new Error('Zeitüberschreitung')
    }) as never)
    await meldeArtikelFehlt({ orderId: order.id, itemId: brot.id })
    schluesselVerfallen()

    const spaeter = await meldeArtikelFehlt({ orderId: order.id, itemId: brot.id })

    expect(spaeter.error).toBeUndefined()
    expect(erstattungen).toHaveLength(1)
    expect(await stand(order.id)).toMatchObject({ erstattetCents: 582, fehlend: ['Brot'] })
  })

  it('jeder Stripe-Aufruf ohne SDK-Wiederholung und mit kurzer Zeitgrenze', async () => {
    const { order, position } = await bestellung({ zahlung: 'online', positionen: EIER_BROT, gebuehrCents: 52 })

    await meldeArtikelFehlt({ orderId: order.id, itemId: position('Brot').id })

    const optionen = [
      intentRetrieve.mock.calls[0]![2],
      refundList.mock.calls[0]![1],
      reversalList.mock.calls[0]![2],
      refundCreate.mock.calls[0]![1],
      reversalCreate.mock.calls[0]![2],
    ]
    for (const o of optionen) expect(o).toMatchObject({ maxNetworkRetries: 0, timeout: 4000 })
  })

  it('nur die Rückbuchung vom Hof scheitert: Kundin hat ihr Geld, gespeichert, Sentry meldet den offenen Betrag', async () => {
    const { order, position } = await bestellung({ zahlung: 'online', positionen: EIER_BROT, gebuehrCents: 52 })
    reversalCreate.mockRejectedValueOnce(new Error('Guthaben des Hofs reicht nicht'))

    const ergebnis = await meldeArtikelFehlt({ orderId: order.id, itemId: position('Brot').id })

    expect(ergebnis.error).toBeUndefined()
    expect(await stand(order.id)).toMatchObject({ erstattetCents: 582, fehlend: ['Brot'] })
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ tags: expect.objectContaining({ grund: 'rueckbuchung_offen' }) })
    )
  })

  it('eine Bestellung eines anderen Hofs bleibt unberührt', async () => {
    const fremd = await bestellung({ zahlung: 'online', positionen: EIER_BROT, gebuehrCents: 52 })
    // Ein zweiter Hof meldet sich an — sein Cookie gilt ab jetzt.
    await bestellung({ zahlung: 'bar', positionen: EIER_BROT, gebuehrCents: 52 })

    const ergebnis = await meldeArtikelFehlt({ orderId: fremd.order.id, itemId: fremd.position('Brot').id })

    expect(ergebnis.error).toBe('Bestellung nicht gefunden')
    expect(await stand(fremd.order.id)).toMatchObject({ erstattetCents: 0, fehlend: [] })
    expect(refundCreate).not.toHaveBeenCalled()
  })
})

describe('Artikel fehlt — fehlt alles, ist es ein Storno', () => {
  it('der letzte Artikel nach einer Teilerstattung: Rest mit festen Beträgen, Summe = bezahlt, nur Vorhandenes zurück in den Vorrat', async () => {
    const { order, position, produkte } = await bestellung({ zahlung: 'online', positionen: EIER_BROT, gebuehrCents: 52 })
    await meldeArtikelFehlt({ orderId: order.id, itemId: position('Brot').id })

    const ergebnis = await meldeArtikelFehlt({ orderId: order.id, itemId: position('Eier').id })

    expect(ergebnis).toMatchObject({ storniert: true, erstattetCents: 500, vomHofCents: 450 })
    expect(erstattungen.map((b) => [b.schluessel, b.betrag])).toEqual([
      [`teilstorno-${order.id}-${position('Brot').id}`, 582],
      [`storno-${order.id}`, 500],
    ])
    expect(rueckbuchungen.map((b) => b.betrag)).toEqual([580, 450])
    const danach = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(danach.status).toBe('CANCELLED')
    expect(danach.paymentStatus).toBe('REFUNDED')
    expect(danach.erstattetCents).toBe(1082)
    // Eier zurück in den Vorrat (5 + 1), das fehlende Brot nicht.
    expect((await prisma.product.findUniqueOrThrow({ where: { id: produkte[0]!.id } })).stock).toBe(6)
    expect((await prisma.product.findUniqueOrThrow({ where: { id: produkte[1]!.id } })).stock).toBe(5)
    await vi.waitFor(() => expect(sendOrderCancelled).toHaveBeenCalledTimes(1))
  })

  it('Storno nach Teilerstattung doppelt geklickt: genau eine Erstattung des Rests', async () => {
    const { order, position } = await bestellung({ zahlung: 'online', positionen: EIER_BROT, gebuehrCents: 52 })
    await meldeArtikelFehlt({ orderId: order.id, itemId: position('Brot').id })

    const [a, b] = await Promise.all([cancelOrder(order.id, 'Hof verhindert'), cancelOrder(order.id, 'Hof verhindert')])

    expect([a, b].filter((r) => !r.error)).toHaveLength(1)
    expect(erstattungen.filter((e) => e.schluessel === `storno-${order.id}`)).toHaveLength(1)
    expect(rueckbuchungen.filter((e) => e.schluessel === `storno-hof-${order.id}`)).toEqual([
      expect.objectContaining({ betrag: 450 }),
    ])
    const danach = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(danach.erstattetCents).toBe(1082)
    await vi.waitFor(() => expect(sendOrderCancelled).toHaveBeenCalledTimes(1))
    expect(vi.mocked(sendOrderCancelled).mock.calls[0]![2]).toBe('Hof verhindert')
  })

  it('Storno ohne Teilerstattung doppelt geklickt: eine Vollerstattung mit reverse_transfer', async () => {
    const { order } = await bestellung({ zahlung: 'online', positionen: EIER_BROT, gebuehrCents: 52 })

    await Promise.all([cancelOrder(order.id), cancelOrder(order.id)])

    expect(refundCreate).toHaveBeenCalledTimes(1)
    expect(refundCreate.mock.calls[0]![0]).toMatchObject({ reverse_transfer: true, refund_application_fee: true })
    expect(reversalCreate).not.toHaveBeenCalled()
  })
})

describe('Checkout — Snapshot der Mindestgebühr', () => {
  // Online: Bar kostet bis zum SEPA-Start keine Gebühr (Register B1) — die
  // Mindestgebühr steht dann gar nicht im Snapshot (nächster Test, und
  // tests/integration/bargebuehr.int.test.ts).
  it('schreibt die Mindestgebühr des Hofs, wenn eine Gebühr gilt', async () => {
    const { farm } = await erstelleHof({
      serviceFeePercent: 5,
      serviceFeeMinCents: 50,
      serviceFeeActiveFrom: new Date(Date.now() - 24 * 60 * 60 * 1000),
      acceptsOnline: true,
      stripeAccountReady: true,
      stripeAccountId: intKennung('acct'),
    })
    const produkt = await erstelleProdukt(farm.id, { stock: 5 })
    const sitzung = intKennung('sitzung')
    await setzeHalt(produkt.id, sitzung, 1)
    vi.mocked(stripe.paymentIntents.create).mockResolvedValue({ id: intKennung('pi'), client_secret: 'cs_test' } as never)

    const antwort = await checkout(
      checkoutAnfrage({
        farm,
        sessionId: sitzung,
        paymentMethod: 'ONLINE',
        positionen: [{ productId: produkt.id, name: 'Testprodukt', quantity: 1, unitPrice: 10 }],
      })
    )
    expect(antwort.status).toBe(200)

    const bestellt = await prisma.order.findFirstOrThrow({ where: { farmId: farm.id } })
    expect(bestellt.serviceFeeCents).toBe(50)
    expect(bestellt.serviceFeeMinCentsApplied).toBe(50)
  })

  it('lässt den Snapshot leer, wenn keine Gebühr gilt', async () => {
    const { farm } = await erstelleHof({ serviceFeeActiveFrom: null })
    const produkt = await erstelleProdukt(farm.id, { stock: 5 })
    const sitzung = intKennung('sitzung')
    await setzeHalt(produkt.id, sitzung, 1)

    const antwort = await checkout(
      checkoutAnfrage({ farm, sessionId: sitzung, positionen: [{ productId: produkt.id, name: 'Testprodukt', quantity: 1, unitPrice: 10 }] })
    )
    expect(antwort.status).toBe(200)

    const bestellt = await prisma.order.findFirstOrThrow({ where: { farmId: farm.id } })
    expect(bestellt.serviceFeeCents).toBe(0)
    expect(bestellt.serviceFeeMinCentsApplied).toBeNull()
  })
})

describe('Seitenlader der Bestellung (/orders/[orderId])', () => {
  it('zeigt eine Bestellung nur dem eigenen Hof, mit der Vorschau aus derselben Rechnung und ohne Geheimnisse', async () => {
    const { farm, order, position } = await bestellung({ zahlung: 'online', positionen: EIER_BROT, gebuehrCents: 52 })
    const fremd = await erstelleHof()

    expect(await getHofBestellDetail(fremd.farm, order.id, new Date())).toBeNull()

    const detail = await getHofBestellDetail(farm, order.id, new Date())
    expect(detail?.positionen.find((p) => p.id === position('Brot').id)?.fehltVorschau).toMatchObject({
      art: 'teil',
      erstattungCents: 582,
      vomHofCents: 580,
    })
    // Kein Token, kein Schlüssel, keine PaymentIntent-ID an den Browser.
    const text = JSON.stringify(detail)
    expect(text).not.toContain('pi_')
    expect(detail).not.toHaveProperty('confirmationToken')
    expect(detail).not.toHaveProperty('idempotencyKey')
  })
})

describe('Kennzahlen zählen fehlende Artikel nicht als verkauft', () => {
  it('Top-Produkte, meistverkaufte Produkte und Jahresumsatz ohne die fehlende Position', async () => {
    const { farm, order, position, produkte } = await bestellung({ zahlung: 'bar', positionen: EIER_BROT, gebuehrCents: 52 })
    await meldeArtikelFehlt({ orderId: order.id, itemId: position('Brot').id })
    await prisma.order.update({ where: { id: order.id }, data: { status: 'PICKED_UP', pickedUpAt: new Date(), paymentStatus: 'PAID' } })
    const fenster = { von: new Date(Date.now() - 60 * 60 * 1000), bis: new Date(Date.now() + 60 * 60 * 1000) }

    expect((await getTopProdukte(farm.id, fenster)).map((t) => t.name)).toEqual(['Eier'])
    expect(await getMeistverkaufteProduktIds(farm.id)).toEqual([produkte[0]!.id])
    expect(await getYtdRevenue(farm.id)).toBe(4.5)
  })
})

/** Eine Buchung, die Stripe schon kennt — von Hand im Dashboard, aus altem Format oder einem früheren Versuch. */
function stripeKennt(liste: Buchung[], betrag: number, metadata: Record<string, string>): void {
  liste.push({ schluessel: null, werte: '', betrag, metadata })
}

describe('Im Zweifel nicht buchen (Nachbesserung 2)', () => {
  async function unveraendert(orderId: string) {
    expect(await stand(orderId)).toMatchObject({ warenCents: 1030, gebuehrCents: 52, erstattetCents: 0, fehlend: [] })
    expect(refundCreate).not.toHaveBeenCalled()
    expect(reversalCreate).not.toHaveBeenCalled()
    // Mails laden den Versand erst im Aufruf (Nr. 31): erst alle Importe abwarten, sonst wäre „nicht gesendet“ nur zu früh geprüft.
    await vi.dynamicImportSettled()
    expect(sendArtikelFehlt).not.toHaveBeenCalled()
  }

  it('eine Erstattung ohne Zuordnung (von Hand im Dashboard): nichts gebucht, Hof soll sich melden, Sentry', async () => {
    const { order, position } = await bestellung({ zahlung: 'online', positionen: EIER_BROT, gebuehrCents: 52 })
    stripeKennt(erstattungen, 300, {})

    const ergebnis = await meldeArtikelFehlt({ orderId: order.id, itemId: position('Brot').id })

    expect(ergebnis.error).toContain('bitte melde dich bei uns')
    await unveraendert(order.id)
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ tags: expect.objectContaining({ grund: 'stripe_unklar_ohne_zuordnung' }) })
    )
  })

  it('Teilstorno im alten Format (ohne Position): nichts gebucht', async () => {
    const { order, position } = await bestellung({ zahlung: 'online', positionen: EIER_BROT, gebuehrCents: 52 })
    stripeKennt(erstattungen, 582, { orderId: order.id, grund: 'artikel_fehlt' })

    expect((await meldeArtikelFehlt({ orderId: order.id, itemId: position('Brot').id })).error).toContain('bitte melde dich bei uns')
    await unveraendert(order.id)
  })

  it('mehr als eine Seite Erstattungen: nichts gebucht', async () => {
    const { order, position } = await bestellung({ zahlung: 'online', positionen: EIER_BROT, gebuehrCents: 52 })
    refundList.mockResolvedValueOnce({ data: [], has_more: true } as never)

    expect((await meldeArtikelFehlt({ orderId: order.id, itemId: position('Brot').id })).error).toContain('bitte melde dich bei uns')
    await unveraendert(order.id)
  })

  it('Stripe meldet die Erstattung als gescheitert: nicht als erstattet vermerkt', async () => {
    const { order, position } = await bestellung({ zahlung: 'online', positionen: EIER_BROT, gebuehrCents: 52 })
    refundCreate.mockResolvedValueOnce({ id: 're_x', amount: 582, status: 'failed', metadata: {} } as never)

    expect((await meldeArtikelFehlt({ orderId: order.id, itemId: position('Brot').id })).error).toContain('bitte melde dich bei uns')
    expect(await stand(order.id)).toMatchObject({ warenCents: 1030, gebuehrCents: 52, erstattetCents: 0, fehlend: [] })
    expect(reversalCreate).not.toHaveBeenCalled()
  })

  it('ein Nachtrag, der fachlich nicht aufgeht (Teilerstattung auch für den letzten Artikel): nichts gebucht', async () => {
    const { order, position } = await bestellung({ zahlung: 'online', positionen: EIER_BROT, gebuehrCents: 52 })
    stripeKennt(erstattungen, 502, { orderId: order.id, anlass: 'teilstorno', positionId: position('Eier').id })
    stripeKennt(erstattungen, 580, { orderId: order.id, anlass: 'teilstorno', positionId: position('Brot').id })

    expect((await meldeArtikelFehlt({ orderId: order.id, itemId: position('Brot').id })).error).toContain('bitte melde dich bei uns')
    expect(await stand(order.id)).toMatchObject({ erstattetCents: 0, fehlend: [] })
    expect(refundCreate).not.toHaveBeenCalled()
    expect(reversalCreate).not.toHaveBeenCalled()
  })

  it('mehr verlorene Positionen als die Grenze: nichts gebucht, nichts still liegen gelassen', async () => {
    const namen = ['A', 'B', 'C', 'D', 'E']
    const { order, position } = await bestellung({
      zahlung: 'online',
      positionen: namen.map((name) => ({ name, preisCents: 1000 })),
      gebuehrCents: 250,
    })
    for (const name of namen.slice(0, 4)) {
      stripeKennt(erstattungen, 1000, { orderId: order.id, anlass: 'teilstorno', positionId: position(name).id })
    }

    expect((await meldeArtikelFehlt({ orderId: order.id, itemId: position('E').id })).error).toContain('bitte melde dich bei uns')
    expect(await stand(order.id)).toMatchObject({ erstattetCents: 0, fehlend: [] })
    expect(refundCreate).not.toHaveBeenCalled()
  })

  it('Storno nach verlorener Teilstorno-Antwort: der Rest kommt aus Stripes Buchungen, Summe = bezahlt, Hof genau der Warenpreis', async () => {
    const { order, position } = await bestellung({ zahlung: 'online', positionen: EIER_BROT, gebuehrCents: 52 })
    const echt = refundCreate.getMockImplementation()!
    refundCreate.mockImplementationOnce((async (werte: never, optionen: never) => {
      await echt(werte, optionen)
      throw new Error('Verbindung abgebrochen')
    }) as never)
    expect((await meldeArtikelFehlt({ orderId: order.id, itemId: position('Brot').id })).error).toBeDefined()
    // Die Datenbank weiß nichts von den 582 — Stripe schon; zurückgebucht wurde noch nichts.

    const storno = await cancelOrder(order.id)

    expect(storno).toEqual({ erstattetCents: 500, vomHofCents: 1030 })
    expect(erstattungen.map((b) => b.betrag)).toEqual([582, 500])
    expect(rueckbuchungen.map((b) => [b.schluessel, b.betrag])).toEqual([[`storno-hof-${order.id}`, 1030]])
    const danach = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(danach.status).toBe('CANCELLED')
    expect(danach.paymentStatus).toBe('REFUNDED')
    expect(danach.erstattetCents).toBe(1082)
  })

  it('Storno mit einer Erstattung ohne Zuordnung: storniert, aber Geld nicht automatisch bewegt (Betreiber prüft)', async () => {
    const { order } = await bestellung({ zahlung: 'online', positionen: EIER_BROT, gebuehrCents: 52 })
    stripeKennt(erstattungen, 300, {})

    const storno = await cancelOrder(order.id)

    expect(storno.erstattungOffen).toBe(true)
    expect(refundCreate).not.toHaveBeenCalled()
    expect(reversalCreate).not.toHaveBeenCalled()
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tags: expect.objectContaining({ grund: 'stripe_unklar_ohne_zuordnung' }) })
    )
  })
})

describe('Rest-Storno mit Stripes bezahltem Betrag (Nr. 19c)', () => {
  it('bezahlt laut Stripe weicht von der Datenbank ab: storniert, aber nichts gebucht, Sentry, Betreiber gemeldet', async () => {
    const { order, position } = await bestellung({ zahlung: 'online', positionen: EIER_BROT, gebuehrCents: 52 })
    await meldeArtikelFehlt({ orderId: order.id, itemId: position('Brot').id })
    // Stripe kennt einen anderen Betrag als die Datenbank (bezahlt = 450 + 50 + 582 = 1082).
    bezahltBeiStripe = 1100

    const storno = await cancelOrder(order.id)

    expect(storno).toEqual({ error: 'Rückerstattung fehlgeschlagen. Wir kümmern uns um die Erstattung und melden uns.', erstattungOffen: true })
    expect(erstattungen.map((b) => b.betrag)).toEqual([582])
    expect(rueckbuchungen.map((b) => b.betrag)).toEqual([580])
    const danach = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
    expect(danach.status).toBe('CANCELLED')
    expect(danach.paymentStatus).toBe('PAID')
    expect(danach.erstattetCents).toBe(582)
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: expect.objectContaining({ grund: 'stripe_unklar_bezahlt_abweichend' }),
        extra: expect.objectContaining({ orderId: order.id, bezahltStripeCents: 1100, bezahltDatenbankCents: 1082 }),
      })
    )
    await vi.waitFor(() => expect(sendErstattungOffen).toHaveBeenCalledTimes(1))
    expect(vi.mocked(sendErstattungOffen).mock.calls[0]![0]).toMatchObject({ bestellId: order.id })
    // Mails laden den Versand erst im Aufruf (Nr. 31): erst alle Importe abwarten, sonst wäre „nicht gesendet“ nur zu früh geprüft.
    await vi.dynamicImportSettled()
    expect(sendOrderCancelled).not.toHaveBeenCalled()
  })

  it('Rest-Erstattung scheitert: die Anweisung nennt eine TEILerstattung mit den Beträgen aus dem Rest', async () => {
    const { order, position } = await bestellung({ zahlung: 'online', positionen: EIER_BROT, gebuehrCents: 52 })
    await meldeArtikelFehlt({ orderId: order.id, itemId: position('Brot').id })
    refundCreate.mockRejectedValueOnce(new Error('Stripe nicht erreichbar'))

    const storno = await cancelOrder(order.id)

    expect(storno.erstattungOffen).toBe(true)
    const [, kontext] = vi.mocked(Sentry.captureException).mock.calls.at(-1) as [unknown, { tags: Record<string, string>; extra: Record<string, unknown> }]
    expect(kontext.tags.grund).toBe('erstattung_offen')
    expect(kontext.extra).toMatchObject({ orderId: order.id, erstattungCents: 500, vomHofCents: 450 })
    expect(String(kontext.extra.handerstattung)).toContain('Teilerstattung')
    expect(String(kontext.extra.handerstattung)).not.toContain('Plattformgebühr erstatten')
    await vi.waitFor(() => expect(sendErstattungOffen).toHaveBeenCalledTimes(1))
    expect(vi.mocked(sendErstattungOffen).mock.calls[0]![0]).toMatchObject({
      betraege: [
        { label: expect.stringContaining('Kundin'), cents: 500 },
        { label: expect.stringContaining('Hof'), cents: 450 },
      ],
    })
  })

  it('Rest nach verlorener Teilstorno-Antwort scheitert: ebenfalls Teilerstattung, nicht „Plattformgebühr erstatten"', async () => {
    const { order, position } = await bestellung({ zahlung: 'online', positionen: EIER_BROT, gebuehrCents: 52 })
    const echt = refundCreate.getMockImplementation()!
    refundCreate.mockImplementationOnce((async (werte: never, optionen: never) => {
      await echt(werte, optionen)
      throw new Error('Verbindung abgebrochen')
    }) as never)
    await meldeArtikelFehlt({ orderId: order.id, itemId: position('Brot').id })
    refundCreate.mockRejectedValueOnce(new Error('Stripe nicht erreichbar'))

    const storno = await cancelOrder(order.id)

    expect(storno.erstattungOffen).toBe(true)
    const [, kontext] = vi.mocked(Sentry.captureException).mock.calls.at(-1) as [unknown, { extra: Record<string, unknown> }]
    expect(kontext.extra).toMatchObject({ orderId: order.id, erstattungCents: 500, vomHofCents: 1030 })
    expect(String(kontext.extra.handerstattung)).toContain('Teilerstattung')
    expect(String(kontext.extra.handerstattung)).not.toContain('Plattformgebühr erstatten')
  })
})

describe('Artikel fehlt — Sentry-Angabe je Grund (Nr. 19c, Nachbesserung 2)', () => {
  it('Zahlung ohne Überweisung: nichts gebucht, die Handprüfung nennt die Überweisung, nicht „ohne Zuordnung"', async () => {
    const { order, position } = await bestellung({ zahlung: 'online', positionen: EIER_BROT, gebuehrCents: 52 })
    intentRetrieve.mockResolvedValueOnce({ id: 'pi_test', latest_charge: { id: 'ch_test', transfer: null, amount: 1082 } } as never)

    const ergebnis = await meldeArtikelFehlt({ orderId: order.id, itemId: position('Brot').id })

    expect(ergebnis.error).toContain('bitte melde dich bei uns')
    expect(refundCreate).not.toHaveBeenCalled()
    const [, kontext] = vi.mocked(Sentry.captureException).mock.calls.at(-1) as [unknown, { tags: Record<string, string>; extra: Record<string, unknown> }]
    expect(kontext.tags.grund).toBe('stripe_unklar_ohne_ueberweisung')
    expect(String(kontext.extra.handpruefung)).toContain('Überweisung')
    expect(String(kontext.extra.handpruefung)).not.toContain('ohne Zuordnung')
  })
})
