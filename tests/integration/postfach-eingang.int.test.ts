/**
 * Postfach, Stufe 2 (Register N12-Änderung, N14; Nachtlauf Nr. 95) gegen ein
 * echtes Postgres — mit echter Anmeldung über Better Auth.
 *
 * Beweist (Zustand danach):
 *  - Der Eingang mischt die drei Arten an echten Zeilen: ungelesene Antwort,
 *    Meldung NEU, wartender Hof, Bestellung mit offener Erstattung — neueste
 *    zuerst; „Offen" im Eingang und die Zahl am Reiter (zaehleOffenImEingang,
 *    SQL-Zählungen) sagen dasselbe.
 *  - „Antwort möglich" aus: Der Hof kann nicht antworten, es entsteht keine
 *    Nachricht (WHERE-Klausel); Gegenprobe mit „an" und ein Faden ohne
 *    Rundschreiben (Gründungs-Nachricht) bleiben beantwortbar.
 *  - Double-Opt-in: Eine unbestätigte Adresse bekommt keine Mail mit Hofnamen;
 *    nach dem Einlösen des Links schon. Der Link gilt einmal, ein abgelaufener
 *    gar nicht; gespeichert ist nur sein Hash.
 *  - „Erstattung offen" geht trotz Regel „aus" an die Liste (Webhook
 *    refund.failed), setzt Order.erstattungOffenSeit; eine später gemeldete
 *    erfolgreiche Erstattung löscht ihn wieder. Eine Fehlermeldung bekäme bei
 *    „aus" niemand.
 *  - Die Migration läuft ein zweites Mal ohne Fehler.
 * Mails gemockt (Prüfstellen), Stripe gemockt, der Nachlauf gesammelt und
 * selbst abgearbeitet (TESTING_GUIDELINES §3).
 */
import { describe, it, expect, vi, afterEach, beforeAll, afterAll } from 'vitest'

// Der echte Teil von email.ts (Renderer, Worker) bindet 'server-only'.
vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

const nachlauf = vi.hoisted(() => ({ aufgaben: [] as (() => Promise<void>)[] }))
vi.mock('@/lib/nach-der-antwort', () => ({
  nachDerAntwort: (aufgabe: () => Promise<void>) => {
    nachlauf.aufgaben.push(aufgabe)
  },
}))
// Die Bestätigung einer weiteren Adresse geht direkt (Sofort, Bestätigungslink);
// alle anderen Betreiber-Mails sind seit Nr. 159 je Adresse ein Auftrag der Warteschlange.
vi.mock('@/lib/email', async (original) => ({
  ...(await original<typeof import('@/lib/email')>()),
  sendBetreiberBestaetigung: vi.fn(async () => ({ id: 'int-mail' })),
}))
vi.mock('@/lib/stripe', async () => {
  // Die echten Webhook-Helfer des SDK — Signatur prüfen und im Test erzeugen —, aber keine Buchung.
  const { default: Stripe } = await import('stripe')
  const echt = new Stripe('sk_test_integration_dummy')
  return {
    stripe: {
      webhooks: echt.webhooks,
      paymentIntents: { retrieve: vi.fn() },
      refunds: { create: vi.fn(), list: vi.fn(async () => ({ data: [], has_more: false })) },
      transfers: { createReversal: vi.fn(), listReversals: vi.fn(async () => ({ data: [], has_more: false })) },
    },
  }
})

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { sendBetreiberBestaetigung } from '@/lib/email'
import { POSTFACH_FEHLER, eingangEintraege, offenImGespraech } from '@/lib/postfach'
import { SUPPORT_EMAIL } from '@/lib/support'
import { PLATTFORM_EINSTELLUNG_ID } from '@/lib/plattform-einstellung'
import { POST as webhook } from '@/app/api/stripe/webhook/route'
import { antworteAlsHof, fuegeEmpfaengerHinzu, sendeRundschreiben, speichereZustellRegeln } from '@/server/actions/postfach'
import { bestaetigeEmpfaenger } from '@/server/zustellung-bestaetigen'
import { empfaengerTokenHash, ladeBetreiberEmpfaenger, ladeEingang, ladeErstattungAufgaben, ladeHofAufgaben, zaehleOffenImEingang } from '@/server/queries/postfach'
import { INTEGRATIONS_ENV } from './setup/integrations-umgebung'
import { auftraege, erstelleHof, erstelleHofMitAnmeldung, intKennung, raeumeAuf, machePasskeyAdmin } from './setup/basis'

