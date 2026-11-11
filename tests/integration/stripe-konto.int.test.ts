/**
 * Integrationstest — der Stripe-Kontostand eines Hofs (Register N49, A012).
 *
 * Vorher setzte nur das Onboarding `stripeAccountReady`; seit Nr. 42 hält
 * `account.updated` den Wert aktuell. Seit A012 gilt ein Hof erst mit aktiver
 * EPS-Fähigkeit als bereit, der grobe Stand und der Lesezeitpunkt stehen in
 * zwei Spalten, und genau EIN Schreiber (`schreibeStripeKontoStand`) schreibt
 * bedingt: Wer früher gelesen hat, überschreibt nie, wer später gelesen hat.
 * Jeder Wechsel des Bereit-Werts steht im Protokoll; „aktiv“ (und bei W-A
 * „Stripe braucht noch Angaben“) bekommt der Hof als Nachricht und Mail.
 *
 * Connect-Events kommen über einen eigenen Endpunkt mit eigenem Secret an
 * dieselbe Route; sie prüft gegen beide. Echt sind Datenbank und
 * Signaturprüfung, signiert wird mit den Platzhalter-Secrets der
 * Integrationsschicht. Stripe selbst ist gemockt (accounts.retrieve).
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
vi.mock('@/lib/stripe', async () => {
  const { default: Stripe } = await import('stripe')
  const echt = new Stripe('sk_test_integration_dummy')
  return { stripe: { webhooks: echt.webhooks, refunds: { create: vi.fn() }, accounts: { retrieve: vi.fn() } } }
})
vi.mock('@/lib/email', () => ({
  sendOrderConfirmation: vi.fn(),
  sendOrderPaidToFarmer: vi.fn(),
  sendZahlungZuSpaet: vi.fn(),
}))
// Kein Worker im Test: Die Aufträge bleiben stehen und werden gezählt.
vi.mock('@/lib/nach-der-antwort', () => ({ nachDerAntwort: vi.fn() }))

import { NextRequest } from 'next/server'
import { POST } from '@/app/api/stripe/webhook/route'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { stripe } from '@/lib/stripe'
import { DB_BREMSEN, bremsSchluessel } from '@/lib/bremse-datenbank'
import { ANGABEN_NACHRICHT, stripeAnzeige, type StripeKontoDaten } from '@/lib/stripe-konto'
import { schreibeStripeKontoStand } from '@/server/stripe-konto-stand'
import { vermerkeUnbekanntesHofKonto } from '@/server/hofkonto-unbekannt'
import { ladeAufgabenStand } from '@/server/queries/admin-heute'
import { ADMIN_AUFGABEN } from '@/lib/admin-aufgaben'
import { INTEGRATIONS_ENV } from './setup/integrations-umgebung'
import { erstelleHof, intKennung, raeumeAuf } from './setup/basis'

type Faehigkeit = 'active' | 'inactive' | 'pending'
type Konto = StripeKontoDaten & { id: string }

/** Ein vollständiges Konto, wie Stripe es liefert — erfundene Werte. */
function konto(
  id: string,
  teil: {
    charges_enabled?: boolean
    payouts_enabled?: boolean
    details_submitted?: boolean
    eps?: Faehigkeit | null
    karte?: Faehigkeit
    currently_due?: string[]
    pending_verification?: string[]
    disabled_reason?: string | null
  } = {}
): Konto {
  const eps = teil.eps === undefined ? 'active' : teil.eps
  return {
    id,
    charges_enabled: teil.charges_enabled ?? true,
    payouts_enabled: teil.payouts_enabled ?? true,
    details_submitted: teil.details_submitted ?? true,
    capabilities: { card_payments: teil.karte ?? 'active', transfers: 'active', ...(eps === null ? {} : { eps_payments: eps }) },
    requirements: {
      disabled_reason: teil.disabled_reason ?? null,
      currently_due: teil.currently_due ?? [],
      past_due: [],
      pending_verification: teil.pending_verification ?? [],
    },
  }
}
const BEREIT = {}
const EPS_INAKTIV = { eps: 'inactive' as const }
const PRUEFUNG = { charges_enabled: false, pending_verification: ['individual.verification.document'] }
const ANGABEN = { payouts_enabled: false, currently_due: ['external_account'] }

