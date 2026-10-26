/**
 * Stornierung: Rückbuchung atomar und gegen Doppelausführung gesperrt
 * (src/server/actions/orders.ts) — am echten Code, Prisma/Stripe/Mail/Sentry
 * gemockt.
 *
 * Der Fehler: cancelOrder prüfte den Status nur LESEND (findFirst) und buchte
 * dann je Position außerhalb jeder Transaktion zurück; der Statuswechsel kam
 * erst am Ende. Zwei parallele Aufrufe (Doppeltipp) passierten beide die
 * Leseprüfung und erhöhten den Bestand doppelt. Dazu kamen Wege, eine
 * stornierte Bestellung wieder zu „öffnen" (Undo ohne Statusfilter) — danach
 * ließ sich ein zweites Mal stornieren und zurückbuchen.
 *
 * Die Fakes bilden die Datenbank-Semantik für EINE Bestellung nach: echter
 * Status, updateMany prüft und setzt in einem Zug (in JS unteilbar — wie ein
 * einzelnes UPDATE … WHERE in PostgreSQL). Der Wettlauf wird deterministisch
 * erzwungen: beide Aufrufe lesen, BEVOR einer schreibt.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
// Seit Nachbesserung 2 (Nr. 19) fragt der Storno vor der Vollerstattung, ob
// Stripe schon Erstattungen kennt — hier keine.
vi.mock('@/lib/stripe', () => ({
  stripe: { refunds: { create: vi.fn(), list: vi.fn(async () => ({ data: [], has_more: false })) } },
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
// Empfänger der Betreiber-Mail aus der Zustellung (Register N14, Nr. 95) — hier die feste Adresse.
vi.mock('@/server/queries/postfach', async () => {
  const { SUPPORT_EMAIL } = await import('@/lib/support')
  return { ladeBetreiberEmpfaenger: vi.fn(async () => [SUPPORT_EMAIL.toLowerCase()]) }
})
// Die Mails sind seit Nr. 159 Aufträge der Warteschlange; die Hilfen bleiben
// echt und schreiben in die Fakes (Nr. 168, tests/mail-attrappe.ts).
vi.mock('@/server/mail-warteschlange', async (o) => (await import('./mail-attrappe')).warteschlangeEcht(await o()))
vi.mock('@/schemas/mail-auftrag', async (o) => (await import('./mail-attrappe')).schemaEcht(await o()))
vi.mock('@/lib/nach-der-antwort', () => ({ nachDerAntwort: vi.fn() }))
/** Ein tx-Fake mit verschachtelter Transaktion (Savepoint, Nr. 168): Sie bekommt dieselben Fakes. */
const { txMit } = vi.hoisted(() => ({
  txMit: <T extends object>(fakes: T): T & { $transaction: (arbeit: (t: unknown) => Promise<unknown>) => Promise<unknown> } => {
    const tx = { ...fakes, $transaction: (arbeit: (t: unknown) => Promise<unknown>) => arbeit(tx) }
    return tx
  },
}))
vi.mock('@/lib/prisma', () => {
  // findUnique: Nach dem Storno liest das Erneuern der Hofliste den Termin (Nr. 163) — hier keiner.
  const order = { findFirst: vi.fn(), findUnique: vi.fn(async () => null), update: vi.fn(), updateMany: vi.fn() }
  const product = { update: vi.fn() }
  // Einstellen (createMany) und Nachtragen nach Stripe (updateMany, Nr. 159).
  const mailAuftrag = { createMany: vi.fn(async () => ({ count: 1 })), updateMany: vi.fn(async () => ({ count: 1 })) }
  return {
    prisma: {
      farm: { findUnique: vi.fn() },
      order,
      product,
      mailAuftrag,
      // Nach dem Storno fragt das Erneuern der Hofliste nach einer Höchstzahl (Nr. 131, seit Nr. 163 erst nach dem Termin) — hier keine.
      pickupSlot: { findFirst: vi.fn(async () => null) },
      // Standard: der Rückruf bekommt dieselben Fakes. Der Test, der die
      // Transaktion selbst beweist, ersetzt das durch EIGENE tx-Fakes.
      $transaction: vi.fn(async (arg: unknown) => {
        if (typeof arg === 'function') {
          return (arg as (tx: unknown) => Promise<unknown>)(txMit({ order, product, mailAuftrag }))
        }
        return Promise.all(arg as Array<Promise<unknown>>)
      }),
    },
  }
})