const MIGRATION = readFileSync(join(process.cwd(), 'prisma', 'migrations', '20261015130000_postfach_stufe2', 'migration.sql'), 'utf8')
const SUPPORT = SUPPORT_EMAIL.toLowerCase()

/** Die Regeln der einen Einstellungszeile vor dem Lauf — danach wieder hergestellt (die Zeile ist geteilt). */
let regelnVorher: Prisma.JsonValue | null = null
const meldungIds: string[] = []

beforeAll(async () => {
  regelnVorher = (await prisma.plattformEinstellung.findUnique({ where: { id: PLATTFORM_EINSTELLUNG_ID }, select: { zustellRegeln: true } }))?.zustellRegeln ?? null
})

afterAll(async () => {
  await prisma.plattformEinstellung.updateMany({ where: { id: PLATTFORM_EINSTELLUNG_ID }, data: { zustellRegeln: regelnVorher ?? Prisma.DbNull } })
})

afterEach(async () => {
  vi.mocked(headers).mockResolvedValue(new Headers() as never)
  vi.clearAllMocks()
  nachlauf.aufgaben.length = 0
  await prisma.plattformEinstellung.updateMany({ where: { id: PLATTFORM_EINSTELLUNG_ID }, data: { zustellRegeln: regelnVorher ?? Prisma.DbNull } })
  await prisma.betreiberEmpfaenger.deleteMany({ where: { email: { startsWith: 'int-' } } })
  await prisma.meldung.deleteMany({ where: { id: { in: meldungIds.splice(0) } } })
  await prisma.rundschreiben.deleteMany({ where: { titel: { startsWith: 'int-' } } })
  await raeumeAuf()
})

async function alsSitzung(cookie: string): Promise<void> {
  vi.mocked(headers).mockResolvedValue(new Headers({ cookie }) as never)
}

async function erstelleAdmin(): Promise<{ cookie: string }> {
  const { ownerId, cookie } = await erstelleHofMitAnmeldung()
  await machePasskeyAdmin(ownerId)
  return { cookie }
}

/** Die Adressen hinter den Aufträgen (Kennung `support` = die feste Adresse), sortiert. */
async function adressenDer(zeilen: Array<{ bezug: unknown }>): Promise<string[]> {
  const adressen: string[] = []
  for (const { bezug } of zeilen) {
    const kennung = (bezug as { empfaengerId: string }).empfaengerId
    adressen.push(kennung === 'support' ? SUPPORT : (await prisma.betreiberEmpfaenger.findUniqueOrThrow({ where: { id: kennung } })).email)
  }
  return adressen.sort()
}

/** An wen die Mail „Ein Hof hat geantwortet" zu einer Nachricht dieses Fadens geht. */
async function empfaengerDerAntwort(unterhaltungId: string): Promise<string[]> {
  const nachrichten = await prisma.nachricht.findMany({ where: { unterhaltungId }, select: { id: true } })
  return adressenDer(await auftraege({ art: 'antwort-an-team', OR: nachrichten.map((n) => ({ bezug: { path: ['nachrichtId'], equals: n.id } })) }))
}

async function arbeiteNachlaufAb(): Promise<void> {
  for (const aufgabe of nachlauf.aufgaben.splice(0)) await aufgabe()
}