/** Was Stripe auf `accounts.retrieve` antwortet — der aktuelle Stand je Konto. */
const kontoStand = new Map<string, Konto>()
/** Höfe dieser Datei — für Protokoll und Bremse, die nicht am Hof hängen. */
const hoefe: string[] = []

beforeEach(() => {
  vi.clearAllMocks()
  kontoStand.clear()
  vi.mocked(stripe.accounts.retrieve).mockImplementation((async (id: string) => kontoStand.get(id)) as never)
})

afterEach(async () => {
  vi.restoreAllMocks()
  const ids = hoefe.splice(0)
  await prisma.adminAktion.deleteMany({ where: { bezugArt: 'hof', bezugId: { in: ids } } })
  await prisma.rateLimitZaehler.deleteMany({
    where: {
      schluessel: {
        in: ids.flatMap((id) =>
          ['aktiv', 'angaben'].map((anlass) => bremsSchluessel(env.BETTER_AUTH_SECRET, DB_BREMSEN.stripeKontoNachricht.zweck, `${anlass}:${id}`))
        ),
      },
    },
  })
  await raeumeAuf()
})

/** Ein account.updated — und (Normalfall) derselbe Stand bei Stripe. */
function kontoEreignis(k: Konto) {
  kontoStand.set(k.id, k)
  return { id: intKennung('evt'), object: 'event', type: 'account.updated', account: k.id, data: { object: { ...k, object: 'account' } } }
}

async function zustellen(ev: object, secret: string = CONNECT) {
  const koerper = JSON.stringify(ev)
  const signatur = stripe.webhooks.generateTestHeaderString({ payload: koerper, secret })
  return POST(
    new NextRequest('http://localhost:3000/api/stripe/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': signatur, 'content-type': 'application/json' },
      body: koerper,
    })
  )
}

async function hofMitKonto(bereit: boolean, weiter: Parameters<typeof erstelleHof>[0] = {}) {
  const kontoId = intKennung('acct')
  const { farm } = await erstelleHof({ acceptsOnline: true, stripeAccountId: kontoId, stripeAccountReady: bereit, ...weiter })
  hoefe.push(farm.id)
  return { farm, kontoId }
}

async function hof(farmId: string) {
  return prisma.farm.findUniqueOrThrow({
    where: { id: farmId },
    select: { stripeAccountReady: true, stripeKontoStand: true, stripeKontoGelesenAm: true, stripeAccountId: true },
  })
}
async function bereit(farmId: string) {
  return (await hof(farmId)).stripeAccountReady
}
async function protokoll(farmId: string) {
  return prisma.adminAktion.findMany({ where: { bezugArt: 'hof', bezugId: farmId }, orderBy: { wann: 'asc' }, select: { art: true, wer: true, grund: true, mitPasskey: true } })
}
async function nachrichten(farmId: string) {
  return prisma.nachricht.findMany({ where: { art: 'SYSTEM', unterhaltung: { farmId } }, select: { text: true, linkUrl: true, vonFarmId: true } })
}
async function mails(farmId: string) {
  return prisma.mailAuftrag.findMany({ where: { farmId, art: 'online-zahlung' }, select: { schluessel: true, bezug: true, vorrang: true } })
}

const CONNECT = INTEGRATIONS_ENV.STRIPE_CONNECT_WEBHOOK_SECRET
const t = (ms: number) => new Date(Date.UTC(2026, 10, 10, 12, 0, 0) + ms)