import {
  cancelOrder,
  revertOrderStatus,
  revertReady,
  revertPickedUp,
} from '@/server/actions/orders'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { stelleEinOhneRisiko, stelleMailEinInTransaktion } from '@/server/mail-warteschlange'
import { bezugSchemaFuer } from '@/schemas/mail-auftrag'
import { bezugWirft, ergebnis } from './mail-attrappe'
import * as Sentry from '@sentry/nextjs'

const getSession = vi.mocked(auth.api.getSession)
const farmFindUnique = vi.mocked(prisma.farm.findUnique)
const orderFindFirst = vi.mocked(prisma.order.findFirst)
const orderUpdate = vi.mocked(prisma.order.update)
const orderUpdateMany = vi.mocked(prisma.order.updateMany)
const productUpdate = vi.mocked(prisma.product.update)
const transaktion = vi.mocked(prisma.$transaction)
const refundCreate = vi.mocked(stripe.refunds.create)
const einstellen = vi.mocked(stelleMailEinInTransaktion)
const nachholen = vi.mocked(stelleEinOhneRisiko)
const createMany = vi.mocked(prisma.mailAuftrag.createMany)
const nachtragen = vi.mocked(prisma.mailAuftrag.updateMany)

/** Was der Storno nach Stripe in seinen Auftrag nachgetragen hat (Bezug je Aufruf). */
function nachgetragen(): unknown[] {
  return nachtragen.mock.calls.map(([arg]) => (arg as { data: { bezug: unknown } }).data.bezug)
}

/** Alle wirklich geschriebenen Aufträge (createMany in der Transaktion und danach), flach. */
function auftraege(): Array<{ art: string; bezug: Record<string, string>; bestellungId?: string; schluessel: string }> {
  return createMany.mock.calls.flatMap(([arg]) => (arg as { data: unknown[] }).data) as never
}
const sentryMeldung = vi.mocked(Sentry.captureException)

/** Bar-Bestellung mit zwei Positionen — ohne PaymentIntent, damit sich die
 *  Bestandsfälle nicht mit Stripe vermischen. */
function barBestellung() {
  return {
    id: 'order_1',
    orderNumber: 'TH-1',
    customerName: 'Anna Muster',
    customerEmail: 'anna@example.com',
    customerPhone: '+43 660 0000000',
    totalAmount: { toString: () => '20.00' },
    platformFeeAmount: { toString: () => '0.00' },
    serviceFeeCents: 0,
    serviceFeeRefundedAt: null,
    pickupDate: new Date('2026-09-25T12:00:00Z'),
    pickupTimeStart: '14:00',
    pickupTimeEnd: '16:00',
    paymentMethod: 'ONSITE_CASH',
    paymentStatus: 'PENDING',
    stripePaymentIntentId: null as string | null,
    /** Bestellstatus des Fakes — die Tests setzen ihn je Szenario. */
    status: 'CONFIRMED' as string,
    items: [
      { id: 'i1', productId: 'p_eier', productName: 'Eier', quantity: 2, unitPrice: { toString: () => '5.00' }, totalPrice: { toString: () => '10.00' }, product: null },
      { id: 'i2', productId: 'p_milch', productName: 'Milch', quantity: 3, unitPrice: { toString: () => '1.40' }, totalPrice: { toString: () => '4.20' }, product: null },
    ],
  }
}

type StatusFilter = string | { in?: string[]; notIn?: string[] } | undefined

/** Wie PostgreSQL einen Statusfilter auswertet: fehlt er, passt jeder Satz. */
function passt(filter: StatusFilter, status: string): boolean {
  if (filter === undefined) return true
  if (typeof filter === 'string') return filter === status
  if (filter.in && !filter.in.includes(status)) return false
  if (filter.notIn && filter.notIn.includes(status)) return false
  return true
}

/**
 * Nachgebaute Datenbank für EINE Bestellung. findFirst und updateMany werten
 * den Statusfilter aus; update schreibt blind (wie das echte update ohne
 * Statusbedingung). updateMany prüft und setzt in einem Zug.
 */