/** Ein Rundschreiben an genau diesen Hof; gibt die Kennung seines Fadens zurück. */
async function rundschreibenAn(adminCookie: string, farmId: string, antwortMoeglich: boolean): Promise<string> {
  await alsSitzung(adminCookie)
  const ergebnis = await sendeRundschreiben({
    titel: `int-Rundschreiben ${antwortMoeglich ? 'mit' : 'ohne'} Antwort`,
    text: 'Erfundener Text für die Integrationsschicht.',
    art: antwortMoeglich ? 'WICHTIG' : 'INFO',
    link: '',
    perMail: false,
    antwortMoeglich,
    empfaenger: { art: 'ausgewaehlt', hofIds: [farmId] },
  })
  expect(ergebnis).toMatchObject({ ok: true })
  const faden = await prisma.unterhaltung.findFirstOrThrow({ where: { farmId, rundschreiben: { antwortMoeglich } }, select: { id: true } })
  return faden.id
}

async function bestellungMitOffenerErstattung(farmId: string, seit: Date | null): Promise<{ id: string; paymentIntentId: string }> {
  const paymentIntentId = intKennung('pi')
  const order = await prisma.order.create({
    data: {
      orderNumber: intKennung('bestellung').toUpperCase(),
      farmId,
      customerEmail: `${intKennung('kundin')}@example.com`,
      customerName: 'Erika Beispiel',
      customerPhone: '+43 660 0000000',
      status: 'CANCELLED',
      totalAmount: new Prisma.Decimal(2000).div(100),
      pickupDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      pickupTimeStart: '15:00',
      pickupTimeEnd: '18:00',
      paymentMethod: 'ONLINE',
      paymentStatus: 'PAID',
      stripePaymentIntentId: paymentIntentId,
      serviceFeeCents: 100,
      erstattungOffenSeit: seit,
    },
    select: { id: true },
  })
  return { id: order.id, paymentIntentId }
}

describe('Eingang', () => {
  it('mischt die drei Arten an echten Zeilen, neueste zuerst; „Offen" und der Zähler am Reiter sagen dasselbe', async () => {
    const { cookie: adminCookie } = await erstelleAdmin()
    const { farm: antwortHof, cookie: hofCookie } = await erstelleHofMitAnmeldung()
    const { farm: wartend } = await erstelleHof({ approvedAt: null, createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000) })
    const { farm: bestellHof } = await erstelleHof()
    const erstattung = await bestellungMitOffenerErstattung(bestellHof.id, new Date(Date.now() - 3 * 60 * 60 * 1000))
    const meldung = await prisma.meldung.create({
      data: { art: 'FEHLER', text: 'int- Erfundene Meldung', seiteUrl: '/dashboard', userAgent: 'Test', viewport: '390x844', createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) },
    })
    meldungIds.push(meldung.id)
    const faden = await rundschreibenAn(adminCookie, antwortHof.id, true)
    await alsSitzung(hofCookie)
    expect(await antworteAlsHof({ unterhaltungId: faden, text: 'Erfundene Antwort.' })).toEqual({ ok: true })

    // Seit Nr. 193 (N32) nur Gespräche: der wartende Hof und die offene Erstattung stehen in Heute, nicht im Eingang.
    const offen = eingangEintraege(await ladeEingang('offen'), 'offen')
    const meine = offen.filter((e) => [faden, meldung.id, wartend.id, erstattung.id].includes(e.auswahl.id)).map((e) => `${e.auswahl.art}-${e.auswahl.id}`)
    expect(meine).toEqual([`antwort-${faden}`, `meldung-${meldung.id}`])
    const alle = eingangEintraege(await ladeEingang('alle'), 'alle').map((e) => e.auswahl.id)
    expect(alle).not.toContain(wartend.id)
    expect(alle).not.toContain(erstattung.id)
    // Gegenprobe: Heute liest sie weiter aus denselben Abfragen.
    expect((await ladeHofAufgaben(new Date())).map((h) => h.id)).toContain(wartend.id)
    expect((await ladeErstattungAufgaben()).map((e) => e.id)).toContain(erstattung.id)

    // Eine Zählung für Reiter und Eingang: die SQL-Zählungen der Gespräche gleich der Liste „Offen".
    expect(offenImGespraech(await zaehleOffenImEingang())).toBe(offen.length)
  })
})

