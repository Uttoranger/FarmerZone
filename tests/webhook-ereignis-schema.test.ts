/**
 * Stripe-Webhook (Nachtlauf Nr. 203): Signaturfehler ohne Einzelheiten nach
 * außen, jedes verarbeitete Ereignis vor der Verarbeitung gegen sein Schema
 * (src/schemas/stripe-ereignis.ts).
 *
 * Beweist (Stripe, Prisma, Behandlungen und Sentry gemockt):
 *  - Falsche Signatur → 400 `{ error: 'Signatur ungültig' }`; die Meldung von
 *    Stripe steht nur im Server-Protokoll.
 *  - Je Typ: gültig → die Behandlung läuft und das Ereignis wird vermerkt;
 *    ungültig → 200, keine Behandlung, kein Vermerk, Sentry mit Typ und
 *    Feldpfaden, ohne Werte.
 *  - Sentry höchstens einmal je Typ und Tag (BetriebMessung, ON CONFLICT DO
 *    NOTHING): eine zweite Zustellung am selben Tag schweigt, ein anderer Typ
 *    meldet; scheitert die Datenbank, wird nicht gemeldet, die Antwort bleibt 200.
 *  - Ereignisse eines verbundenen Kontos: nur account.updated wird geprüft und
 *    verarbeitet; ein unbekannter Typ bleibt wie bisher 200 ohne Wirkung.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/stripe', () => ({
  stripe: {
    webhooks: { constructEvent: vi.fn() },
    refunds: { create: vi.fn() },
    accounts: { retrieve: vi.fn(async () => ({ id: 'acct_1', charges_enabled: true, payouts_enabled: true })) },
  },
}))

vi.mock('@/lib/prisma', () => {
  const prisma = {
    webhookEvent: { findUnique: vi.fn(), create: vi.fn() },
    order: { findUnique: vi.fn(), updateMany: vi.fn() },
    farm: { findFirst: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
  }
  prisma.$transaction.mockImplementation(async (arbeit: (tx: typeof prisma) => Promise<unknown>) => arbeit(prisma))
  return { prisma }
})

vi.mock('@/server/mail-warteschlange', () => ({ stelleEinOhneRisiko: vi.fn(), stelleMailEinInTransaktion: vi.fn() }))
// Nachläufe sammeln: zustellen() führt sie nach der Antwort aus, wie after() es täte.
const nachlaeufe = vi.hoisted(() => [] as Array<() => Promise<void>>)
vi.mock('@/lib/nach-der-antwort', () => ({ nachDerAntwort: vi.fn((aufgabe: () => Promise<void>) => void nachlaeufe.push(aufgabe)) }))
vi.mock('@/server/unbezahlte-bestellung', () => ({ storniereUnbezahlteBestellung: vi.fn() }))
vi.mock('@/server/erstattung-gescheitert', () => ({
  MELDE_VERMERK_TYP: 'meldung.erstattung_gescheitert',
  meldeVermerk: (id: string) => `${id}#gescheitert-gemeldet`,
  nimmGescheiterteErstattungZurueck: vi.fn(async () => ({ art: 'nicht_gescheitert' })),
}))
vi.mock('@/server/plattformgebuehr-abrechnung', () => ({
  behandleMandatEingerichtet: vi.fn(),
  behandleMandatGeaendert: vi.fn(),
  behandleRechnungBezahlt: vi.fn(),
  behandleRechnungGescheitert: vi.fn(),
  behandleRueckbuchung: vi.fn(),
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

import * as Sentry from '@sentry/nextjs'
import { POST } from '@/app/api/stripe/webhook/route'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { storniereUnbezahlteBestellung } from '@/server/unbezahlte-bestellung'
import { nimmGescheiterteErstattungZurueck } from '@/server/erstattung-gescheitert'
import * as abrechnung from '@/server/plattformgebuehr-abrechnung'
import type { VerarbeiteterStripeTyp } from '@/schemas/stripe-ereignis'
import { BEISPIELE } from './stripe-ereignis-beispiele'

const constructEvent = vi.mocked(stripe.webhooks.constructEvent)
const queryRaw = vi.mocked(prisma.$queryRaw)
const captureMessage = vi.mocked(Sentry.captureMessage)

/** Welche Attrappe zeigt, dass die Behandlung des Typs lief. */
const BEHANDLUNG: Record<VerarbeiteterStripeTyp, () => unknown> = {
  'payment_intent.succeeded': () => prisma.$transaction,
  'payment_intent.payment_failed': () => prisma.order.updateMany,
  'payment_intent.canceled': () => prisma.order.findUnique,
  'account.updated': () => prisma.farm.findFirst,
  'refund.failed': () => nimmGescheiterteErstattungZurueck,
  'charge.refund.updated': () => nimmGescheiterteErstattungZurueck,
  'invoice.paid': () => abrechnung.behandleRechnungBezahlt,
  'invoice.payment_failed': () => abrechnung.behandleRechnungGescheitert,
  'charge.dispute.created': () => abrechnung.behandleRueckbuchung,
  'setup_intent.succeeded': () => abrechnung.behandleMandatEingerichtet,
  'mandate.updated': () => abrechnung.behandleMandatGeaendert,
}
const TYPEN = Object.keys(BEHANDLUNG) as VerarbeiteterStripeTyp[]