describe('account.updated über den Connect-Endpunkt (bereit erst mit EPS)', () => {
  it('charges_enabled false → stripeAccountReady false', async () => {
    const { farm, kontoId } = await hofMitKonto(true)
    const antwort = await zustellen(kontoEreignis(konto(kontoId, { charges_enabled: false })))
    expect(antwort.status).toBe(200)
    expect(await bereit(farm.id)).toBe(false)
  })

  it('payouts_enabled false → stripeAccountReady false', async () => {
    const { farm, kontoId } = await hofMitKonto(true)
    await zustellen(kontoEreignis(konto(kontoId, { payouts_enabled: false })))
    expect(await bereit(farm.id)).toBe(false)
  })

  it('alles frei, aber EPS nicht aktiv → nicht bereit, Stand eps_fehlt', async () => {
    const { farm, kontoId } = await hofMitKonto(false)
    await zustellen(kontoEreignis(konto(kontoId, EPS_INAKTIV)))
    expect(await hof(farm.id)).toMatchObject({ stripeAccountReady: false, stripeKontoStand: 'eps_fehlt' })
  })

  it('alles frei mit EPS → stripeAccountReady true, Stand bereit, Lesezeit gesetzt', async () => {
    const { farm, kontoId } = await hofMitKonto(false)
    await zustellen(kontoEreignis(konto(kontoId, BEREIT)))
    const h = await hof(farm.id)
    expect(h).toMatchObject({ stripeAccountReady: true, stripeKontoStand: 'bereit' })
    expect(h.stripeKontoGelesenAm).toBeInstanceOf(Date)
  })

  it('fremdes Konto: kein Hof betroffen, trotzdem 200', async () => {
    const { farm } = await hofMitKonto(true)
    const antwort = await zustellen(kontoEreignis(konto(intKennung('acct-fremd'), { charges_enabled: false })))
    expect(antwort.status).toBe(200)
    expect(await bereit(farm.id)).toBe(true)
  })
})