describe('Antwort möglich', () => {
  it('aus: keine Nachricht, der Satz mit „Problem melden"; an: die Antwort steht', async () => {
    const { cookie: adminCookie } = await erstelleAdmin()
    const { farm, cookie: hofCookie } = await erstelleHofMitAnmeldung()
    const ohne = await rundschreibenAn(adminCookie, farm.id, false)
    const mit = await rundschreibenAn(adminCookie, farm.id, true)

    await alsSitzung(hofCookie)
    expect(await antworteAlsHof({ unterhaltungId: ohne, text: 'Darf nicht ankommen.' })).toEqual({ error: POSTFACH_FEHLER.antwortNichtMoeglich })
    expect(await prisma.nachricht.count({ where: { unterhaltungId: ohne, vonFarmId: farm.id } })).toBe(0)

    expect(await antworteAlsHof({ unterhaltungId: mit, text: 'Kommt an.' })).toEqual({ ok: true })
    expect(await prisma.nachricht.count({ where: { unterhaltungId: mit, vonFarmId: farm.id } })).toBe(1)
  })

  it('ein Faden ohne Rundschreiben (Gründungs-Nachricht) bleibt beantwortbar; ein fremder Hof bekommt „nicht gefunden"', async () => {
    const { farm, cookie: hofCookie } = await erstelleHofMitAnmeldung()
    const { cookie: fremdCookie } = await erstelleHofMitAnmeldung()
    const faden = await prisma.unterhaltung.create({ data: { farmId: farm.id, letzteNachrichtAm: new Date() }, select: { id: true } })
    await prisma.nachricht.create({ data: { unterhaltungId: faden.id, vonFarmId: null, text: 'Erfundene Nachricht vom Team.' } })

    await alsSitzung(fremdCookie)
    expect(await antworteAlsHof({ unterhaltungId: faden.id, text: 'Fremd.' })).toEqual({ error: POSTFACH_FEHLER.nichtGefunden })
    await alsSitzung(hofCookie)
    expect(await antworteAlsHof({ unterhaltungId: faden.id, text: 'Danke!' })).toEqual({ ok: true })
  })
})

