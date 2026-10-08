/**
 * Einstellungen und Einrichten: Stripe kennt das gespeicherte Hof-Konto nicht
 * (Register Z2, Nachtlauf Nr. 42) — Actions aus stripe-connect.ts und die
 * Rückkehr aus dem Onboarding, Prisma und Stripe gemockt.
 *
 * Beweist:
 *  - „Status prüfen", „Einrichtung fortsetzen", der Login-Link (Verkäufe) und
 *    die Rückkehr aus dem Onboarding erkennen das unbekannte Konto, vermerken
 *    den Hof (nicht bereit, Sentry gedrosselt) und führen zu „Online-Zahlung
 *    neu einrichten" — die Kennung schreiben sie nicht.
 *  - „Online-Zahlung neu einrichten" (createConnectAccount mit gespeicherter
 *    Kennung) ersetzt die Kennung NUR, wenn Stripe das alte Konto in diesem
 *    Moment nachweislich nicht kennt, und nur bedingt auf die alte Kennung.
 *    Kennt Stripe das Konto, bleibt alles, wie es war.
 *  - Gegenproben: Andere Stripe-Fehler nehmen den bisherigen Weg.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Stripe from 'stripe'

const sitzung = vi.hoisted(() => ({ wert: { user: { id: 'user_1' } } as { user: { id: string } } | null }))

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn(async () => sitzung.wert) } } }))
vi.mock('@/lib/prisma', () => ({
  prisma: { farm: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() } },
}))
vi.mock('@/lib/stripe', () => ({
  stripe: {
    accounts: { create: vi.fn(), retrieve: vi.fn(), createLoginLink: vi.fn() },
    accountLinks: { create: vi.fn() },
  },
}))
vi.mock('@/server/hofkonto-unbekannt', () => ({ vermerkeUnbekanntesHofKonto: vi.fn(async () => undefined) }))

import { NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { vermerkeUnbekanntesHofKonto } from '@/server/hofkonto-unbekannt'
import { NEU_EINRICHTEN_KURZ } from '@/lib/stripe-konto'
import {
  checkConnectStatus,
  createConnectAccount,
  createOnboardingLink,
  createStripeDashboardLinkAction,
} from '@/server/actions/stripe-connect'
import { GET as rueckkehr } from '@/app/api/stripe/return/route'

const ALT = 'acct_erfunden_testmodus'
const NEU = 'acct_erfunden_live'

const HOF = {
  id: 'farm_1',
  name: 'Hof Test',
  slug: 'hof-test',
  email: 'hof@example.com',
  stripeAccountId: ALT as string | null,
  stripeAccountReady: true,
}

const kontoUnbekannt = () =>
  new Stripe.errors.StripeInvalidRequestError({
    type: 'invalid_request_error',
    code: 'resource_missing',
    message: `No such account: '${ALT}'; a similar object exists in test mode, but a live mode key was used to make this request.`,
    statusCode: 404,
  })

const farmFindUnique = vi.mocked(prisma.farm.findUnique)
const farmUpdate = vi.mocked(prisma.farm.update)
const farmUpdateMany = vi.mocked(prisma.farm.updateMany)
const vermerk = vi.mocked(vermerkeUnbekanntesHofKonto)

/** Kein Weg dieser Datei schreibt die alte Kennung weg — außer dem ausdrücklichen Neu-Einrichten. */
function schriebKennung(): boolean {
  return [...farmUpdate.mock.calls, ...farmUpdateMany.mock.calls].some(
    ([arg]) => 'stripeAccountId' in ((arg as { data?: Record<string, unknown> }).data ?? {})
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  sitzung.wert = { user: { id: 'user_1' } }
  farmFindUnique.mockResolvedValue(HOF as never)
  farmUpdate.mockResolvedValue({} as never)
  farmUpdateMany.mockResolvedValue({ count: 1 } as never)
  vi.mocked(stripe.accounts.create).mockResolvedValue({ id: NEU } as never)
  vi.mocked(stripe.accountLinks.create).mockResolvedValue({ url: 'https://connect.stripe.test/platzhalter' } as never)
})