/** Jeder Tag der Tests beginnt mit einer leeren Zeile je Typ: die erste Anfrage legt an. */
let angelegt: Set<string>

async function zustellen(type: string, object: unknown, extra: Record<string, unknown> = {}, id = 'evt_1') {
  constructEvent.mockReturnValue({ id, type, data: { object }, ...extra } as never)
  const antwort = await POST(new NextRequest('http://localhost/api/stripe/webhook', { method: 'POST', body: '{}', headers: { 'stripe-signature': 'sig_test' } }))
  for (let aufgabe = nachlaeufe.shift(); aufgabe; aufgabe = nachlaeufe.shift()) await aufgabe()
  return antwort
}

beforeEach(() => {
  vi.clearAllMocks()
  nachlaeufe.length = 0
  vi.useRealTimers()
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test_dummy')
  vi.mocked(prisma.webhookEvent.findUnique).mockResolvedValue(null)
  vi.mocked(prisma.webhookEvent.create).mockResolvedValue({} as never)
  vi.mocked(prisma.order.updateMany).mockResolvedValue({ count: 0 })
  vi.mocked(prisma.order.findUnique).mockResolvedValue(null)
  vi.mocked(prisma.farm.findFirst).mockResolvedValue(null)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  angelegt = new Set()
  queryRaw.mockImplementation((async (_teile: TemplateStringsArray, tag: string, art: string) => {
    const schluessel = `${tag}|${art}`
    if (angelegt.has(schluessel)) return []
    angelegt.add(schluessel)
    return [{ art }]
  }) as never)
})

describe('Signatur ungültig: 400 ohne Einzelheiten', () => {
  it('antwortet nur „Signatur ungültig“; die Meldung von Stripe steht im Protokoll, nie das Secret', async () => {
    constructEvent.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature for payload')
    })
    const antwort = await POST(new NextRequest('http://localhost/api/stripe/webhook', { method: 'POST', body: '{}', headers: { 'stripe-signature': 'sig_test' } }))
    expect(antwort.status).toBe(400)
    expect(await antwort.json()).toEqual({ error: 'Signatur ungültig' })
    const protokoll = JSON.stringify(vi.mocked(console.error).mock.calls)
    expect(protokoll).toContain('No signatures found')
    expect(protokoll).not.toContain('whsec_')
    expect(prisma.webhookEvent.findUnique).not.toHaveBeenCalled()
  })
})

describe('Je verarbeitetem Typ: erst das Schema, dann die Behandlung', () => {
  it.each(TYPEN)('%s gültig → verarbeitet und vermerkt', async (typ) => {
    const antwort = await zustellen(typ, BEISPIELE[typ].gueltig)
    expect(antwort.status).toBe(200)
    expect(BEHANDLUNG[typ]()).toHaveBeenCalled()
    expect(prisma.webhookEvent.create).toHaveBeenCalledWith({ data: { stripeEventId: 'evt_1', type: typ } })
    expect(captureMessage).not.toHaveBeenCalled()
  })

  it.each(TYPEN)('%s ungültig → 200, keine Behandlung, kein Vermerk, Sentry mit Feld und ohne Werte', async (typ) => {
    const antwort = await zustellen(typ, BEISPIELE[typ].ungueltig)
    expect(antwort.status).toBe(200)
    expect(await antwort.json()).toEqual({ received: true, skipped: true })
    expect(BEHANDLUNG[typ]()).not.toHaveBeenCalled()
    expect(storniereUnbezahlteBestellung).not.toHaveBeenCalled()
    expect(prisma.webhookEvent.create).not.toHaveBeenCalled()
    expect(captureMessage).toHaveBeenCalledTimes(1)
    const [titel, kontext] = captureMessage.mock.calls[0] as [string, { tags: Record<string, string>; extra: Record<string, unknown> }]
    expect(titel).toBe('Stripe-Ereignis mit unerwartetem Aufbau — nicht verarbeitet')
    expect(kontext.tags).toEqual({ webhook: typ, grund: 'schema_ungueltig' })
    expect(kontext.extra).toEqual({ eventId: 'evt_1', felder: [BEISPIELE[typ].feld] })
  })
})