describe('Zustellung: Double-Opt-in', () => {
  it('eine unbestätigte Adresse bekommt keine Mail; nach dem Link schon; der Link gilt einmal, gespeichert ist nur sein Hash', async () => {
    const { cookie: adminCookie } = await erstelleAdmin()
    const { farm, cookie: hofCookie } = await erstelleHofMitAnmeldung()
    const faden = await rundschreibenAn(adminCookie, farm.id, true)

    await alsSitzung(adminCookie)
    expect(await fuegeEmpfaengerHinzu({ email: ' INT-Team@Example.com ' })).toEqual({ ok: true, email: 'int-team@example.com' })
    await arbeiteNachlaufAb()
    expect(sendBetreiberBestaetigung).toHaveBeenCalledTimes(1)
    const [an, token] = vi.mocked(sendBetreiberBestaetigung).mock.calls[0]!
    expect(an).toBe('int-team@example.com')
    const zeile = await prisma.betreiberEmpfaenger.findUniqueOrThrow({ where: { email: 'int-team@example.com' } })
    expect(zeile.bestaetigtAm).toBeNull()
    expect(zeile.token).toBe(empfaengerTokenHash(token))
    expect(zeile.token).not.toBe(token)

    // Unbestätigt: Die Antwort des Hofs geht nur an die feste Adresse.
    await alsSitzung(hofCookie)
    await antworteAlsHof({ unterhaltungId: faden, text: 'Erste Antwort.' })
    await arbeiteNachlaufAb()
    expect(await empfaengerDerAntwort(faden)).toEqual([SUPPORT])

    // Einlösen — einmal.
    expect(await bestaetigeEmpfaenger(token)).toEqual({ ok: true })
    expect(await bestaetigeEmpfaenger(token)).toEqual({ error: 'ungueltig' })
    const bestaetigt = await prisma.betreiberEmpfaenger.findUniqueOrThrow({ where: { email: 'int-team@example.com' } })
    expect(bestaetigt.bestaetigtAm).not.toBeNull()
    expect(bestaetigt.token).toBeNull()

    // Die Mail geht höchstens einmal je Faden und voller Stunde (Drossel, Nr. 105) —
    // die zweite Antwort deshalb in einem zweiten Faden.
    const zweiterFaden = await prisma.unterhaltung.create({ data: { farmId: farm.id, letzteNachrichtAm: new Date() }, select: { id: true } })
    await alsSitzung(hofCookie)
    await antworteAlsHof({ unterhaltungId: zweiterFaden.id, text: 'Zweite Antwort.' })
    await arbeiteNachlaufAb()
    expect(await empfaengerDerAntwort(zweiterFaden.id)).toEqual([SUPPORT, 'int-team@example.com'].sort())

    // Eine bestätigte Adresse ein zweites Mal: kein neuer Link.
    await alsSitzung(adminCookie)
    expect(await fuegeEmpfaengerHinzu({ email: 'int-team@example.com' })).toMatchObject({ error: expect.any(String) })
    expect(await fuegeEmpfaengerHinzu({ email: SUPPORT })).toMatchObject({ error: expect.any(String) })
  })

  it('ein abgelaufener Link bestätigt nichts', async () => {
    const { cookie: adminCookie } = await erstelleAdmin()
    await alsSitzung(adminCookie)
    await fuegeEmpfaengerHinzu({ email: 'int-alt@example.com' })
    await arbeiteNachlaufAb()
    const [, token] = vi.mocked(sendBetreiberBestaetigung).mock.calls[0]!
    await prisma.betreiberEmpfaenger.updateMany({ where: { email: 'int-alt@example.com' }, data: { tokenBis: new Date(Date.now() - 1000) } })

    expect(await bestaetigeEmpfaenger(token)).toEqual({ error: 'abgelaufen' })
    expect((await prisma.betreiberEmpfaenger.findUniqueOrThrow({ where: { email: 'int-alt@example.com' } })).bestaetigtAm).toBeNull()
  })

  it('ohne Admin-Recht: keine Adresse, keine Regel', async () => {
    const { cookie: hofCookie } = await erstelleHofMitAnmeldung()
    await alsSitzung(hofCookie)
    expect(await fuegeEmpfaengerHinzu({ email: 'int-fremd@example.com' })).toMatchObject({ error: expect.any(String) })
    expect(await speichereZustellRegeln({ fehlermeldung: false, hofWartet: false, antwortHof: false, wochenbericht: false })).toMatchObject({ error: expect.any(String) })
    expect(await prisma.betreiberEmpfaenger.count({ where: { email: 'int-fremd@example.com' } })).toBe(0)
  })
})

/** Signiert wie Stripe und ruft den Handler direkt — kein HTTP-Server. */
async function zustellen(typ: 'refund.failed' | 'charge.refund.updated', refund: Record<string, unknown>) {
  const koerper = JSON.stringify({ id: intKennung('evt'), object: 'event', type: typ, data: { object: { object: 'refund', ...refund } } })
  const signatur = stripe.webhooks.generateTestHeaderString({ payload: koerper, secret: INTEGRATIONS_ENV.STRIPE_WEBHOOK_SECRET })
  return webhook(
    new NextRequest('http://localhost:3000/api/stripe/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': signatur, 'content-type': 'application/json' },
      body: koerper,
    })
  )
}

