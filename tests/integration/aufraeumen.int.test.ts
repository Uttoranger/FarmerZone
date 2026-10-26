/**
 * Das tägliche Aufräumen gegen ein ECHTES Postgres (Register N18, Nr. 104) —
 * über den bestehenden Ablauf `api/cron/cleanup-reservations`; der Zustand
 * der Tabellen danach ist die Aussage.
 *
 * Beweist:
 *  - Mail-Warteschlange (Nr. 170): eine abgelaufene Belegung bleibt „in Arbeit“
 *    mit alter Belegung, der nächste Lauf schickt sie als eigene Anfrage mit
 *    dem Schlüssel ihres Laufs; ein Beitrag bekommt vor dem Löschen seiner
 *    Aufträge die gesendete Zahl.
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
import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { utcTag, utcTagVersetzt, utcTagesbeginn } from '@/lib/betrieb'
import { MELDE_VERMERK_TYP, meldeVermerk } from '@/server/erstattung-gescheitert'
import { gesendeteBeitragsMails } from '@/server/mail-arten/beitrag'
import { arbeiteWarteschlange, stapelSchluessel } from '@/server/mail-warteschlange'
import type { RendererTabelle } from '@/server/mail-arten'
import { erstelleHof, intKennung, raeumeAuf } from './setup/basis'

type StapelPayload = Array<{ to: string }>
const { batchMock } = vi.hoisted(() => ({ batchMock: vi.fn() }))

vi.mock('server-only', () => ({}))
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: vi.fn() }
    batch = { send: batchMock }
  },
}))
vi.mock('@/lib/nach-der-antwort', () => ({ nachDerAntwort: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn(), addBreadcrumb: vi.fn() }))

/** Adresse aus dem Bezug — die Attrappe zeigt, welche Mail hinausging (erfunden, example.com). */
const FAKE: RendererTabelle = {
  rundschreiben: async (b) => ({ an: `${b.unterhaltungId}@example.com`, betreff: 'Rundschreiben', html: '<p>rundschreiben</p>' }),
}

const TAG = 24 * 60 * 60 * 1000
type Lauf = Awaited<ReturnType<typeof prisma.ablaufLauf.findUnique>>
let laufVorher: Lauf = null
let zaehlerVorher: bigint | null = null
const heute = () => utcTagesbeginn(new Date())

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
  zaehlerVorher = (await prisma.betriebMessung.findUnique({ where: { tag_art: { tag: heute(), art: 'mails' } } }))?.wert ?? null
})

