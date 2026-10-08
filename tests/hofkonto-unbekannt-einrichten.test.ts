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
 *  - Runde 1: Bei diesen reinen Konto-Aufrufen zählt auch der Zugriffsfehler
 *    (403 `account_invalid`) als „Konto unbekannt" — die gespeicherte Kennung
 *    stammt immer aus dem eigenen accounts.create.
 *  - Runde 1: Nach jedem Vermerk rendern Zahlung, Einstellungen, Heute,
 *    Verkäufe und Hofseite neu — auch nach dem Login-Link (Verkäufe).
 *  - Runde 1: Beim Ersetzen legt accounts.create mit Idempotenz-Schlüssel aus
 *    Hof und alter Kennung an (Doppelklick, Neuversuch → kein zweites Konto),
 *    und alte wie neue Kennung stehen mit der Hof-ID im Server-Protokoll.
 *  - Gegenproben: Andere Stripe-Fehler nehmen den bisherigen Weg.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
import { NEU_EINRICHTEN_FENSTER_MS, NEU_EINRICHTEN_KURZ } from '@/lib/stripe-konto'
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

/** Stripes Antwort auf eine Kennung ohne Zugriff (Runde 1) — erfunden, ohne Schlüssel. */
const keinZugriff = () =>
  new Stripe.errors.StripeInvalidRequestError({
    type: 'invalid_request_error',
    code: 'account_invalid',
    message: `The provided key does not have access to account '${ALT}' (or that account does not exist). Application access may have been revoked.`,
    statusCode: 403,
  })

/** Beide Antworten heißen bei reinen Konto-Aufrufen: neu einrichten. */
const UNBEKANNT = [
  ['unbekannt (resource_missing)', kontoUnbekannt],
  ['kein Zugriff (account_invalid, 403)', keinZugriff],
] as const

/** Nach dem Vermerk: alle Seiten, die den Zahlungsstand zeigen (wie schalteOnlineZahlungEin, dazu Verkäufe). */
const NEU_GERENDERT = ['/settings/payments', '/settings', '/dashboard', '/sales', '/hof-test']
const neuGerendert = () => vi.mocked(revalidatePath).mock.calls.map(([pfad]) => pfad)

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
  it.each(UNBEKANNT)('%s: vermerkt den Hof und meldet kontoUnbekannt — ohne die Kennung anzufassen', async (_fall, fehler) => {
    vi.mocked(stripe.accounts.retrieve).mockRejectedValue(fehler())

    expect(await checkConnectStatus()).toEqual({ ready: false, kontoUnbekannt: true })

    expect(vermerk).toHaveBeenCalledWith('farm_1', ALT)
    expect(farmUpdate).not.toHaveBeenCalled()
    expect(schriebKennung()).toBe(false)
    expect(neuGerendert()).toEqual(NEU_GERENDERT)
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
  it.each(UNBEKANNT)('%s: kein Link, Satz für den Hof, kontoUnbekannt — Hof vermerkt', async (_fall, fehler) => {
    vi.mocked(stripe.accountLinks.create).mockRejectedValue(fehler())

    expect(await createOnboardingLink()).toEqual({ error: NEU_EINRICHTEN_KURZ, kontoUnbekannt: true })

    expect(vermerk).toHaveBeenCalledWith('farm_1', ALT)
    expect(schriebKennung()).toBe(false)
    expect(neuGerendert()).toEqual(NEU_GERENDERT)
  })

  it('Gegenprobe: ein anderer Fehler wirft wie bisher', async () => {
    vi.mocked(stripe.accountLinks.create).mockRejectedValue(new Error('Stripe nicht erreichbar'))

    await expect(createOnboardingLink()).rejects.toThrow('Stripe nicht erreichbar')
    expect(vermerk).not.toHaveBeenCalled()
  })
})

