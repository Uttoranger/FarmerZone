/**
 * Alle Mail-Wege auf die Warteschlange (Register N26, Nr. 159) gegen ein
 * echtes Postgres. Beweist (Zustand danach):
 *  - Beitrag an 1.000 Abos: Beitrag und 1.000 Aufträge „beitrag" (Kann warten)
 *    entstehen in EINER Transaktion; die Action wartet auf keine Mail — alle
 *    Aufträge stehen danach offen, der Worker lief nicht in der Anfrage.
 *    „n per E-Mail" zählt die gesendeten (gesendeteBeitragsMails), die
 *    7-Tage-Sperre greift, sobald der Beitrag Aufträge hat.
 *  - Rollback: Scheitert das Einstellen, gibt es auch den Beitrag nicht.
 *  - Bar-Bestätigung: Statuswechsel und beide Aufträge in einer Transaktion;
 *    ein zweiter Klick stellt nichts ein. Scheitert das Anlegen der Aufträge
 *    (Trigger, setup/mail-sperre.ts), gilt die Bestätigung trotzdem (Nr. 168).
 *  - Der Worker mit den echten Renderern: Er lädt Bestellung und Adressen
 *    frisch, die Post-Sperre (Z3) entscheidet je Adresse — die Testdomäne
 *    geht an die Attrappe, jede andere ist außerhalb der Produktion
 *    „gesperrt"; beide mit Fingerabdruck der Adresse, nie die Adresse selbst.
 * Resend ist eine Attrappe; nichts geht an eine echte Adresse.
 */
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((ziel: string) => {
    throw new Error(`REDIRECT:${ziel}`)
  }),
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn(), addBreadcrumb: vi.fn() }))
const { batchMock } = vi.hoisted(() => ({ batchMock: vi.fn() }))
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: vi.fn() }
    batch = { send: batchMock }
  },
}))
// Der Nachlauf wird gesammelt und NICHT abgearbeitet: So ist belegt, dass die Anfrage selbst nichts verschickt.
const nachlauf = vi.hoisted(() => ({ aufgaben: [] as (() => Promise<void>)[] }))
vi.mock('@/lib/nach-der-antwort', () => ({
  nachDerAntwort: (aufgabe: () => Promise<void>) => {
    nachlauf.aufgaben.push(aufgabe)
  },
}))
// Echt eingestellt; nur für den Rollback lässt sich ein Fehler einspeisen.
vi.mock('@/server/mail-warteschlange', async (original) => {
  const echt = await original<typeof import('@/server/mail-warteschlange')>()
  return { ...echt, stelleMailEin: vi.fn(echt.stelleMailEin) }
})

import { headers } from 'next/headers'
import { nanoid } from 'nanoid'
import { prisma } from '@/lib/prisma'
import { barTokenHash } from '@/lib/bar-bestaetigung'
import { empfaengerFingerabdruck } from '@/lib/mail-empfaenger'
import { utcTagesbeginn } from '@/lib/betrieb'
import { publishStatusPost } from '@/server/actions/status-posts'
import { bestaetigeBarBestellung } from '@/server/actions/bar-bestaetigung'
import { arbeiteWarteschlange, stelleMailEin } from '@/server/mail-warteschlange'
import { gesendeteBeitragsMails } from '@/server/mail-arten/beitrag'
import { auftraege, erstelleHof, erstelleHofMitAnmeldung, erstelleProdukt, intKennung, raeumeAuf } from './setup/basis'
import { gibMailAuftraegeFrei, sperreMailAuftraege } from './setup/mail-sperre'
import * as Sentry from '@sentry/nextjs'

afterEach(async () => {
  vi.mocked(headers).mockResolvedValue(new Headers() as never)
  nachlauf.aufgaben.length = 0
  vi.clearAllMocks()
  await raeumeAuf()
})

async function hofMitAbos(anzahl: number) {
  const { farm, cookie } = await erstelleHofMitAnmeldung()
  const kennung = intKennung('abo')
  await prisma.customerFarmSubscription.createMany({
    data: Array.from({ length: anzahl }, (_, i) => ({ customerEmail: `${kennung}-${i}@example.com`, farmId: farm.id, optInEmail: true })),
  })
  vi.mocked(headers).mockResolvedValue(new Headers({ cookie }) as never)
  return farm
}

const BEITRAG = { title: 'Frische Eier', body: 'Erfundener Text.', anlass: 'FRESH_PRODUCT' as const, showOnFarmPage: true, sendEmail: true }