function datenbankMit(bestellung: ReturnType<typeof barBestellung>) {
  const satz = { ...bestellung }

  orderFindFirst.mockImplementation((async (arg: { where: { status?: StatusFilter } }) =>
    passt(arg?.where?.status, satz.status) ? satz : null) as never)

  orderUpdate.mockImplementation((async (arg: { data: Record<string, unknown> }) => {
    if (typeof arg?.data?.status === 'string') satz.status = arg.data.status
    return satz
  }) as never)

  orderUpdateMany.mockImplementation((async (arg: {
    where: { status?: StatusFilter }
    data: Record<string, unknown>
  }) => {
    if (!passt(arg?.where?.status, satz.status)) return { count: 0 }
    if (typeof arg?.data?.status === 'string') satz.status = arg.data.status
    return { count: 1 }
  }) as never)

  return satz
}

/** Wie oft der Bestand hochgebucht wurde — über ALLE Wege (tx und direkt). */
function rueckbuchungen(): number {
  return productUpdate.mock.calls.length
}

beforeEach(() => {
  vi.clearAllMocks()
  // clearAllMocks setzt nur Aufrufe zurück, keine Implementierungen. Ein Test,
  // der die Transaktion mit eigenen tx-Fakes belegt, liefe sonst in die
  // Folgetests weiter — mit dem Bestellsatz des Vortests. Deshalb hier jedes
  // Mal zurück auf die Durchreichung an die globalen Fakes.
  transaktion.mockImplementation((async (arg: unknown) =>
    typeof arg === 'function'
      ? (arg as (tx: unknown) => Promise<unknown>)(txMit({ order: prisma.order, product: prisma.product, mailAuftrag: prisma.mailAuftrag }))
      : Promise.all(arg as Array<Promise<unknown>>)) as never)
  getSession.mockResolvedValue({ user: { id: 'user_1' } } as never)
  farmFindUnique.mockResolvedValue({
    id: 'farm_1', name: 'Hof Test', slug: 'hof-test', email: 'hof@example.com', ownerName: 'Max Mustermann',
    address: 'Weg 1', postalCode: '1010', city: 'Musterdorf', phone: '+43 660 0000000',
  } as never)
  productUpdate.mockResolvedValue({} as never)
  refundCreate.mockResolvedValue({ id: 're_1', amount: 2000 } as never)
  createMany.mockResolvedValue({ count: 1 })
  vi.mocked(bezugSchemaFuer).mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ─── Doppelausführung ────────────────────────────────────────────────────────

describe('cancelOrder — Doppelausführung', () => {
  it('zwei GLEICHZEITIGE Stornierungen buchen den Bestand genau einmal zurück', async () => {
    const satz = datenbankMit(barBestellung())

    // Wettlauf deterministisch: beide Aufrufe LESEN, bevor einer schreibt —
    // exakt die Doppeltipp-Situation, in der beide die Leseprüfung passieren.
    const echtesLesen = orderFindFirst.getMockImplementation()
    if (!echtesLesen) throw new Error('datenbankMit hat findFirst nicht belegt')
    let leseAnfragen = 0
    let beideDa: () => void = () => {}
    const beideGelesen = new Promise<void>((entsperren) => { beideDa = entsperren })
    orderFindFirst.mockImplementation((async (arg: never) => {
      leseAnfragen += 1
      if (leseAnfragen >= 2) beideDa()
      await beideGelesen
      return echtesLesen(arg)
    }) as never)

    const [erste, zweite] = await Promise.all([
      cancelOrder('order_1', 'Hof verhindert'),
      cancelOrder('order_1', 'Hof verhindert'),
    ])

    const fehler = [erste, zweite].filter((r) => r.error)
    expect(fehler).toHaveLength(1)
    expect(fehler[0]?.error).toBe('Diese Bestellung ist schon storniert oder abgeholt.')
    expect(rueckbuchungen()).toBe(2) // zwei Positionen, einmal
    expect(satz.status).toBe('CANCELLED')
  })

  it('zweiter Aufruf NACH erfolgreicher Stornierung: Fehler, kein weiteres increment', async () => {
    datenbankMit(barBestellung())

    // Bar: nichts erstattet, nichts vom Hof abgezogen.
    expect(await cancelOrder('order_1')).toEqual({ erstattetCents: 0, vomHofCents: 0 })
    expect(rueckbuchungen()).toBe(2)

    const zweite = await cancelOrder('order_1')

    expect(zweite.error).toBe('Diese Bestellung ist schon storniert oder abgeholt.')
    expect(rueckbuchungen()).toBe(2)
    expect(refundCreate).not.toHaveBeenCalled()
  })

  it('Statuswechsel und Rückbuchung laufen durch DIESELBE Transaktion — nicht an ihr vorbei', async () => {
    const satz = datenbankMit(barBestellung())
    // Eigene tx-Fakes: Nur was über `tx` läuft, liegt in der Transaktion.
    // Eine Rückbuchung über das globale prisma fiele hier auf.
    const ablauf: string[] = []
    const txProduktUpdate = vi.fn(async () => { ablauf.push('buchung'); return {} })
    const txUpdateMany = vi.fn(async (arg: { where: { status?: StatusFilter }; data: Record<string, unknown> }) => {
      ablauf.push('sperre')
      if (!passt(arg.where.status, satz.status)) return { count: 0 }
      satz.status = String(arg.data.status)
      return { count: 1 }
    })
    // Seit Nr. 19 liest der Storno Beträge und Positionen frisch UNTER der
    // Sperre — auch das gehört in die Transaktion.
    const txFindFirst = vi.fn(async () => { ablauf.push('lesen'); return satz })
    // Der Mail-Auftrag ebenfalls über `tx` (Savepoint, Nr. 168).
    const txCreateMany = vi.fn(async () => { ablauf.push('auftrag'); return { count: 1 } })
    transaktion.mockImplementation((async (arg: unknown) => {
      ablauf.push('start')
      const ergebnis = await (arg as (tx: unknown) => Promise<unknown>)(txMit({
        order: { updateMany: txUpdateMany, findFirst: txFindFirst },
        product: { update: txProduktUpdate },
        mailAuftrag: { createMany: txCreateMany },
      }))
      ablauf.push('ende')
      return ergebnis
    }) as never)

    await cancelOrder('order_1')

    expect(ablauf).toEqual(['start', 'sperre', 'lesen', 'buchung', 'buchung', 'auftrag', 'ende'])
    expect(await ergebnis(einstellen)).toBe('eingestellt')
    expect(createMany).not.toHaveBeenCalled()
    expect(productUpdate).not.toHaveBeenCalled()
    expect(orderUpdateMany).not.toHaveBeenCalled()
  })

  it('NOT_PICKED_UP ist gesperrt: kein Storno, keine Rückbuchung, kein Stripe', async () => {
    // Bei „nicht abgeholt" bleibt der Warenpreis beim Hof (markAsNotPickedUp).
    // Die Oberfläche bietet dort kein Storno an — der Server darf es auch nicht.
    const satz = datenbankMit({
      ...barBestellung(),
      status: 'NOT_PICKED_UP',
      paymentMethod: 'ONLINE',
      paymentStatus: 'PAID',
      stripePaymentIntentId: 'pi_1',
    })

    const result = await cancelOrder('order_1')

    expect(result.error).toBe('Diese Bestellung ist schon storniert oder abgeholt.')
    expect(satz.status).toBe('NOT_PICKED_UP')
    expect(rueckbuchungen()).toBe(0)
    expect(refundCreate).not.toHaveBeenCalled()
  })
})

// ─── Erstattung nach der Sperre ──────────────────────────────────────────────

describe('cancelOrder — Erstattung erst nach der Sperre', () => {
  function onlineBezahlt() {
    return datenbankMit({
      ...barBestellung(),
      status: 'PAID',
      paymentMethod: 'ONLINE',
      paymentStatus: 'PAID',
      stripePaymentIntentId: 'pi_1',
    })
  }

  it('Stripe erst NACH dem gesperrten Statuswechsel, volle Erstattung, danach REFUNDED und Mail', async () => {
    onlineBezahlt()

    const result = await cancelOrder('order_1')

    expect(result).toEqual({ erstattetCents: 2000, vomHofCents: 2000 })
    // Voll erstattet, kein Betrag: die Überweisung an den Hof wird zurückgeholt
    // (Destination Charge, tests/storno-erstattung.test.ts). Ohne Gebühr gibt es
    // keine application_fee zu erstatten. Fester Schlüssel gegen Doppelerstattung.
    expect(refundCreate).toHaveBeenCalledWith(
      { payment_intent: 'pi_1', reverse_transfer: true, metadata: { orderId: 'order_1', anlass: 'vollstorno', art: 'kunde' } },
      { idempotencyKey: 'storno-order_1' }
    )
    expect(orderUpdateMany.mock.invocationCallOrder[0]).toBeLessThan(
      refundCreate.mock.invocationCallOrder[0]
    )
    expect(orderUpdate).toHaveBeenCalledWith(
      // Mit dem Erstatten ist auch eine offene Erstattung erledigt (Aufgabe im Admin-Postfach, N14).
      expect.objectContaining({ data: { paymentStatus: 'REFUNDED', erstattungOffenSeit: null } })
    )
    // Die Storno-Mail als Auftrag IN der Storno-Transaktion (vor Stripe, also
    // „ausstehend"), danach der Betrag, den Stripe erstattet hat (Cent); den
    // Grund liest der Renderer an der Bestellung.
    expect(auftraege()).toEqual([
      expect.objectContaining({ art: 'storniert', schluessel: 'storniert:order_1', bezug: { orderId: 'order_1', erstattung: 'ausstehend' }, bestellungId: 'order_1' }),
    ])
    expect(einstellen.mock.calls[0]![1]).toBeDefined()
    expect(await ergebnis(einstellen)).toBe('eingestellt')
    expect(einstellen.mock.invocationCallOrder[0]).toBeLessThan(refundCreate.mock.invocationCallOrder[0]!)
    expect(nachgetragen()).toEqual([{ orderId: 'order_1', erstattetCents: '2000' }])
    expect(nachtragen.mock.calls[0]![0]).toMatchObject({ where: { schluessel: 'storniert:order_1', status: { in: ['offen', 'in_arbeit'] } } })
  })

  it('scheitert die Erstattung: Storno bleibt, Ware bleibt zurückgebucht, KEINE Mail, Meldung an Sentry', async () => {
    const satz = onlineBezahlt()
    refundCreate.mockRejectedValue(new Error('insufficient_funds'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await cancelOrder('order_1')

    expect(result.error).toBe(
      'Rückerstattung fehlgeschlagen. Wir kümmern uns um die Erstattung und melden uns.'
    )
    expect(satz.status).toBe('CANCELLED')
    expect(rueckbuchungen()).toBe(2)
    // Kein falscher REFUNDED-Vermerk (paymentStatus bleibt PAID).
    expect(orderUpdate).not.toHaveBeenCalled()
    // Die Storno-Vorlage liest „keine Erstattung" als Vor-Ort-Zahlung und
    // schriebe „Da du vor Ort bezahlst, entstehen dir keine Kosten" — an eine
    // Kundin, die online bezahlt hat und noch nichts zurückbekam.
    // Der Auftrag steht schon (Transaktion), wird aber auf „offen" gesetzt —
    // der Renderer verwirft ihn, es geht keine Storno-Mail.
    expect(nachgetragen()).toEqual([{ orderId: 'order_1', erstattung: 'offen' }])
    // Offenes Geld darf nicht nur im Log stehen.
    expect(sentryMeldung).toHaveBeenCalledTimes(1)
    const [, kontext] = sentryMeldung.mock.calls[0] as [unknown, { extra?: Record<string, unknown> }]
    expect(kontext.extra).toEqual(expect.objectContaining({ orderId: 'order_1' }))
    // Keine Kundendaten an Sentry (CLAUDE.md, Sicherheit).
    expect(JSON.stringify(kontext)).not.toContain('anna@example.com')
    // Der Betreiber bekommt eine Meldung — der Hof hat keinen Zugang zum
    // Plattformkonto (Nr. 19c). Ohne Daten der Kundin: je Empfänger ein
    // Auftrag mit Fall und Beträgen (die feste Adresse heißt `support`).
    const offen = auftraege().filter((a) => a.art === 'erstattung-offen')
    expect(offen).toHaveLength(1)
    const meldung = offen[0]!
    expect(meldung).toMatchObject({
      schluessel: 'erstattung-offen:storno-order_1:support',
      bestellungId: 'order_1',
      bezug: { empfaengerId: 'support', fall: 'storno_voll', orderId: 'order_1', kundinCents: '2000', hofCents: '2000' },
    })
    // Die Aufgabe „Erstattung offen" im Admin-Postfach: bedingt gesetzt, die erste Zeit bleibt.
    expect(orderUpdateMany).toHaveBeenCalledWith({ where: { id: 'order_1', erstattungOffenSeit: null }, data: { erstattungOffenSeit: expect.any(Date) } })
    expect(JSON.stringify(meldung)).not.toContain('anna@example.com')
    expect(JSON.stringify(meldung)).not.toContain('Anna')
  })

  it('Geld erstattet, nur der REFUNDED-Vermerk scheitert: Erfolg an den Hof, Mail MIT Betrag, Sentry meldet den Vermerk', async () => {
    onlineBezahlt()
    orderUpdate.mockRejectedValueOnce(new Error('connection reset'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await cancelOrder('order_1')

    // Das Geld IST zurück — „Rückerstattung fehlgeschlagen" wäre gelogen.
    expect(result).toEqual({ erstattetCents: 2000, vomHofCents: 2000 })
    expect(nachgetragen()).toEqual([{ orderId: 'order_1', erstattetCents: '2000' }])
    expect(sentryMeldung).toHaveBeenCalledTimes(1)
    const [, kontext] = sentryMeldung.mock.calls[0] as [unknown, { tags?: Record<string, unknown> }]
    expect(kontext.tags).toEqual(expect.objectContaining({ grund: 'vermerk_fehlgeschlagen' }))
  })

  it('kein Versand im Antwortpfad: bar storniert steht ein Auftrag ohne Erstattung, in der Transaktion; nichts nachzutragen', async () => {
    datenbankMit({ ...barBestellung(), status: 'READY' })
    expect(await cancelOrder('order_1')).toEqual({ erstattetCents: 0, vomHofCents: 0 })
    expect(auftraege()).toEqual([expect.objectContaining({ art: 'storniert', bezug: { orderId: 'order_1' } })])
    expect(nachtragen).not.toHaveBeenCalled()

  })

  it('scheitert das Einstellen (Datenbank): storniert, Bestand zurück, Erstattung angestoßen — die Mail direkt nach dem Commit nachgeholt, vor Stripe', async () => {
    const satz = onlineBezahlt()
    createMany.mockRejectedValueOnce(new Error('DB weg'))

    expect(await cancelOrder('order_1')).toEqual({ erstattetCents: 2000, vomHofCents: 2000 })
    expect(satz.status).toBe('CANCELLED')
    expect(rueckbuchungen()).toBe(2)
    expect(await ergebnis(einstellen)).toBe('nachholen')
    expect(nachholen).toHaveBeenCalledWith('storniert', 'order_1', expect.objectContaining({ schluessel: 'storniert:order_1', bezug: { orderId: 'order_1', erstattung: 'ausstehend' } }))
    // Nachgeholt VOR Stripe und vor dem Nachtragen: sonst fände das Nachtragen keinen Auftrag.
    expect(nachholen.mock.invocationCallOrder[0]).toBeLessThan(refundCreate.mock.invocationCallOrder[0]!)
    expect(createMany.mock.invocationCallOrder[1]).toBeLessThan(refundCreate.mock.invocationCallOrder[0]!)
    expect(createMany.mock.invocationCallOrder[1]).toBeLessThan(nachtragen.mock.invocationCallOrder[0]!)
    expect(nachgetragen()).toEqual([{ orderId: 'order_1', erstattetCents: '2000' }])
  })

  it('ungültiger Bezug (Register N26, 25.10.2026): storniert, Bestand zurück, Sentry einmal mit Art und Bestellung, kein Auftrag', async () => {
    const satz = datenbankMit({ ...barBestellung(), status: 'READY' })
    bezugWirft(bezugSchemaFuer)

    expect(await cancelOrder('order_1')).toEqual({ erstattetCents: 0, vomHofCents: 0 })
    expect(satz.status).toBe('CANCELLED')
    expect(rueckbuchungen()).toBe(2)
    expect(await ergebnis(einstellen)).toBe('ungueltig')
    expect(createMany).not.toHaveBeenCalled()
    expect(nachholen).not.toHaveBeenCalled()
    expect(sentryMeldung).toHaveBeenCalledTimes(1)
    expect(sentryMeldung).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ tags: { bereich: 'mail-warteschlange', art: 'storniert', grund: 'bezug_ungueltig' }, extra: { bestellungId: 'order_1' } })
    )
  })

  it('scheitert nur das Nachtragen der Erstattung: Storno und Erstattung bleiben, Sentry meldet es', async () => {
    onlineBezahlt()
    nachtragen.mockRejectedValueOnce(new Error('connection reset'))
    expect(await cancelOrder('order_1')).toEqual({ erstattetCents: 2000, vomHofCents: 2000 })
    expect(sentryMeldung).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ tags: { aktion: 'bestellmail', art: 'storniert', grund: 'erstattung_eintragen' } })
    )
  })
})