describe('„Online-Zahlung neu einrichten" (createConnectAccount mit gespeicherter Kennung)', () => {
  let protokoll: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    protokoll = vi.spyOn(console, 'info').mockImplementation(() => {})
  })
  afterEach(() => {
    protokoll.mockRestore()
  })

  it.each(UNBEKANNT)('Stripe: %s — neues Konto, Kennung bedingt auf die alte ersetzt, nicht bereit', async (_fall, fehler) => {
    vi.mocked(stripe.accounts.retrieve).mockRejectedValue(fehler())

    expect(await createConnectAccount()).toEqual({})

    expect(stripe.accounts.retrieve).toHaveBeenCalledWith(ALT)
    expect(stripe.accounts.create).toHaveBeenCalledTimes(1)
    expect(farmUpdateMany).toHaveBeenCalledWith({
      where: { id: 'farm_1', stripeAccountId: ALT },
      data: { stripeAccountId: NEU, stripeAccountReady: false, acceptsOnline: true },
    })
    expect(farmUpdate).not.toHaveBeenCalled()
  })

  describe('Idempotenz-Schlüssel aus Hof, alter Kennung und 15-Minuten-Fenster', () => {
    const JETZT = new Date('2026-10-08T10:03:00.000Z')
    const FENSTER = Math.floor(JETZT.getTime() / NEU_EINRICHTEN_FENSTER_MS)
    const schluessel = () => vi.mocked(stripe.accounts.create).mock.calls.map(([, o]) => (o as { idempotencyKey?: string })?.idempotencyKey)

    beforeEach(() => {
      vi.useFakeTimers({ now: JETZT, toFake: ['Date'] })
      vi.mocked(stripe.accounts.retrieve).mockRejectedValue(kontoUnbekannt())
    })
    afterEach(() => {
      vi.useRealTimers()
    })

    it('ein Doppelklick bekommt dasselbe Konto — derselbe Schlüssel', async () => {
      await createConnectAccount()
      vi.setSystemTime(new Date(JETZT.getTime() + 2_000))
      await createConnectAccount()

      expect(schluessel()).toEqual([`hofkonto-neu-farm_1-${ALT}-${FENSTER}`, `hofkonto-neu-farm_1-${ALT}-${FENSTER}`])
      // Der Schlüssel trägt nur Kennungen — keine Adresse, kein Name.
      expect(JSON.stringify(schluessel())).not.toContain('@')
    })

    it('Runde 2: ein gescheiterter Versuch sperrt höchstens bis zum nächsten Fenster, nicht 24 Stunden', async () => {
      // Stripe hielte unter demselben Schlüssel auch den Fehler 24 Stunden lang fest.
      vi.mocked(stripe.accounts.create).mockRejectedValueOnce(new Error('Stripe nicht erreichbar'))
      await expect(createConnectAccount()).rejects.toThrow('Stripe nicht erreichbar')

      vi.setSystemTime(new Date(JETZT.getTime() + NEU_EINRICHTEN_FENSTER_MS))
      expect(await createConnectAccount()).toEqual({})

      const [erster, zweiter] = schluessel()
      expect(erster).toBe(`hofkonto-neu-farm_1-${ALT}-${FENSTER}`)
      expect(zweiter).toBe(`hofkonto-neu-farm_1-${ALT}-${FENSTER + 1}`)
    })
  })

  it('schreibt alte und neue Kennung mit der Hof-ID ins Server-Protokoll — nichts Persönliches', async () => {
    vi.mocked(stripe.accounts.retrieve).mockRejectedValue(kontoUnbekannt())

    await createConnectAccount()

    expect(protokoll).toHaveBeenCalledTimes(1)
    const zeile = String(protokoll.mock.calls[0][0])
    expect(zeile).toMatch(/^\[Stripe\] Hof-Konto neu eingerichtet/)
    expect(zeile).toContain('farm_1')
    expect(zeile).toContain(`alt ${ALT}`)
    expect(zeile).toContain(`neu ${NEU}`)
    expect(zeile).not.toContain(HOF.email)
    expect(zeile).not.toContain(HOF.name)
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

  it('hat sich die Kennung inzwischen geändert (zweiter Tab), bleibt die neue stehen — und das Protokoll sagt es', async () => {
    vi.mocked(stripe.accounts.retrieve).mockRejectedValue(kontoUnbekannt())
    farmUpdateMany.mockResolvedValue({ count: 0 } as never)

    const antwort = await createConnectAccount()

    expect(antwort.error).toMatch(/Lade die Seite neu/)
    expect(farmUpdate).not.toHaveBeenCalled()
    expect(protokoll).toHaveBeenCalledTimes(1)
    const zeile = String(protokoll.mock.calls[0][0])
    expect(zeile).toMatch(/^\[Stripe\] Hof-Konto nicht ersetzt/)
    expect(zeile).toContain('farm_1')
    expect(zeile).toContain(ALT)
    expect(zeile).toContain(NEU)
  })

  it('Gegenprobe: ohne gespeichertes Konto fragt der Weg Stripe nicht nach dem alten — Anlegen wie bisher', async () => {
    farmFindUnique.mockResolvedValue({ ...HOF, stripeAccountId: null, stripeAccountReady: false } as never)

    expect(await createConnectAccount()).toEqual({})

    expect(stripe.accounts.retrieve).not.toHaveBeenCalled()
    expect(farmUpdate).toHaveBeenCalledWith({ where: { id: 'farm_1' }, data: { stripeAccountId: NEU, acceptsOnline: true } })
    // Der erste Weg bleibt unverändert: ohne Idempotenz-Schlüssel, ohne Protokollzeile.
    expect(vi.mocked(stripe.accounts.create).mock.calls[0]).toHaveLength(1)
    expect(protokoll).not.toHaveBeenCalled()
  })
})

describe('Auszahlungen bei Stripe (createStripeDashboardLinkAction)', () => {
  it.each(UNBEKANNT)('%s: Hof vermerkt, Satz mit dem Weg zum Neu-Einrichten, Seiten neu gerendert', async (_fall, fehler) => {
    vi.mocked(stripe.accounts.createLoginLink).mockRejectedValue(fehler())
    const fehlerAusgabe = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(await createStripeDashboardLinkAction()).toEqual({ error: NEU_EINRICHTEN_KURZ })

    expect(vermerk).toHaveBeenCalledWith('farm_1', ALT)
    // Runde 1: Der Vermerk setzt „nicht bereit" — ohne Neurendern zeigte /sales weiter den Knopf.
    expect(neuGerendert()).toEqual(NEU_GERENDERT)
    expect(fehlerAusgabe).not.toHaveBeenCalled()
    fehlerAusgabe.mockRestore()
  })

  it('Gegenprobe: ein anderer Fehler bleibt beim bisherigen Satz', async () => {
    vi.mocked(stripe.accounts.createLoginLink).mockRejectedValue(new Error('Stripe nicht erreichbar'))
    const fehlerAusgabe = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(await createStripeDashboardLinkAction()).toEqual({ error: 'Stripe-Übersicht gerade nicht erreichbar' })

    expect(vermerk).not.toHaveBeenCalled()
    expect(revalidatePath).not.toHaveBeenCalled()
    fehlerAusgabe.mockRestore()
  })
})

describe('Rückkehr aus dem Onboarding (/api/stripe/return)', () => {
  const zurueck = () => rueckkehr(new NextRequest(`http://localhost:3000/api/stripe/return?account_id=${ALT}`))

  it.each(UNBEKANNT)('%s: Hof vermerkt, weiter zu ?stripe=neu', async (_fall, fehler) => {
    vi.mocked(stripe.accounts.retrieve).mockRejectedValue(fehler())

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