describe('Beitrag an 1.000 Abos', () => {
  it('1.000 Aufträge in einer Transaktion mit dem Beitrag, alle offen — die Action wartet auf keine Mail; die Sperre greift', async () => {
    const farm = await hofMitAbos(1000)

    const antwort = await publishStatusPost(BEITRAG)

    expect(antwort).toMatchObject({ emailCount: 1000 })
    const post = await prisma.statusPost.findUniqueOrThrow({ where: { id: antwort.postId! } })
    expect(post).toMatchObject({ sentViaEmail: true, emailRecipientCount: 1000 })
    const zeilen = await prisma.mailAuftrag.findMany({ where: { art: 'beitrag', farmId: farm.id }, select: { vorrang: true, status: true, schluessel: true, bezug: true } })
    expect(zeilen).toHaveLength(1000)
    expect(new Set(zeilen.map((z) => z.vorrang))).toEqual(new Set([2]))
    // Kein Versand in der Anfrage: der Worker liegt im Nachlauf, alles offen.
    expect(new Set(zeilen.map((z) => z.status))).toEqual(new Set(['offen']))
    expect(nachlauf.aufgaben.length).toBeGreaterThan(0)
    expect(zeilen.every((z) => z.schluessel === `beitrag:${post.id}:${(z.bezug as { aboId: string }).aboId}`)).toBe(true)
    // Keine Adresse in der Warteschlange.
    expect(JSON.stringify(zeilen)).not.toContain('@example.com')

    // „n per E-Mail" zählt die gesendeten Aufträge — 0, bis der Worker sie verschickt hat.
    expect((await gesendeteBeitragsMails([post])).get(post.id)).toBe(0)
    const drei = zeilen.slice(0, 3).map((z) => z.schluessel)
    await prisma.mailAuftrag.updateMany({ where: { schluessel: { in: drei } }, data: { status: 'gesendet', gesendetAm: new Date() } })
    expect((await gesendeteBeitragsMails([post])).get(post.id)).toBe(3)

    // Die 7-Tage-Sperre zählt den Beitrag, sobald er Aufträge hat.
    expect(await publishStatusPost(BEITRAG)).toMatchObject({ emailCount: 0 })
    expect(await prisma.mailAuftrag.count({ where: { art: 'beitrag', farmId: farm.id } })).toBe(1000)
  }, 60_000)

  it('scheitert das Einstellen, gibt es auch keinen Beitrag (Rollback) — und keinen Auftrag', async () => {
    const farm = await hofMitAbos(3)
    vi.mocked(stelleMailEin).mockRejectedValueOnce(new Error('Warteschlange weg'))

    const antwort = await publishStatusPost(BEITRAG)

    expect(antwort.error).toBeDefined()
    expect(await prisma.statusPost.count({ where: { farmId: farm.id } })).toBe(0)
    expect(await prisma.mailAuftrag.count({ where: { farmId: farm.id } })).toBe(0)
  })
})

async function offeneBarBestellung(kundinDomain = 'example.com') {
  const { farm } = await erstelleHof()
  const produkt = await erstelleProdukt(farm.id, { stock: 5 })
  const token = nanoid(32)
  const bestellung = await prisma.order.create({
    data: {
      orderNumber: intKennung('bestellung').toUpperCase(),
      farmId: farm.id,
      customerEmail: `${intKennung('kundin')}@${kundinDomain}`,
      customerName: 'Erika Mustermann',
      customerPhone: '+43 660 0000000',
      status: 'PENDING_CONFIRMATION',
      totalAmount: 10,
      pickupDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
      pickupTimeStart: '15:00',
      pickupTimeEnd: '18:00',
      paymentMethod: 'ONSITE_CASH',
      paymentStatus: 'PENDING',
      confirmationToken: barTokenHash(token),
      items: { create: [{ productId: produkt.id, productName: 'Testprodukt', unitPrice: 10, quantity: 1, totalPrice: 10, vatRate: 10 }] },
    },
  })
  return { farm, bestellung, token }
}

function formular(token: string): FormData {
  const daten = new FormData()
  daten.set('token', token)
  return daten
}