afterEach(async () => {
  vi.unstubAllEnvs()
  // Testhöfe (Nr. 170) zuerst — ihre Inhaber hängen am Hof.
  await raeumeAuf()
  await prisma.user.deleteMany({ where: { email: { startsWith: 'int-' } } })
  await prisma.verification.deleteMany({ where: { identifier: { startsWith: 'int-' } } })
  await prisma.webhookEvent.deleteMany({ where: { stripeEventId: { startsWith: 'int-' } } })
  await prisma.betriebMessung.deleteMany({ where: { art: { startsWith: 'int-' } } })
  await prisma.mailAuftrag.deleteMany({ where: { schluessel: { startsWith: 'int-' } } })
  // Der Worker im Test zählt in den heutigen Mail-Zähler — danach der Stand von vorher.
  if (zaehlerVorher === null) await prisma.betriebMessung.deleteMany({ where: { tag: heute(), art: 'mails' } })
  else await prisma.betriebMessung.update({ where: { tag_art: { tag: heute(), art: 'mails' } }, data: { wert: zaehlerVorher } })
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

  it('Mail-Warteschlange (N26, Nr. 158/170): nach 90 Tagen weg, mit 89 bleibt sie; eine abgelaufene Belegung bleibt „in Arbeit“ mit alter Belegung, und der nächste Lauf schickt sie als eigene Anfrage', async () => {
    const kennung = intKennung('mails')
    const alteBelegung = vor(60_000)
    const zeile = (was: string, erstelltAm: Date, teil: { status?: string; belegtBis?: Date; naechsterVersuchAm?: Date } = {}) => ({
      art: 'rundschreiben',
      vorrang: 2,
      schluessel: `${kennung}-${was}`,
      bezug: { unterhaltungId: `${kennung}-${was}` },
      erstelltAm,
      ...teil,
    })
    await prisma.mailAuftrag.createMany({
      data: [
        zeile('alt', vor(91 * TAG), { status: 'gesendet' }),
        zeile('jung', vor(89 * TAG), { status: 'gesendet' }),
        zeile('haengt', vor(TAG), { status: 'in_arbeit', belegtBis: alteBelegung }),
        zeile('laeuft', vor(TAG), { status: 'in_arbeit', belegtBis: new Date(Date.now() + 60_000) }),
        zeile('neu', vor(TAG), { status: 'offen', naechsterVersuchAm: vor(1_000) }),
      ],
    })
    const { aufgeraeumt } = await rufeAblauf()
    expect(aufgeraeumt).toMatchObject({ mailAuftraege: expect.any(Number) })
    expect(aufgeraeumt).not.toHaveProperty('mailAuftraegeFrei')
    const stand = await prisma.mailAuftrag.findMany({ where: { schluessel: { startsWith: kennung } }, select: { schluessel: true, status: true, belegtBis: true }, orderBy: { schluessel: 'asc' } })
    expect(stand).toEqual([
      { schluessel: `${kennung}-haengt`, status: 'in_arbeit', belegtBis: alteBelegung },
      { schluessel: `${kennung}-jung`, status: 'gesendet', belegtBis: null },
      { schluessel: `${kennung}-laeuft`, status: 'in_arbeit', belegtBis: expect.any(Date) },
      { schluessel: `${kennung}-neu`, status: 'offen', belegtBis: null },
    ])

    // Der nächste Lauf: der abgebrochene Auftrag geht allein, mit dem Schlüssel seines Laufs; der neue getrennt.
    batchMock.mockImplementation(async (payload: StapelPayload) => ({ data: { data: payload.map(() => ({ id: `int-re-${randomUUID()}` })) }, error: null, headers: null }))
    await arbeiteWarteschlange({ biszeitMs: 20_000, renderer: FAKE, grenze: { mailsTag: null, mailsMonat: null }, abstandMs: 0 })
    const haengt = await prisma.mailAuftrag.findUniqueOrThrow({ where: { schluessel: `${kennung}-haengt` }, select: { id: true, versuche: true, status: true } })
    const anfragen = batchMock.mock.calls.map(([payload, optionen]) => ({ an: (payload as StapelPayload).map((m) => m.to).sort(), schluessel: (optionen as { idempotencyKey: string }).idempotencyKey }))
    expect(anfragen).toContainEqual({ an: [`${kennung}-haengt@example.com`], schluessel: stapelSchluessel([{ id: haengt.id, versuche: 0 }]) })
    const neu = anfragen.find((x) => x.an.includes(`${kennung}-neu@example.com`))
    expect(neu?.an).not.toContain(`${kennung}-haengt@example.com`)
    expect(haengt.status).toBe('gesendet')
    // Der laufende Auftrag gehört einem anderen Worker und bleibt unberührt.
    expect(anfragen.flatMap((x) => x.an)).not.toContain(`${kennung}-laeuft@example.com`)
  })

  it('Beiträge (Nr. 170): vor dem Löschen bekommt der Beitrag die gesendete Zahl — „n per E-Mail“ bleibt danach 2 statt 3; Gegenprobe: ein junger Beitrag behält seine Zahl und seine Aufträge', async () => {
    const { farm } = await erstelleHof()
    const alt = await prisma.statusPost.create({ data: { farmId: farm.id, title: 'Alter Beitrag', body: 'Erfunden', publishedAt: vor(91 * TAG), sentViaEmail: true, emailRecipientCount: 3 } })
    const jung = await prisma.statusPost.create({ data: { farmId: farm.id, title: 'Junger Beitrag', body: 'Erfunden', publishedAt: vor(TAG), sentViaEmail: true, emailRecipientCount: 3 } })
    const auftrag = (post: string, abo: string, status: string, erstelltAm: Date) => ({
      art: 'beitrag',
      vorrang: 2,
      schluessel: `int-beitrag:${post}:${abo}`,
      bezug: { postId: post, aboId: abo },
      farmId: farm.id,
      status,
      erstelltAm,
    })
    await prisma.mailAuftrag.createMany({
      data: [
        auftrag(alt.id, 'a1', 'gesendet', vor(91 * TAG)),
        auftrag(alt.id, 'a2', 'gesendet', vor(91 * TAG)),
        auftrag(alt.id, 'a3', 'verworfen', vor(91 * TAG)),
        auftrag(jung.id, 'a1', 'gesendet', vor(TAG)),
        auftrag(jung.id, 'a2', 'offen', vor(TAG)),
        auftrag(jung.id, 'a3', 'offen', vor(TAG)),
      ],
    })
    await rufeAblauf()
    expect(await prisma.mailAuftrag.count({ where: { bezug: { path: ['postId'], equals: alt.id } } })).toBe(0)
    expect(await prisma.mailAuftrag.count({ where: { bezug: { path: ['postId'], equals: jung.id } } })).toBe(3)
    const nachher = await prisma.statusPost.findMany({ where: { id: { in: [alt.id, jung.id] } }, select: { id: true, publishedAt: true, createdAt: true, emailRecipientCount: true } })
    expect(Object.fromEntries(nachher.map((p) => [p.id, p.emailRecipientCount]))).toEqual({ [alt.id]: 2, [jung.id]: 3 })
    const anzeige = await gesendeteBeitragsMails(nachher)
    expect(anzeige.get(alt.id)).toBe(2)
    expect(anzeige.get(jung.id)).toBe(1)
  })
})