// ─── Undo darf eine Stornierung nie aufheben ─────────────────────────────────

describe('Undo-Aktionen — eine stornierte Bestellung bleibt storniert', () => {
  it('revertOrderStatus auf eine stornierte Bestellung: abgelehnt, Status bleibt CANCELLED', async () => {
    // Weg im UI: „Bereit" → Storno → im noch sichtbaren Toast „Rückgängig".
    const satz = datenbankMit({ ...barBestellung(), status: 'CANCELLED' })

    const result = await revertOrderStatus('order_1', 'CONFIRMED')

    expect(result.error).toBeTruthy()
    expect(satz.status).toBe('CANCELLED')
  })

  it('Storno → Undo → Storno bucht den Bestand genau EINMAL zurück', async () => {
    const satz = datenbankMit({ ...barBestellung(), status: 'READY' })

    await cancelOrder('order_1')
    await revertOrderStatus('order_1', 'CONFIRMED')
    await cancelOrder('order_1')

    expect(satz.status).toBe('CANCELLED')
    expect(rueckbuchungen()).toBe(2)
  })

  it.each([
    // „Bereit" → „Abgeholt" → „Rückgängig" im ERSTEN, noch sichtbaren Toast:
    // Abgeholte Ware spränge auf CONFIRMED und wäre wieder stornierbar.
    ['PICKED_UP', 'CONFIRMED'],
    ['PICKED_UP', 'PAID'],
    // READY → READY: nach „Abholung rückgängig" löschte ein Toast-Undo paidAt.
    ['READY', 'READY'],
  ] as const)('revertOrderStatus lehnt das falsche Paar %s → %s ab', async (ist, zurueckAuf) => {
    const satz = datenbankMit({ ...barBestellung(), status: ist })

    const result = await revertOrderStatus('order_1', zurueckAuf)

    expect(result.error).toBeTruthy()
    expect(satz.status).toBe(ist)
  })

  it('revertOrderStatus aus READY bzw. PICKED_UP funktioniert weiter', async () => {
    const satz = datenbankMit({ ...barBestellung(), status: 'READY' })
    expect(await revertOrderStatus('order_1', 'CONFIRMED')).toEqual({})
    expect(satz.status).toBe('CONFIRMED')

    satz.status = 'PICKED_UP'
    expect(await revertOrderStatus('order_1', 'READY')).toEqual({})
    expect(satz.status).toBe('READY')
  })

  it.each([
    ['revertReady', 'READY', () => revertReady('order_1', false)],
    ['revertPickedUp', 'PICKED_UP', () => revertPickedUp('order_1')],
  ] as const)(
    '%s: wird zwischen Lesen und Schreiben storniert, bleibt die Bestellung storniert',
    async (_name, ausgang, rueckweg) => {
      const satz = datenbankMit({ ...barBestellung(), status: ausgang })
      // Der Storno „gewinnt" genau zwischen der Leseprüfung des Rückwegs und
      // seinem Schreiben — die Leseprüfung allein hielte das nicht auf.
      const echtesLesen = orderFindFirst.getMockImplementation()
      if (!echtesLesen) throw new Error('datenbankMit hat findFirst nicht belegt')
      orderFindFirst.mockImplementationOnce((async (arg: never) => {
        const gelesen = await echtesLesen(arg)
        satz.status = 'CANCELLED'
        return gelesen
      }) as never)

      const result = await rueckweg()

      expect(result.error).toBeTruthy()
      expect(satz.status).toBe('CANCELLED')
    }
  )
})
