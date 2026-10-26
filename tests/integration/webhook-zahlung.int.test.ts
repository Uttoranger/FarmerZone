/**
 * Integrationstest — der Stripe-Webhook gegen die echte Datenbank.
 *
 * Die Aussage: Ein Zahlungsereignis ändert eine Bestellung nur aus dem Zustand
 * heraus, für den es gilt. Bedingter Statuswechsel (`updateMany` mit
 * Statusbedingung) statt Lesen-und-blind-Schreiben.
 *
 * WARUM DIESE FÄLLE: `payment_intent.payment_failed` ist bei Stripe KEIN
 * Endzustand — der PaymentIntent bleibt bezahlbar, die Kundin kann es mit einer
 * anderen Karte noch einmal versuchen. Der Webhook stornierte trotzdem und
 * buchte den Bestand zurück; kam danach `payment_intent.succeeded`, setzte er
 * die stornierte Bestellung blind auf PAID — bezahlt, aber ohne Ware im
 * Bestand. Endgültig ist erst `payment_intent.canceled`.
 *
 * WIE EINE ZAHLUNG „ZU SPÄT" KOMMT: Ein abgebrochener PaymentIntent
 * (`canceled`) kann bei Stripe nicht mehr gelingen. Spät wird eine Zahlung,
 * wenn die Bestellung storniert wurde, während der PaymentIntent noch
 * bezahlbar war — vom Hof über `cancelOrder` (hier echt aufgerufen, mit echter
 * Anmeldung), früher auch vom alten `payment_failed`-Handler.
 *
 * Echt sind Datenbank, Transaktion, Anmeldung des Hofes und die
 * Signaturprüfung von Stripe (das Ereignis wird mit dem Platzhalter-Secret der
 * Integrationsschicht signiert). Gemockt sind Erstattung, Sentry und der
 * Request-Kontext — kein Netz, kein Geld. Die Mails sind seit Nr. 159
 * Aufträge der Warteschlange und stehen echt in der Datenbank: Statuswechsel
 * und Aufträge in einer Transaktion, zweimal zugestellt heißt ein Auftrag.
 * Ein Auftrag hält den Wechsel nie auf (Nr. 168, Register N26, Ergänzung
 * 25.10.2026): Eine Trigger-Funktion (setup/mail-sperre.ts) lässt das
 * Anlegen scheitern; der Wechsel committet trotzdem (Savepoint, Weg A).
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/stripe', async () => {
  // Die echten Webhook-Helfer des SDK — Signatur prüfen und im Test erzeugen —,
  // aber keine echte Erstattung.
  const { default: Stripe } = await import('stripe')
  const echt = new Stripe('sk_test_integration_dummy')
  return { stripe: { webhooks: echt.webhooks, refunds: { create: vi.fn(), list: vi.fn(async () => ({ data: [], has_more: false })) } } }
})
/**
 * Der Nachlauf (Worker nach dem Einstellen) startet sofort, sein Ende wird
 * gemerkt: `nachlaufFertig()` wartet darauf, `afterEach` ebenso. Der Worker
 * schickt hier nichts hinaus — die Post-Sperre (Z3) sperrt außerhalb der
 * Produktion jede Adresse.
 */
const nachlauf = vi.hoisted(() => ({ laufend: [] as Array<Promise<void>> }))
vi.mock('@/lib/nach-der-antwort', () => ({
  nachDerAntwort: (aufgabe: () => Promise<void>) => {
    nachlauf.laufend.push(aufgabe().catch(() => {}))
  },
}))

// Echt eingestellt; beobachtet wird nur, was die Hilfe zurückgibt (Nr. 168).
vi.mock('@/server/mail-warteschlange', async (original) => {
  const echt = await original<typeof import('@/server/mail-warteschlange')>()
  return { ...echt, stelleMailEinInTransaktion: vi.fn(echt.stelleMailEinInTransaktion) }
})

async function nachlaufFertig(): Promise<void> {
  while (nachlauf.laufend.length > 0) await Promise.all(nachlauf.laufend.splice(0))
}