describe('Sentry höchstens einmal je Typ und Tag', () => {
  it('zweite Zustellung desselben Typs am selben Tag schweigt; ein anderer Typ und der nächste Tag melden', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-30T10:00:00Z'), toFake: ['Date'] })
    await zustellen('invoice.paid', BEISPIELE['invoice.paid'].ungueltig, {}, 'evt_a')
    await zustellen('invoice.paid', BEISPIELE['invoice.paid'].ungueltig, {}, 'evt_b')
    expect(captureMessage).toHaveBeenCalledTimes(1)
    await zustellen('mandate.updated', BEISPIELE['mandate.updated'].ungueltig, {}, 'evt_c')
    expect(captureMessage).toHaveBeenCalledTimes(2)
    vi.setSystemTime(new Date('2026-10-31T00:30:00Z'))
    await zustellen('invoice.paid', BEISPIELE['invoice.paid'].ungueltig, {}, 'evt_d')
    expect(captureMessage).toHaveBeenCalledTimes(3)
    // Jede Zustellung fragt die Datenbank; nur wer die Zeile des Tages anlegt, meldet.
    expect(queryRaw.mock.calls.map((c) => [c[1], c[2]])).toEqual([
      ['2026-10-30', 'sentry:stripe-schema:invoice.paid'],
      ['2026-10-30', 'sentry:stripe-schema:invoice.paid'],
      ['2026-10-30', 'sentry:stripe-schema:mandate.updated'],
      ['2026-10-31', 'sentry:stripe-schema:invoice.paid'],
    ])
  })

  it('scheitert die Datenbank: keine Meldung, die Antwort bleibt 200 ohne Verarbeitung', async () => {
    queryRaw.mockRejectedValue(new Error('Datenbank weg'))
    const antwort = await zustellen('invoice.payment_failed', BEISPIELE['invoice.payment_failed'].ungueltig)
    expect(antwort.status).toBe(200)
    expect(captureMessage).not.toHaveBeenCalled()
    expect(abrechnung.behandleRechnungGescheitert).not.toHaveBeenCalled()
  })
})

describe('Ereignisse verbundener Konten und unbekannte Typen', () => {
  it('account.updated eines verbundenen Kontos wird geprüft: ungültig nicht verarbeitet, gültig verarbeitet', async () => {
    await zustellen('account.updated', BEISPIELE['account.updated'].ungueltig, { account: 'acct_1' })
    expect(prisma.farm.findFirst).not.toHaveBeenCalled()
    expect(captureMessage).toHaveBeenCalledTimes(1)
    await zustellen('account.updated', BEISPIELE['account.updated'].gueltig, { account: 'acct_1' }, 'evt_2')
    expect(prisma.farm.findFirst).toHaveBeenCalled()
  })

  it('ein anderer Typ eines verbundenen Kontos und ein unbekannter Typ: wie bisher 200, vermerkt, ohne Prüfung', async () => {
    const konto = await zustellen('payment_intent.succeeded', { kaputt: true }, { account: 'acct_1' })
    expect(konto.status).toBe(200)
    expect(prisma.$transaction).not.toHaveBeenCalled()
    const fremd = await zustellen('customer.created', null, {}, 'evt_2')
    expect(fremd.status).toBe(200)
    expect(await fremd.json()).toEqual({ received: true })
    expect(captureMessage).not.toHaveBeenCalled()
    expect(queryRaw).not.toHaveBeenCalled()
  })
})