describe('Wechsel: Protokoll und Nachricht (E6, E7)', () => {
  it('nicht bereit → bereit: Spalten, ein Protokoll „aktiv“, eine Postfach-Nachricht, ein MailAuftrag — dasselbe noch einmal: nichts dazu', async () => {
    const { farm, kontoId } = await hofMitKonto(false)

    await zustellen(kontoEreignis(konto(kontoId, BEREIT)))

    expect(await hof(farm.id)).toMatchObject({ stripeAccountReady: true, stripeKontoStand: 'bereit' })
    expect(await protokoll(farm.id)).toEqual([{ art: 'online_zahlung_aktiv', wer: null, grund: 'bereit', mitPasskey: false }])
    expect(await nachrichten(farm.id)).toEqual([
      { text: 'Stripe hat dein Konto freigegeben. Ab sofort können Kunden bei dir online bezahlen.', linkUrl: '/settings/payments', vonFarmId: null },
    ])
    const auftraege = await mails(farm.id)
    expect(auftraege).toHaveLength(1)
    expect(auftraege[0]).toMatchObject({ bezug: { farmId: farm.id, anlass: 'aktiv' }, vorrang: 1 })
    expect(auftraege[0].schluessel).toMatch(new RegExp(`^online-zahlung:${farm.id}:aktiv:\\d+$`))

    // Neue Ereignis-Kennung, derselbe Stand: kein Wechsel, nichts dazu.
    await zustellen(kontoEreignis(konto(kontoId, BEREIT)))
    expect(await protokoll(farm.id)).toHaveLength(1)
    expect(await nachrichten(farm.id)).toHaveLength(1)
    expect(await mails(farm.id)).toHaveLength(1)
  })

  it('bereit → nicht bereit (EPS inaktiv): Stand eps_fehlt, ein Protokoll „pausiert“ mit Grund eps_fehlt, keine Nachricht', async () => {
    const { farm, kontoId } = await hofMitKonto(true)

    await zustellen(kontoEreignis(konto(kontoId, EPS_INAKTIV)))

    expect(await hof(farm.id)).toMatchObject({ stripeAccountReady: false, stripeKontoStand: 'eps_fehlt' })
    expect(await protokoll(farm.id)).toEqual([{ art: 'online_zahlung_pausiert', wer: null, grund: 'eps_fehlt', mitPasskey: false }])
    expect(await nachrichten(farm.id)).toEqual([])
    expect(await mails(farm.id)).toEqual([])
  })

  it('Bremse: aktiv → pausiert → aktiv binnen 24 h → eine Nachricht, ein Auftrag, drei Protokolleinträge', async () => {
    const { farm, kontoId } = await hofMitKonto(false)
    const schreibe = (k: Konto, ms: number) => schreibeStripeKontoStand({ farmId: farm.id, stripeAccountId: kontoId, konto: k, gelesenAm: t(ms) })

    await schreibe(konto(kontoId, BEREIT), 0)
    await schreibe(konto(kontoId, EPS_INAKTIV), 60_000)
    await schreibe(konto(kontoId, BEREIT), 120_000)

    expect((await protokoll(farm.id)).map((p) => p.art)).toEqual(['online_zahlung_aktiv', 'online_zahlung_pausiert', 'online_zahlung_aktiv'])
    expect(await nachrichten(farm.id)).toHaveLength(1)
    expect(await mails(farm.id)).toHaveLength(1)
  })

  it('acceptsOnline false → Protokoll ja, keine Nachricht', async () => {
    const { farm, kontoId } = await hofMitKonto(false, { acceptsOnline: false })

    await zustellen(kontoEreignis(konto(kontoId, BEREIT)))

    expect((await protokoll(farm.id)).map((p) => p.art)).toEqual(['online_zahlung_aktiv'])
    expect(await nachrichten(farm.id)).toEqual([])
    expect(await mails(farm.id)).toEqual([])
  })

  it('vom Team gesperrt: „aktiv“ mit dem zweiten Satz (Bestellen geht gerade nicht)', async () => {
    const { farm, kontoId } = await hofMitKonto(false, { adminGesperrtAm: new Date() })

    await zustellen(kontoEreignis(konto(kontoId, BEREIT)))

    expect((await nachrichten(farm.id)).map((n) => n.text)).toEqual([
      'Stripe hat dein Konto freigegeben. Sobald dein Hof online ist, können Kunden dort auch online bezahlen.',
    ])
  })

  it('noch nicht freigeschaltet: „aktiv“ mit dem zweiten Satz', async () => {
    const { farm, kontoId } = await hofMitKonto(false, { approvedAt: null })

    await zustellen(kontoEreignis(konto(kontoId, BEREIT)))

    expect((await nachrichten(farm.id)).map((n) => n.text)).toEqual([
      'Stripe hat dein Konto freigegeben. Sobald dein Hof online ist, können Kunden dort auch online bezahlen.',
    ])
  })
})

describe('Reihenfolge der Ereignisse', () => {
  it('ein verspätetes, älteres account.updated überschreibt nicht den aktuellen Stand bei Stripe', async () => {
    const { farm, kontoId } = await hofMitKonto(true)
    const veraltet = kontoEreignis(konto(kontoId, { charges_enabled: false, payouts_enabled: false }))
    // Inzwischen ist das Konto wieder frei.
    kontoStand.set(kontoId, konto(kontoId, BEREIT))

    await zustellen(veraltet)

    expect(await bereit(farm.id)).toBe(true)
  })
})