import { NextRequest } from 'next/server'
import { headers } from 'next/headers'
import * as Sentry from '@sentry/nextjs'
import { POST } from '@/app/api/stripe/webhook/route'
import { cancelOrder } from '@/server/actions/orders'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { stelleMailEinInTransaktion } from '@/server/mail-warteschlange'
import { bestellMailAuftrag } from '@/server/mail-arten/bestellung'
import { INTEGRATIONS_ENV } from './setup/integrations-umgebung'
import { gibMailAuftraegeFrei, sperreMailAuftraege } from './setup/mail-sperre'
import { artenZu, auftraege, erstelleHofMitAnmeldung, erstelleProdukt, intKennung, raeumeAuf } from './setup/basis'

const erstatten = vi.mocked(stripe.refunds.create)

beforeEach(() => {
  vi.clearAllMocks()
  erstatten.mockResolvedValue({ id: 're_int_test', amount: 2100 } as never)
})

afterEach(async () => {
  await nachlaufFertig()
  await raeumeAuf()
})

const EINZELPREIS = 10
const MENGE = 2
/** Der Bestand NACH der Buchung im Checkout — er ist schon abgezogen. */
const BESTAND_NACH_CHECKOUT = 5

type Ereignistyp =
  | 'payment_intent.succeeded'
  | 'payment_intent.payment_failed'
  | 'payment_intent.canceled'

/**
 * Eine Online-Bestellung, wie der Checkout sie hinterlässt: wartet auf die
 * Zahlung, Bestand schon gebucht, PaymentIntent vermerkt. Der Hof ist
 * angemeldet, damit `cancelOrder` echt laufen kann.
 */
async function offeneOnlineBestellung() {
  const { farm, cookie } = await erstelleHofMitAnmeldung({ acceptsOnline: true })
  vi.mocked(headers).mockResolvedValue(new Headers({ cookie }) as never)
  const produkt = await erstelleProdukt(farm.id, { stock: BESTAND_NACH_CHECKOUT })
  const paymentIntentId = intKennung('pi')

  const bestellung = await prisma.order.create({
    data: {
      orderNumber: intKennung('bestellung').toUpperCase(),
      farmId: farm.id,
      customerEmail: `${intKennung('kundin')}@example.com`,
      customerName: 'Erika Mustermann',
      customerPhone: '+43 660 0000000',
      status: 'PENDING_CONFIRMATION',
      totalAmount: EINZELPREIS * MENGE,
      pickupDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      pickupTimeStart: '15:00',
      pickupTimeEnd: '18:00',
      paymentMethod: 'ONLINE',
      paymentStatus: 'PENDING',
      stripePaymentIntentId: paymentIntentId,
      platformFeeAmount: 0,
      serviceFeeCents: 100,
      serviceFeePercentApplied: 4.9,
      items: {
        create: [
          {
            productId: produkt.id,
            productName: 'Testprodukt',
            unitPrice: EINZELPREIS,
            quantity: MENGE,
            totalPrice: EINZELPREIS * MENGE,
            vatRate: 10,
          },
        ],
      },
    },
  })

  return { produkt, bestellung, paymentIntentId }
}

/** Ein Ereignis, wie Stripe es schickt — mit eigener oder vorgegebener ID. */
function ereignis(typ: Ereignistyp, paymentIntentId: string, id: string = intKennung('evt')) {
  return {
    id,
    object: 'event',
    type: typ,
    data: {
      object: {
        id: paymentIntentId,
        object: 'payment_intent',
        amount: 2100,
        // Servicegebühr 1,00 € als application_fee — wie im Checkout.
        application_fee_amount: 100,
      },
    },
  }
}

/** Signiert wie Stripe und ruft den Handler direkt — kein HTTP-Server. */
async function zustellen(ev: ReturnType<typeof ereignis>) {
  const koerper = JSON.stringify(ev)
  const signatur = stripe.webhooks.generateTestHeaderString({
    payload: koerper,
    secret: INTEGRATIONS_ENV.STRIPE_WEBHOOK_SECRET,
  })
  return POST(
    new NextRequest('http://localhost:3000/api/stripe/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': signatur, 'content-type': 'application/json' },
      body: koerper,
    })
  )
}

async function bestand(produktId: string) {
  return (await prisma.product.findUniqueOrThrow({ where: { id: produktId } })).stock
}

async function zustand(bestellungId: string) {
  return prisma.order.findUniqueOrThrow({ where: { id: bestellungId } })
}