describe('Bar-Bestätigung', () => {
  beforeAll(async () => {
    await gibMailAuftraegeFrei()
  })

  it('bestätigt und stellt beide Aufträge in derselben Transaktion ein; der zweite Klick stellt nichts ein', async () => {
    const { farm, bestellung, token } = await offeneBarBestellung()

    await expect(bestaetigeBarBestellung({}, formular(token))).rejects.toThrow('REDIRECT')
    // Der zweite Klick findet den Token nicht mehr (er verfällt beim Bestätigen).
    expect(await bestaetigeBarBestellung({}, formular(token))).toHaveProperty('error')

    expect((await prisma.order.findUniqueOrThrow({ where: { id: bestellung.id } })).status).toBe('CONFIRMED')
    expect(await auftraege({ bestellungId: bestellung.id })).toEqual([
      { art: 'bar-bestaetigt-hof', vorrang: 1, schluessel: `bar-bestaetigt-hof:${bestellung.id}`, bestellungId: bestellung.id, farmId: farm.id, bezug: { orderId: bestellung.id } },
      { art: 'bestellung-bestaetigung', vorrang: 1, schluessel: `bestellung-bestaetigung:${bestellung.id}`, bestellungId: bestellung.id, farmId: farm.id, bezug: { orderId: bestellung.id } },
    ].sort((a, b) => a.schluessel.localeCompare(b.schluessel)))
  })

  it('scheitert das Anlegen der Aufträge (Trigger): die Bestätigung gilt, der Token ist verbraucht, kein Auftrag, Sentry (Nr. 168)', async () => {
    const { bestellung, token } = await offeneBarBestellung()
    vi.mocked(Sentry.captureException).mockClear()
    try {
      await sperreMailAuftraege('immer')
      await expect(bestaetigeBarBestellung({}, formular(token))).rejects.toThrow('REDIRECT')
    } finally {
      await gibMailAuftraegeFrei()
    }

    expect(await prisma.order.findUniqueOrThrow({ where: { id: bestellung.id } })).toMatchObject({ status: 'CONFIRMED', confirmationToken: null })
    expect(await auftraege({ bestellungId: bestellung.id })).toEqual([])
    const gruende = vi.mocked(Sentry.captureException).mock.calls.map(([, k]) => (k as { tags?: Record<string, string> }).tags?.grund)
    expect(gruende).toEqual(['in_transaktion_gescheitert', 'einstellen_gescheitert'])
  })
})

describe('Worker mit den echten Renderern', () => {
  it('lädt Bestellung und Adressen frisch; die Post-Sperre entscheidet je Adresse — mit Fingerabdruck, ohne Adresse', async () => {
    // Die Kundin außerhalb der Testdomäne (gesperrt), der Hof in ihr (geht an die Attrappe).
    const { farm, bestellung, token } = await offeneBarBestellung('example.org')
    await expect(bestaetigeBarBestellung({}, formular(token))).rejects.toThrow('REDIRECT')
    batchMock.mockImplementation(async (mails: unknown[]) => ({ data: { data: mails.map((_, i) => ({ id: `${intKennung('re')}-${i}` })) }, error: null, headers: null }))

    // Der Worker zählt angenommene Mails für Admin › Betrieb — die geteilte Zeile danach zurücksetzen.
    const tag = { tag_art: { tag: utcTagesbeginn(new Date()), art: 'mails' } }
    const zaehlerVorher = (await prisma.betriebMessung.findUnique({ where: tag }))?.wert ?? null
    try {
      const lauf = await arbeiteWarteschlange({ biszeitMs: 20_000, grenze: { mailsTag: null, mailsMonat: null }, abstandMs: 0 })
      expect(lauf).toMatchObject({ gelaufen: true })
    } finally {
      if (zaehlerVorher === null) await prisma.betriebMessung.deleteMany({ where: tag.tag_art })
      else await prisma.betriebMessung.update({ where: tag, data: { wert: zaehlerVorher } })
    }

    const zeilen = await prisma.mailAuftrag.findMany({ where: { bestellungId: bestellung.id }, orderBy: { art: 'asc' } })
    expect(zeilen.map((z) => [z.art, z.status])).toEqual([
      ['bar-bestaetigt-hof', 'gesendet'],
      ['bestellung-bestaetigung', 'gesperrt'],
    ])
    // An den Hof ging die Mail mit der Vorlage aus email.ts, frisch aus der Bestellung gebaut.
    const anDenHof = (batchMock.mock.calls.flatMap(([mails]) => mails as Array<{ to: string; subject: string }>)).find((m) => m.to === farm.email)
    expect(anDenHof?.subject).toContain(bestellung.orderNumber)
    const [hof, kundin] = zeilen
    expect(hof?.empfaengerHash).toBe(empfaengerFingerabdruck(farm.email))
    expect(hof?.resendId).toBeTruthy()
    expect(kundin?.empfaengerHash).toBe(empfaengerFingerabdruck(bestellung.customerEmail))
    expect(JSON.stringify(zeilen)).not.toContain(bestellung.customerEmail)
    expect(JSON.stringify(zeilen)).not.toContain(farm.email)
  }, 60_000)
})