describe('Zwei Schreiber (Fund 4, 11 c): wer später gelesen hat, gewinnt', () => {
  it.each([
    ['erst der ältere, dann der neuere', false],
    ['erst der neuere, dann der ältere', true],
  ])('%s → am Ende der Stand von t2, höchstens ein MailAuftrag', async (_name, neuererZuerst) => {
    const { farm, kontoId } = await hofMitKonto(false)
    const aelter = () => schreibeStripeKontoStand({ farmId: farm.id, stripeAccountId: kontoId, konto: konto(kontoId, PRUEFUNG), gelesenAm: t(1_000) })
    const neuer = () => schreibeStripeKontoStand({ farmId: farm.id, stripeAccountId: kontoId, konto: konto(kontoId, BEREIT), gelesenAm: t(2_000) })

    if (neuererZuerst) {
      await neuer()
      await aelter()
    } else {
      await aelter()
      await neuer()
    }

    const h = await hof(farm.id)
    expect(h).toMatchObject({ stripeAccountReady: true, stripeKontoStand: 'bereit' })
    expect(h.stripeKontoGelesenAm?.getTime()).toBe(t(2_000).getTime())
    expect((await mails(farm.id)).length).toBeLessThanOrEqual(1)
    // Jeder Wechsel hat genau einen Eintrag.
    expect((await protokoll(farm.id)).map((p) => p.art)).toEqual(['online_zahlung_aktiv'])
  })

  it('ein älterer Schreiber schreibt zwischen Wechsel-Fall und Fall ohne Wechsel des neueren → am Ende der neuere Stand, Einträge wechseln sich ab', async () => {
    const { farm, kontoId } = await hofMitKonto(true)
    // Ausgangslage: bereit, zuletzt bei t0 gelesen.
    await prisma.farm.update({ where: { id: farm.id }, data: { stripeKontoStand: 'bereit', stripeKontoGelesenAm: t(0) } })
    const aelter = () => schreibeStripeKontoStand({ farmId: farm.id, stripeAccountId: kontoId, konto: konto(kontoId, EPS_INAKTIV), gelesenAm: t(1_000) })

    // Haken: Bevor der neuere seinen Fall ohne Wechsel (bereit bleibt bereit) schreibt, kommt der ältere dazwischen.
    const echt = prisma.farm.updateMany.bind(prisma.farm)
    let haken = true
    vi.spyOn(prisma.farm, 'updateMany').mockImplementation((async (args: { where: { stripeAccountReady?: boolean }; data: { stripeKontoGelesenAm?: Date } }) => {
      if (haken && args.data.stripeKontoGelesenAm?.getTime() === t(2_000).getTime() && args.where.stripeAccountReady === true) {
        haken = false
        await aelter()
      }
      return echt(args as never)
    }) as never)

    await schreibeStripeKontoStand({ farmId: farm.id, stripeAccountId: kontoId, konto: konto(kontoId, BEREIT), gelesenAm: t(2_000) })

    expect(haken).toBe(false)
    const h = await hof(farm.id)
    expect(h).toMatchObject({ stripeAccountReady: true, stripeKontoStand: 'bereit' })
    expect(h.stripeKontoGelesenAm?.getTime()).toBe(t(2_000).getTime())
    // pausiert (der ältere) und wieder aktiv (der neuere) — kein Wechsel ohne Eintrag.
    expect((await protokoll(farm.id)).map((p) => [p.art, p.grund])).toEqual([
      ['online_zahlung_pausiert', 'eps_fehlt'],
      ['online_zahlung_aktiv', 'bereit'],
    ])
  })

  it('andere Kennung (inzwischen neu eingerichtet): nichts geschrieben, keine Nachricht', async () => {
    const { farm, kontoId } = await hofMitKonto(false)
    await schreibeStripeKontoStand({ farmId: farm.id, stripeAccountId: `${kontoId}-alt`, konto: konto(kontoId, BEREIT), gelesenAm: t(0) })
    expect(await hof(farm.id)).toMatchObject({ stripeAccountReady: false, stripeKontoStand: null, stripeKontoGelesenAm: null })
    expect(await protokoll(farm.id)).toEqual([])
  })
})