describe('payment_intent.payment_failed — nur vermerken', () => {
  it('lässt die Bestellung offen und den Bestand gebucht', async () => {
    const { produkt, bestellung, paymentIntentId } = await offeneOnlineBestellung()

    const antwort = await zustellen(ereignis('payment_intent.payment_failed', paymentIntentId))

    expect(antwort.status).toBe(200)
    expect(await zustand(bestellung.id)).toMatchObject({
      status: 'PENDING_CONFIRMATION',
      paymentStatus: 'FAILED',
      cancelledAt: null,
    })
    expect(await bestand(produkt.id)).toBe(BESTAND_NACH_CHECKOUT)
  })

  it('failed → succeeded ergibt PAID, der Bestand bleibt einmal gebucht', async () => {
    const { produkt, bestellung, paymentIntentId } = await offeneOnlineBestellung()

    expect((await zustellen(ereignis('payment_intent.payment_failed', paymentIntentId))).status).toBe(200)
    expect((await zustellen(ereignis('payment_intent.succeeded', paymentIntentId))).status).toBe(200)

    const danach = await zustand(bestellung.id)
    expect(danach).toMatchObject({ status: 'PAID', paymentStatus: 'PAID', cancelledAt: null })
    expect(danach.paidAt).not.toBeNull()
    // 5: im Checkout gebucht, weder zurückgegeben noch ein zweites Mal abgezogen.
    // Der Fehler lieferte 7 — zurückgebucht und trotzdem bezahlt.
    expect(await bestand(produkt.id)).toBe(BESTAND_NACH_CHECKOUT)
    expect(erstatten).not.toHaveBeenCalled()
    expect(await artenZu(bestellung.id)).toEqual(['bestellung-bestaetigung', 'bestellung-bezahlt-hof'])
  })
})

describe('payment_intent.canceled — endgültig', () => {
  it('storniert und bucht den Bestand genau einmal zurück, auch bei doppelter Zustellung', async () => {
    const { produkt, bestellung, paymentIntentId } = await offeneOnlineBestellung()
    const einmal = ereignis('payment_intent.canceled', paymentIntentId)

    // Dasselbe Ereignis zweimal gleichzeitig — beide sehen es in der
    // Idempotenz-Tabelle noch nicht — und danach ein zweites mit neuer ID.
    const [a, b] = await Promise.all([zustellen(einmal), zustellen(einmal)])
    const c = await zustellen(ereignis('payment_intent.canceled', paymentIntentId))

    expect([a.status, b.status, c.status]).toEqual([200, 200, 200])
    const danach = await zustand(bestellung.id)
    expect(danach).toMatchObject({ status: 'CANCELLED', cancelReason: 'Zahlung abgebrochen' })
    expect(danach.cancelledAt).not.toBeNull()
    // Die Servicegebühr entfällt — derselbe Vermerk wie bei cancelOrder.
    expect(danach.serviceFeeRefundedAt).not.toBeNull()
    // 5 + 2: genau einmal zurück. Zweimal wären es 9.
    expect(await bestand(produkt.id)).toBe(BESTAND_NACH_CHECKOUT + MENGE)
  })

  // Wache für die Bedingung: Stripe schickt nach succeeded kein canceled —
  // käme es doch (oder rufe K3 die Funktion zu spät), bleibt die Bestellung bezahlt.
  it('lässt eine bezahlte Bestellung unberührt', async () => {
    const { produkt, bestellung, paymentIntentId } = await offeneOnlineBestellung()
    await zustellen(ereignis('payment_intent.succeeded', paymentIntentId))

    await zustellen(ereignis('payment_intent.canceled', paymentIntentId))

    expect(await zustand(bestellung.id)).toMatchObject({ status: 'PAID', paymentStatus: 'PAID' })
    expect(await bestand(produkt.id)).toBe(BESTAND_NACH_CHECKOUT)
  })
})