describe('„Status prüfen" (checkConnectStatus)', () => {
  it('unbekanntes Konto: vermerkt den Hof und meldet kontoUnbekannt — ohne die Kennung anzufassen', async () => {
    vi.mocked(stripe.accounts.retrieve).mockRejectedValue(kontoUnbekannt())

    expect(await checkConnectStatus()).toEqual({ ready: false, kontoUnbekannt: true })

    expect(vermerk).toHaveBeenCalledWith('farm_1', ALT)
    expect(farmUpdate).not.toHaveBeenCalled()
    expect(schriebKennung()).toBe(false)
    expect(revalidatePath).toHaveBeenCalledWith('/settings/payments')
  })

  it('Gegenprobe: ein anderer Stripe-Fehler wirft wie bisher, ohne Vermerk', async () => {
    vi.mocked(stripe.accounts.retrieve).mockRejectedValue(new Error('Stripe nicht erreichbar'))

    await expect(checkConnectStatus()).rejects.toThrow('Stripe nicht erreichbar')
    expect(vermerk).not.toHaveBeenCalled()
  })

  it('Gegenprobe: ein bekanntes Konto schreibt den Stand wie bisher', async () => {
    vi.mocked(stripe.accounts.retrieve).mockResolvedValue({ id: ALT, charges_enabled: true, payouts_enabled: true } as never)

    expect(await checkConnectStatus()).toEqual({ ready: true })
    expect(farmUpdate).toHaveBeenCalledWith({ where: { id: 'farm_1' }, data: { stripeAccountReady: true } })
    expect(vermerk).not.toHaveBeenCalled()
  })
})

describe('„Einrichtung fortsetzen" (createOnboardingLink)', () => {
  it('unbekanntes Konto: kein Link, Satz für den Hof, kontoUnbekannt — Hof vermerkt', async () => {
    vi.mocked(stripe.accountLinks.create).mockRejectedValue(kontoUnbekannt())

    expect(await createOnboardingLink()).toEqual({ error: NEU_EINRICHTEN_KURZ, kontoUnbekannt: true })

    expect(vermerk).toHaveBeenCalledWith('farm_1', ALT)
    expect(schriebKennung()).toBe(false)
  })

  it('Gegenprobe: ein anderer Fehler wirft wie bisher', async () => {
    vi.mocked(stripe.accountLinks.create).mockRejectedValue(new Error('Stripe nicht erreichbar'))

    await expect(createOnboardingLink()).rejects.toThrow('Stripe nicht erreichbar')
    expect(vermerk).not.toHaveBeenCalled()
  })
})