describe('Konto unbekannt (Register Z2)', () => {
  it('Stand pruefung, Stripe kennt das Konto nicht → Stand NULL, Anzeige angaben_fehlen, kein Protokoll (Bereit-Wert unverändert)', async () => {
    const { farm, kontoId } = await hofMitKonto(false)
    await prisma.farm.update({ where: { id: farm.id }, data: { stripeKontoStand: 'pruefung', stripeKontoGelesenAm: t(0) } })

    await vermerkeUnbekanntesHofKonto(farm.id, kontoId)

    const h = await hof(farm.id)
    expect(h).toMatchObject({ stripeAccountReady: false, stripeKontoStand: null, stripeAccountId: kontoId })
    expect(stripeAnzeige({ stripeKontoDa: true, stripeAccountReady: h.stripeAccountReady, stripeKontoStand: h.stripeKontoStand })).toBe('angaben_fehlen')
    expect(await protokoll(farm.id)).toEqual([])
  })

  it('bereit, Stripe kennt das Konto nicht → nicht bereit, Protokoll „pausiert“ mit Grund konto_unbekannt', async () => {
    const { farm, kontoId } = await hofMitKonto(true)
    await vermerkeUnbekanntesHofKonto(farm.id, kontoId)
    expect(await bereit(farm.id)).toBe(false)
    expect(await protokoll(farm.id)).toEqual([{ art: 'online_zahlung_pausiert', wer: null, grund: 'konto_unbekannt', mitPasskey: false }])
  })
})

describe('capability.updated (E9)', () => {
  function faehigkeitEreignis(kontoId: string | null, k?: Konto) {
    if (k) kontoStand.set(k.id, k)
    return {
      id: intKennung('evt'),
      object: 'event',
      type: 'capability.updated',
      ...(kontoId ? { account: kontoId } : {}),
      data: { object: { id: 'eps_payments', object: 'capability', account: kontoId ?? 'acct_platzhalter', status: 'active', requested: true } },
    }
  }

  it('mit event.account → derselbe Weg: Stripe wird mit dieser Kennung gelesen, Stand geschrieben', async () => {
    const { farm, kontoId } = await hofMitKonto(false)

    const antwort = await zustellen(faehigkeitEreignis(kontoId, konto(kontoId, BEREIT)))

    expect(antwort.status).toBe(200)
    expect(vi.mocked(stripe.accounts.retrieve)).toHaveBeenCalledWith(kontoId, {}, { timeout: 10_000, maxNetworkRetries: 1 })
    expect(await hof(farm.id)).toMatchObject({ stripeAccountReady: true, stripeKontoStand: 'bereit' })
  })

  it('ohne event.account → nichts geändert, 200', async () => {
    const { farm, kontoId } = await hofMitKonto(false)
    kontoStand.set(kontoId, konto(kontoId, BEREIT))

    const antwort = await zustellen(faehigkeitEreignis(null), INTEGRATIONS_ENV.STRIPE_WEBHOOK_SECRET)

    expect(antwort.status).toBe(200)
    expect(vi.mocked(stripe.accounts.retrieve)).not.toHaveBeenCalled()
    expect(await hof(farm.id)).toMatchObject({ stripeAccountReady: false, stripeKontoStand: null })
  })
})