describe('payment_intent.succeeded — nur aus „wartet auf Zahlung"', () => {
  it('auf eine vom Hof stornierte, unbezahlte Bestellung: voll erstatten, Alarm, Mail — kein PAID, kein Bestand', async () => {
    const { produkt, bestellung, paymentIntentId } = await offeneOnlineBestellung()
    // Der Hof storniert, während die Kundin noch an der Zahlung sitzt.
    expect((await cancelOrder(bestellung.id, 'Ware ausgegangen')).error).toBeUndefined()
    vi.clearAllMocks()
    erstatten.mockResolvedValue({ id: 're_int_test', amount: 2100 } as never)

    const antwort = await zustellen(ereignis('payment_intent.succeeded', paymentIntentId))

    expect(antwort.status).toBe(200)
    expect(erstatten).toHaveBeenCalledTimes(1)
    expect(erstatten).toHaveBeenCalledWith(
      {
        payment_intent: paymentIntentId,
        reverse_transfer: true,
        refund_application_fee: true,
      },
      { idempotencyKey: `spaet-bezahlt-${bestellung.id}` }
    )
    expect(await zustand(bestellung.id)).toMatchObject({
      status: 'CANCELLED',
      paymentStatus: 'REFUNDED',
      paidAt: null,
    })
    // Der Bestand bleibt, wie der Storno ihn hinterließ.
    expect(await bestand(produkt.id)).toBe(BESTAND_NACH_CHECKOUT + MENGE)
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
    // Der Betrag aus der Erstattung, in Cent — im Auftrag, nie neu gerechnet. Dazu die Storno-Mail (bar, unbezahlt: ohne Erstattung).
    const zuSpaet = (await auftraege({ bestellungId: bestellung.id })).filter((a) => a.art === 'zahlung-zu-spaet')
    expect(zuSpaet).toEqual([
      expect.objectContaining({ vorrang: 1, schluessel: `zahlung-zu-spaet:${bestellung.id}`, bezug: { orderId: bestellung.id, erstattetCents: '2100' } }),
    ])
    expect(await artenZu(bestellung.id)).toEqual(['storniert', 'zahlung-zu-spaet'])
  })

  it('dieselbe späte Zahlung zweimal gleichzeitig zugestellt: ein Schlüssel, eine Mail', async () => {
    const { bestellung, paymentIntentId } = await offeneOnlineBestellung()
    expect((await cancelOrder(bestellung.id)).error).toBeUndefined()
    const spaet = ereignis('payment_intent.succeeded', paymentIntentId)

    const antworten = await Promise.all([zustellen(spaet), zustellen(spaet)])

    expect(antworten.map((a) => a.status)).toEqual([200, 200])
    // Beide dürfen Stripe erreichen — mit DEMSELBEN Schlüssel, also eine Erstattung.
    for (const aufruf of erstatten.mock.calls) {
      expect(aufruf[1]).toEqual({ idempotencyKey: `spaet-bezahlt-${bestellung.id}` })
    }
    expect((await artenZu(bestellung.id)).filter((a) => a === 'zahlung-zu-spaet')).toHaveLength(1)
    expect(await zustand(bestellung.id)).toMatchObject({ status: 'CANCELLED', paymentStatus: 'REFUNDED' })
  })

  it('erstattet auch Altfälle: vom früheren payment_failed storniert', async () => {
    const { bestellung, paymentIntentId } = await offeneOnlineBestellung()
    // So hinterließ der alte Handler eine fehlgeschlagene Zahlung.
    await prisma.order.update({
      where: { id: bestellung.id },
      data: {
        status: 'CANCELLED',
        paymentStatus: 'FAILED',
        cancelledAt: new Date(),
        cancelReason: 'Zahlung fehlgeschlagen',
      },
    })

    await zustellen(ereignis('payment_intent.succeeded', paymentIntentId))

    expect(erstatten).toHaveBeenCalledTimes(1)
    expect(await zustand(bestellung.id)).toMatchObject({ status: 'CANCELLED', paymentStatus: 'REFUNDED' })
  })

  it('erstattet nicht, wenn der Hof die bezahlte Bestellung storniert hat (der Storno hat schon erstattet)', async () => {
    const { bestellung, paymentIntentId } = await offeneOnlineBestellung()
    await zustellen(ereignis('payment_intent.succeeded', paymentIntentId))
    // cancelOrder hinterlässt: storniert, erstattet.
    await prisma.order.update({
      where: { id: bestellung.id },
      data: { status: 'CANCELLED', paymentStatus: 'REFUNDED', cancelledAt: new Date() },
    })
    vi.clearAllMocks()

    // Eine Wiederholung des succeeded-Ereignisses (neue Zustellung).
    const antwort = await zustellen(ereignis('payment_intent.succeeded', paymentIntentId))

    expect(antwort.status).toBe(200)
    expect(erstatten).not.toHaveBeenCalled()
    expect(await artenZu(bestellung.id)).not.toContain('zahlung-zu-spaet')
    expect(await zustand(bestellung.id)).toMatchObject({ status: 'CANCELLED', paymentStatus: 'REFUNDED' })
  })

  it('zweimal succeeded (auch dasselbe Ereignis gleichzeitig): einmal PAID, je Art ein Auftrag mit Bestellung und Hof', async () => {
    const { bestellung, paymentIntentId } = await offeneOnlineBestellung()
    const einmal = ereignis('payment_intent.succeeded', paymentIntentId)

    await Promise.all([zustellen(einmal), zustellen(einmal)])
    await zustellen(ereignis('payment_intent.succeeded', paymentIntentId))

    expect(await zustand(bestellung.id)).toMatchObject({ status: 'PAID' })
    expect(await auftraege({ bestellungId: bestellung.id })).toEqual([
      { art: 'bestellung-bestaetigung', vorrang: 1, schluessel: `bestellung-bestaetigung:${bestellung.id}`, bestellungId: bestellung.id, farmId: bestellung.farmId, bezug: { orderId: bestellung.id } },
      { art: 'bestellung-bezahlt-hof', vorrang: 1, schluessel: `bestellung-bezahlt-hof:${bestellung.id}`, bestellungId: bestellung.id, farmId: bestellung.farmId, bezug: { orderId: bestellung.id } },
    ])
    expect(erstatten).not.toHaveBeenCalled()
  })
})