describe('Zustellung: Erstattung offen', () => {
  it('geht trotz Regel „aus" an die Liste und setzt erstattungOffenSeit; eine spätere erfolgreiche Erstattung löscht ihn', async () => {
    const { cookie: adminCookie } = await erstelleAdmin()
    await alsSitzung(adminCookie)
    expect(await speichereZustellRegeln({ fehlermeldung: false, hofWartet: false, antwortHof: false, wochenbericht: false })).toEqual({ ok: true })
    await prisma.betreiberEmpfaenger.create({ data: { email: 'int-bestaetigt@example.com', bestaetigtAm: new Date(), erstelltVonUserId: 'int-admin' } })
    await prisma.betreiberEmpfaenger.create({ data: { email: 'int-offen@example.com', erstelltVonUserId: 'int-admin', tokenBis: new Date(Date.now() + 60_000) } })

    // Bei „aus" bekäme eine Fehlermeldung niemand — die Erstattung schon.
    expect(await ladeBetreiberEmpfaenger('fehlermeldung')).toEqual([])

    const { farm } = await erstelleHof()
    const bestellung = await bestellungMitOffenerErstattung(farm.id, null)
    const gescheitert = { id: intKennung('re'), amount: 2100, status: 'failed', failure_reason: 'expired_or_canceled_card', payment_intent: bestellung.paymentIntentId, metadata: {}, created: Math.floor(Date.now() / 1000) }
    expect((await zustellen('refund.failed', gescheitert)).status).toBe(200)

    const nachher = await prisma.order.findUniqueOrThrow({ where: { id: bestellung.id }, select: { erstattungOffenSeit: true } })
    expect(nachher.erstattungOffenSeit).not.toBeNull()
    // Die Aufträge entstehen nach der Antwort an Stripe (gesammelter Nachlauf), je bestätigter Adresse einer.
    expect(await auftraege({ art: 'erstattung-offen', bestellungId: bestellung.id })).toEqual([])
    await arbeiteNachlaufAb()
    expect(await adressenDer(await auftraege({ art: 'erstattung-offen', bestellungId: bestellung.id }))).toEqual([SUPPORT, 'int-bestaetigt@example.com'].sort())
    // Die Aufgabe steht seit Nr. 193 in Heute (dieselbe Abfrage), nicht mehr im Eingang.
    expect((await ladeErstattungAufgaben()).map((e) => e.id)).toContain(bestellung.id)

    // Eine ältere erfolgreiche Erstattung derselben Zahlung erledigt nichts …
    const alt = { id: intKennung('re-alt'), amount: 100, status: 'succeeded', payment_intent: bestellung.paymentIntentId, metadata: {}, created: Math.floor(Date.now() / 1000) - 3600 }
    await zustellen('charge.refund.updated', alt)
    expect((await prisma.order.findUniqueOrThrow({ where: { id: bestellung.id } })).erstattungOffenSeit).not.toBeNull()
    // … die von Hand nachgeholte schon.
    const vonHand = { id: intKennung('re-hand'), amount: 2100, status: 'succeeded', payment_intent: bestellung.paymentIntentId, metadata: {}, created: Math.floor(Date.now() / 1000) + 5 }
    await zustellen('charge.refund.updated', vonHand)
    expect((await prisma.order.findUniqueOrThrow({ where: { id: bestellung.id } })).erstattungOffenSeit).toBeNull()
  })
})

describe('Migration', () => {
  it('läuft ein zweites Mal ohne Fehler und ohne Änderung (IF NOT EXISTS)', async () => {
    await prisma.betreiberEmpfaenger.create({ data: { email: 'int-bleibt@example.com', erstelltVonUserId: 'int-admin' } })
    // Kommentare weg, dann je Anweisung (wie tests/integration/postfach.int.test.ts).
    for (const treffer of MIGRATION.replace(/--.*$/gm, '').matchAll(/[^;]+;/g)) {
      const anweisung = treffer[0].trim().replace(/;$/, '')
      if (anweisung) await prisma.$executeRawUnsafe(anweisung)
    }
    expect(await prisma.betreiberEmpfaenger.count({ where: { email: 'int-bleibt@example.com' } })).toBe(1)
  })
})