describe('„Online-Zahlung neu einrichten" (createConnectAccount mit gespeicherter Kennung)', () => {
  it('Stripe kennt das alte Konto nicht: neues Konto, Kennung bedingt auf die alte ersetzt, nicht bereit', async () => {
    vi.mocked(stripe.accounts.retrieve).mockRejectedValue(kontoUnbekannt())

    expect(await createConnectAccount()).toEqual({})

    expect(stripe.accounts.retrieve).toHaveBeenCalledWith(ALT)
    expect(stripe.accounts.create).toHaveBeenCalledTimes(1)
    expect(farmUpdateMany).toHaveBeenCalledWith({
      where: { id: 'farm_1', stripeAccountId: ALT },
      data: { stripeAccountId: NEU, stripeAccountReady: false, acceptsOnline: true },
    })
    expect(farmUpdate).not.toHaveBeenCalled()
  })

  it('Stripe kennt das Konto: nichts wird ersetzt, kein zweites Konto', async () => {
    vi.mocked(stripe.accounts.retrieve).mockResolvedValue({ id: ALT, charges_enabled: false, payouts_enabled: false } as never)

    expect(await createConnectAccount()).toEqual({ error: 'Stripe-Konto bereits verbunden' })

    expect(stripe.accounts.create).not.toHaveBeenCalled()
    expect(schriebKennung()).toBe(false)
  })

  it('ein anderer Stripe-Fehler bei der Prüfung: kein neues Konto, nichts ersetzt', async () => {
    vi.mocked(stripe.accounts.retrieve).mockRejectedValue(new Error('Stripe nicht erreichbar'))

    await expect(createConnectAccount()).rejects.toThrow('Stripe nicht erreichbar')

    expect(stripe.accounts.create).not.toHaveBeenCalled()
    expect(schriebKennung()).toBe(false)
  })

  it('hat sich die Kennung inzwischen geändert (zweiter Tab), bleibt die neue stehen', async () => {
    vi.mocked(stripe.accounts.retrieve).mockRejectedValue(kontoUnbekannt())
    farmUpdateMany.mockResolvedValue({ count: 0 } as never)

    const antwort = await createConnectAccount()

    expect(antwort.error).toMatch(/Lade die Seite neu/)
    expect(farmUpdate).not.toHaveBeenCalled()
  })

  it('Gegenprobe: ohne gespeichertes Konto fragt der Weg Stripe nicht nach dem alten', async () => {
    farmFindUnique.mockResolvedValue({ ...HOF, stripeAccountId: null, stripeAccountReady: false } as never)

    expect(await createConnectAccount()).toEqual({})

    expect(stripe.accounts.retrieve).not.toHaveBeenCalled()
    expect(farmUpdate).toHaveBeenCalledWith({ where: { id: 'farm_1' }, data: { stripeAccountId: NEU, acceptsOnline: true } })
  })
})

describe('Auszahlungen bei Stripe (createStripeDashboardLinkAction)', () => {
  it('unbekanntes Konto: Hof vermerkt, Satz mit dem Weg zum Neu-Einrichten', async () => {
    vi.mocked(stripe.accounts.createLoginLink).mockRejectedValue(kontoUnbekannt())
    const fehlerAusgabe = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(await createStripeDashboardLinkAction()).toEqual({ error: NEU_EINRICHTEN_KURZ })

    expect(vermerk).toHaveBeenCalledWith('farm_1', ALT)
    fehlerAusgabe.mockRestore()
  })

  it('Gegenprobe: ein anderer Fehler bleibt beim bisherigen Satz', async () => {
    vi.mocked(stripe.accounts.createLoginLink).mockRejectedValue(new Error('Stripe nicht erreichbar'))
    const fehlerAusgabe = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(await createStripeDashboardLinkAction()).toEqual({ error: 'Stripe-Übersicht gerade nicht erreichbar' })

    expect(vermerk).not.toHaveBeenCalled()
    fehlerAusgabe.mockRestore()
  })
})

describe('Rückkehr aus dem Onboarding (/api/stripe/return)', () => {
  const zurueck = () => rueckkehr(new NextRequest(`http://localhost:3000/api/stripe/return?account_id=${ALT}`))

  it('unbekanntes Konto: Hof vermerkt, weiter zu ?stripe=neu', async () => {
    vi.mocked(stripe.accounts.retrieve).mockRejectedValue(kontoUnbekannt())

    const antwort = await zurueck()

    expect(antwort.headers.get('location')).toBe('http://localhost:3000/settings/payments?stripe=neu')
    expect(vermerk).toHaveBeenCalledWith('farm_1', ALT)
    expect(schriebKennung()).toBe(false)
  })

  it('Gegenprobe: ein anderer Fehler führt wie bisher zu ?stripe=error', async () => {
    vi.mocked(stripe.accounts.retrieve).mockRejectedValue(new Error('Stripe nicht erreichbar'))

    const antwort = await zurueck()

    expect(antwort.headers.get('location')).toBe('http://localhost:3000/settings/payments?stripe=error')
    expect(vermerk).not.toHaveBeenCalled()
  })
})