describe('W-A: „Stripe braucht noch Angaben“ nach der Prüfung', () => {
  it(`pruefung → angaben_fehlen → ${ANGABEN_NACHRICHT ? 'eine Nachricht „angaben“' : 'keine Nachricht'}, kein Protokoll`, async () => {
    const { farm, kontoId } = await hofMitKonto(false)
    await schreibeStripeKontoStand({ farmId: farm.id, stripeAccountId: kontoId, konto: konto(kontoId, PRUEFUNG), gelesenAm: t(0) })
    expect((await hof(farm.id)).stripeKontoStand).toBe('pruefung')

    await schreibeStripeKontoStand({ farmId: farm.id, stripeAccountId: kontoId, konto: konto(kontoId, ANGABEN), gelesenAm: t(1_000) })

    expect((await hof(farm.id)).stripeKontoStand).toBe('angaben_fehlen')
    expect(await protokoll(farm.id)).toEqual([])
    if (ANGABEN_NACHRICHT) {
      expect((await nachrichten(farm.id)).map((n) => n.text)).toEqual([
        'Stripe braucht noch Angaben von dir. Öffne Einstellungen › Zahlung und tippe auf ‚Einrichtung fortsetzen‘.',
      ])
      expect((await mails(farm.id)).map((m) => m.bezug)).toEqual([{ farmId: farm.id, anlass: 'angaben' }])
    } else {
      expect(await nachrichten(farm.id)).toEqual([])
    }
  })

  it('NULL → angaben_fehlen → keine Nachricht (der Hof war nie „fertig“)', async () => {
    const { farm, kontoId } = await hofMitKonto(false)
    await schreibeStripeKontoStand({ farmId: farm.id, stripeAccountId: kontoId, konto: konto(kontoId, ANGABEN), gelesenAm: t(0) })
    expect((await hof(farm.id)).stripeKontoStand).toBe('angaben_fehlen')
    expect(await nachrichten(farm.id)).toEqual([])
    expect(await mails(farm.id)).toEqual([])
  })
})

describe('Aufgabe hof_online_haengt über ladeAufgabenStand', () => {
  it('verkaufender Hof mit eps_fehlt → Aufgabe; pausiert, stillgelegt, Testhof → keine', async () => {
    const gelesen = { stripeKontoStand: 'eps_fehlt', stripeKontoGelesenAm: t(0) }
    const { farm: verkauft } = await hofMitKonto(false, gelesen)
    const { farm: pausiert } = await hofMitKonto(false, { ...gelesen, isPaused: true })
    const { farm: still } = await hofMitKonto(false, { ...gelesen, archivedAt: new Date() })
    const { farm: test } = await hofMitKonto(false, { ...gelesen, istTesthof: true })

    const jetzt = new Date()
    const stand = await ladeAufgabenStand(jetzt, { mitBetrieb: false })
    const aufgaben = ADMIN_AUFGABEN.hof_online_haengt(stand, jetzt).map((a) => a.bezug.kennung)

    expect(aufgaben).toContain(verkauft.id)
    for (const id of [pausiert.id, still.id, test.id]) expect(aufgaben).not.toContain(id)
  })
})

describe('Spalten (Migration 20261110120000_stripe_konto_stand)', () => {
  it('beide nullbar, ohne Default', async () => {
    const spalten = await prisma.$queryRaw<{ column_name: string; is_nullable: string; column_default: string | null; data_type: string }[]>`
      SELECT column_name, is_nullable, column_default, data_type FROM information_schema.columns
      WHERE table_name = 'Farm' AND column_name IN ('stripeKontoStand', 'stripeKontoGelesenAm') ORDER BY column_name`
    expect(spalten).toEqual([
      { column_name: 'stripeKontoGelesenAm', is_nullable: 'YES', column_default: null, data_type: 'timestamp without time zone' },
      { column_name: 'stripeKontoStand', is_nullable: 'YES', column_default: null, data_type: 'text' },
    ])
  })
})

describe('Signatur gegen beide Secrets', () => {
  it('mit dem Plattform-Secret signiert: wird ebenso verarbeitet', async () => {
    const { farm, kontoId } = await hofMitKonto(true)
    await zustellen(kontoEreignis(konto(kontoId, { charges_enabled: false, payouts_enabled: false })), INTEGRATIONS_ENV.STRIPE_WEBHOOK_SECRET)
    expect(await bereit(farm.id)).toBe(false)
  })

  it('mit einem fremden Secret signiert: 400, nichts geändert', async () => {
    const { farm, kontoId } = await hofMitKonto(true)
    const antwort = await zustellen(kontoEreignis(konto(kontoId, { charges_enabled: false })), 'whsec_fremd_und_falsch')
    expect(antwort.status).toBe(400)
    expect(await bereit(farm.id)).toBe(true)
  })
})
