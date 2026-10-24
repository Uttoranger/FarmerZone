/**
 * Das tägliche Aufräumen gegen ein ECHTES Postgres (Register N18, Nr. 104) —
 * über den bestehenden Ablauf `api/cron/cleanup-reservations`; der Zustand
 * der Tabellen danach ist die Aussage.
 *
 * Beweist:
 *  - Sitzung: vor 6 Tagen abgelaufen bleibt, vor 8 Tagen ist sie weg, eine
 *    gültige (laufender Login) bleibt.
 *  - Code: 2 Tage nach Ablauf weg, 12 Stunden nach Ablauf bleibt er.
 *  - Webhook-Ereignis: nach 31 Tagen weg, nach 29 Tagen bleibt es — und ein
 *    40 Tage alter Melde-Vermerk (MELDE_VERMERK_TYP) bleibt immer.
 *  - Messung: 401 Tage alt weg, 399 Tage alt bleibt sie.
 *  - Keine Bestellung, keine Position, kein Konto, kein Hof wird angefasst
 *    (Zählung vorher und nachher); das Konto mit nur alten Sitzungen bleibt.
 *
 * Daten: Konto, Sitzungen, Codes, Ereignisse und Messungs-Arten mit
 * `int-`-Kennung, erfundene Werte (@example.com); danach weg. Der Herzschlag
 * „aufraeumen“ hat einen festen Namen: Der Test hält fest, ob es ihn vorher
 * gab, und stellt den Stand danach wieder her.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { utcTag, utcTagVersetzt } from '@/lib/betrieb'
import { MELDE_VERMERK_TYP, meldeVermerk } from '@/server/erstattung-gescheitert'
import { intKennung } from './setup/basis'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

const TAG = 24 * 60 * 60 * 1000
type Lauf = Awaited<ReturnType<typeof prisma.ablaufLauf.findUnique>>
let laufVorher: Lauf = null

function vor(ms: number): Date {
  return new Date(Date.now() - ms)
}

function tagDatum(tag: string): Date {
  return new Date(`${tag}T00:00:00.000Z`)
}

async function rufeAblauf(): Promise<{ aufgeraeumt: { sitzungen: number; codes: number; webhookEreignisse: number; messungen: number } | null }> {
  vi.stubEnv('CRON_SECRET', 'int-cron-geheim')
  const { GET } = await import('@/app/api/cron/cleanup-reservations/route')
  const antwort = await GET(new NextRequest('http://localhost/api/cron/cleanup-reservations', { headers: { authorization: 'Bearer int-cron-geheim' } }))
  expect(antwort.status).toBe(200)
  return antwort.json()
}

beforeAll(async () => {
  laufVorher = await prisma.ablaufLauf.findUnique({ where: { name: 'aufraeumen' } })
})

afterEach(async () => {
  vi.unstubAllEnvs()
  await prisma.user.deleteMany({ where: { email: { startsWith: 'int-' } } })
  await prisma.verification.deleteMany({ where: { identifier: { startsWith: 'int-' } } })
  await prisma.webhookEvent.deleteMany({ where: { stripeEventId: { startsWith: 'int-' } } })
  await prisma.betriebMessung.deleteMany({ where: { art: { startsWith: 'int-' } } })
  await prisma.mailAuftrag.deleteMany({ where: { schluessel: { startsWith: 'int-' } } })
})

afterAll(async () => {
  if (laufVorher) {
    const { name, ...rest } = laufVorher
    await prisma.ablaufLauf.upsert({ where: { name }, create: laufVorher, update: rest })
  } else {
    await prisma.ablaufLauf.deleteMany({ where: { name: 'aufraeumen' } })
  }
})

describe('Aufräumen im Ablauf cleanup-reservations', () => {
  it('löscht nach den festen Grenzen und lässt Laufendes, Junges und die Melde-Vermerke stehen', async () => {
    const kennung = intKennung('aufraeumen')
    const konto = await prisma.user.create({ data: { id: kennung, email: `${kennung}@example.com`, name: 'Max Mustermann', role: 'CUSTOMER', emailVerified: true } })
    const sitzung = (was: string, expiresAt: Date) => ({ id: `${kennung}-${was}`, token: `${kennung}-${was}`, userId: konto.id, expiresAt, ipAddress: '192.0.2.10', userAgent: 'Testbrowser' })
    await prisma.session.createMany({ data: [sitzung('sechs', vor(6 * TAG)), sitzung('acht', vor(8 * TAG)), sitzung('gueltig', new Date(Date.now() + TAG))] })
    await prisma.verification.createMany({
      data: [
        { id: `${kennung}-code-alt`, identifier: `${kennung}-code-alt`, value: '000000', expiresAt: vor(2 * TAG) },
        { id: `${kennung}-code-jung`, identifier: `${kennung}-code-jung`, value: '000000', expiresAt: vor(12 * 60 * 60 * 1000) },
      ],
    })
    await prisma.webhookEvent.createMany({
      data: [
        { stripeEventId: `${kennung}-evt-alt`, type: 'payment_intent.succeeded', createdAt: vor(31 * TAG) },
        { stripeEventId: `${kennung}-evt-jung`, type: 'payment_intent.succeeded', createdAt: vor(29 * TAG) },
        { stripeEventId: meldeVermerk(`${kennung}-re`), type: MELDE_VERMERK_TYP, createdAt: vor(40 * TAG) },
      ],
    })
    const heute = utcTag(new Date())
    await prisma.betriebMessung.createMany({
      data: [
        { tag: tagDatum(utcTagVersetzt(heute, -401)), art: 'int-alt', wert: BigInt(1) },
        { tag: tagDatum(utcTagVersetzt(heute, -399)), art: 'int-jung', wert: BigInt(1) },
      ],
    })
    const zaehle = () => Promise.all([prisma.order.count(), prisma.orderItem.count(), prisma.user.count(), prisma.farm.count()])
    const vorher = await zaehle()

    const { aufgeraeumt } = await rufeAblauf()

    expect(aufgeraeumt).not.toBeNull()
    expect(aufgeraeumt?.sitzungen).toBeGreaterThanOrEqual(1)
    expect(aufgeraeumt?.codes).toBeGreaterThanOrEqual(1)
    expect(aufgeraeumt?.webhookEreignisse).toBeGreaterThanOrEqual(1)
    expect(aufgeraeumt?.messungen).toBeGreaterThanOrEqual(1)
    expect((await prisma.session.findMany({ where: { userId: konto.id }, select: { id: true } })).map((s) => s.id).sort()).toEqual([`${kennung}-gueltig`, `${kennung}-sechs`])
    expect((await prisma.verification.findMany({ where: { identifier: { startsWith: kennung } }, select: { id: true } })).map((v) => v.id)).toEqual([`${kennung}-code-jung`])
    expect((await prisma.webhookEvent.findMany({ where: { stripeEventId: { startsWith: kennung } }, select: { stripeEventId: true } })).map((e) => e.stripeEventId).sort()).toEqual([
      `${kennung}-evt-jung`,
      meldeVermerk(`${kennung}-re`),
    ])
    expect((await prisma.betriebMessung.findMany({ where: { art: { startsWith: 'int-' } }, select: { art: true } })).map((m) => m.art)).toEqual(['int-jung'])
    expect(await zaehle()).toEqual(vorher)
    expect(await prisma.user.findUnique({ where: { id: konto.id }, select: { id: true } })).toEqual({ id: konto.id })
  })

  it('Mail-Warteschlange (N26, Nr. 158): nach 90 Tagen weg, mit 89 bleibt sie; abgelaufene Belegung wird wieder offen, laufende nicht', async () => {
    const kennung = intKennung('mails')
    const zeile = (was: string, erstelltAm: Date, teil: { status?: string; belegtBis?: Date } = {}) => ({
      art: 'rundschreiben',
      vorrang: 2,
      schluessel: `${kennung}-${was}`,
      bezug: { unterhaltungId: kennung },
      erstelltAm,
      ...teil,
    })
    await prisma.mailAuftrag.createMany({
      data: [
        zeile('alt', vor(91 * TAG), { status: 'gesendet' }),
        zeile('jung', vor(89 * TAG), { status: 'gesendet' }),
        zeile('haengt', vor(TAG), { status: 'in_arbeit', belegtBis: vor(60_000) }),
        zeile('laeuft', vor(TAG), { status: 'in_arbeit', belegtBis: new Date(Date.now() + 60_000) }),
      ],
    })
    const { aufgeraeumt } = await rufeAblauf()
    expect(aufgeraeumt).toMatchObject({ mailAuftraege: expect.any(Number), mailAuftraegeFrei: expect.any(Number) })
    const stand = await prisma.mailAuftrag.findMany({ where: { schluessel: { startsWith: kennung } }, select: { schluessel: true, status: true, belegtBis: true }, orderBy: { schluessel: 'asc' } })
    expect(stand).toEqual([
      { schluessel: `${kennung}-haengt`, status: 'offen', belegtBis: null },
      { schluessel: `${kennung}-jung`, status: 'gesendet', belegtBis: null },
      { schluessel: `${kennung}-laeuft`, status: 'in_arbeit', belegtBis: expect.any(Date) },
    ])
  })
})