describe('Ein Mail-Auftrag hält nie auf (Nr. 168): Savepoint in der Transaktion, nachholen nach dem Commit', () => {
  const einstellen = vi.mocked(stelleMailEinInTransaktion)
  /** Was an Sentry ging, je Grund — nur aus der Warteschlange. */
  const mailMeldungen = () =>
    vi.mocked(Sentry.captureException).mock.calls
      .map(([, k]) => (k as { tags?: Record<string, string> } | undefined)?.tags)
      // Nur die Meldungen der Einstell-Wege (mit Grund) — der Worker im Nachlauf meldet eigene.
      .filter((t) => t?.bereich === 'mail-warteschlange' && t.grund)
      .map((t) => t!.grund)

  beforeAll(async () => {
    await gibMailAuftraegeFrei()
  })

  it('Weg A trägt: ein gescheitertes INSERT setzt nur den Savepoint zurück — dieselbe Transaktion liest und schreibt weiter und committet', async () => {
    const { bestellung } = await offeneOnlineBestellung()
    try {
      await sperreMailAuftraege('immer')
      const ergebnis = await prisma.$transaction(async (tx) => {
        await tx.order.updateMany({ where: { id: bestellung.id }, data: { cancelReason: 'vor dem Auftrag' } })
        const mail = await stelleMailEinInTransaktion(bestellMailAuftrag('abholbereit', bestellung, new Date()), tx)
        // Ohne Savepoint wäre die Transaktion hier abgebrochen („current transaction is aborted").
        await tx.order.updateMany({ where: { id: bestellung.id }, data: { cancelledAt: new Date(0) } })
        return mail
      })
      expect(ergebnis).toBe('nachholen')
    } finally {
      await gibMailAuftraegeFrei()
    }
    expect(await zustand(bestellung.id)).toMatchObject({ cancelReason: 'vor dem Auftrag', cancelledAt: new Date(0) })
    expect(await artenZu(bestellung.id)).toEqual([])
  })

  it('Trigger lässt jedes INSERT scheitern: bezahlt → PAID und 200, kein Auftrag, Sentry; ein zweites Ereignis legt nichts doppelt an', async () => {
    const { bestellung, paymentIntentId } = await offeneOnlineBestellung()
    const ev = ereignis('payment_intent.succeeded', paymentIntentId)
    try {
      await sperreMailAuftraege('immer')
      expect((await zustellen(ev)).status).toBe(200)
      await nachlaufFertig()
    } finally {
      await gibMailAuftraegeFrei()
    }
    expect(await zustand(bestellung.id)).toMatchObject({ status: 'PAID', paymentStatus: 'PAID' })
    expect(await einstellen.mock.results[0]!.value).toBe('nachholen')
    expect(await artenZu(bestellung.id)).toEqual([])
    // In der Transaktion gescheitert (Warnung), nachgeholt gescheitert (Fehler).
    expect(mailMeldungen()).toEqual(['in_transaktion_gescheitert', 'einstellen_gescheitert'])
    expect(await prisma.webhookEvent.findUnique({ where: { stripeEventId: ev.id } })).not.toBeNull()

    // Dasselbe Ereignis und ein neues desselben PaymentIntents: nichts doppelt, nichts neu.
    expect((await zustellen(ev)).status).toBe(200)
    expect((await zustellen(ereignis('payment_intent.succeeded', paymentIntentId))).status).toBe(200)
    expect(await artenZu(bestellung.id)).toEqual([])
  })

  it('nur das INSERT in der Transaktion scheitert: PAID, die Aufträge werden nach dem Commit nachgeholt — je Art genau einer', async () => {
    const { bestellung, paymentIntentId } = await offeneOnlineBestellung()
    try {
      await sperreMailAuftraege('einmal')
      expect((await zustellen(ereignis('payment_intent.succeeded', paymentIntentId))).status).toBe(200)
      await nachlaufFertig()
    } finally {
      await gibMailAuftraegeFrei()
    }
    expect(await zustand(bestellung.id)).toMatchObject({ status: 'PAID' })
    expect(await einstellen.mock.results[0]!.value).toBe('nachholen')
    expect(await artenZu(bestellung.id)).toEqual(['bestellung-bestaetigung', 'bestellung-bezahlt-hof'])
    expect(mailMeldungen()).toEqual(['in_transaktion_gescheitert'])

    // Ein zweites Ereignis legt nichts doppelt an.
    await zustellen(ereignis('payment_intent.succeeded', paymentIntentId))
    expect(await prisma.mailAuftrag.count({ where: { bestellungId: bestellung.id } })).toBe(2)
  })

  it('Storno mit gesperrtem INSERT: storniert, Bestand zurück, erstattet — kein Auftrag, Sentry', async () => {
    const { produkt, bestellung, paymentIntentId } = await offeneOnlineBestellung()
    await zustellen(ereignis('payment_intent.succeeded', paymentIntentId))
    await nachlaufFertig()
    vi.mocked(Sentry.captureException).mockClear()
    try {
      await sperreMailAuftraege('immer')
      expect(await cancelOrder(bestellung.id)).not.toHaveProperty('error')
      await nachlaufFertig()
    } finally {
      await gibMailAuftraegeFrei()
    }
    expect(await zustand(bestellung.id)).toMatchObject({ status: 'CANCELLED', paymentStatus: 'REFUNDED' })
    expect(await bestand(produkt.id)).toBe(BESTAND_NACH_CHECKOUT + MENGE)
    expect(erstatten).toHaveBeenCalledTimes(1)
    expect(await artenZu(bestellung.id)).not.toContain('storniert')
    expect(mailMeldungen()).toEqual(['in_transaktion_gescheitert', 'einstellen_gescheitert'])
  })

  it('Storno, nur das INSERT in der Transaktion scheitert: der Auftrag wird vor Stripe nachgeholt und trägt danach den erstatteten Betrag', async () => {
    const { produkt, bestellung, paymentIntentId } = await offeneOnlineBestellung()
    await zustellen(ereignis('payment_intent.succeeded', paymentIntentId))
    await nachlaufFertig()
    try {
      await sperreMailAuftraege('einmal')
      expect(await cancelOrder(bestellung.id)).toEqual({ erstattetCents: 2100, vomHofCents: 2000 })
      await nachlaufFertig()
    } finally {
      await gibMailAuftraegeFrei()
    }
    expect(await zustand(bestellung.id)).toMatchObject({ status: 'CANCELLED' })
    expect(await bestand(produkt.id)).toBe(BESTAND_NACH_CHECKOUT + MENGE)
    const [storno] = await auftraege({ bestellungId: bestellung.id, art: 'storniert' })
    expect(storno?.bezug).toEqual({ orderId: bestellung.id, erstattetCents: '2100' })
  })

  it('Gegenprobe ohne Trigger: Statuswechsel und Aufträge in derselben Transaktion, Rückgabe „eingestellt"', async () => {
    const { bestellung, paymentIntentId } = await offeneOnlineBestellung()
    expect((await zustellen(ereignis('payment_intent.succeeded', paymentIntentId))).status).toBe(200)
    expect(await einstellen.mock.results[0]!.value).toBe('eingestellt')
    expect(await artenZu(bestellung.id)).toEqual(['bestellung-bestaetigung', 'bestellung-bezahlt-hof'])
    expect(mailMeldungen()).toEqual([])
  })
})
