/**
 * Stripe-Konto im Land des Hofs (Nachtlauf 23, Nr. 152, Register Z1-Ergänzung).
 *
 * Beweist:
 *  - Ein neues Konto wird im Land des Hofs angelegt: Hof DE → 'DE', Hof AT → 'AT',
 *    Hof ohne Land → 'AT'. Stripe ist eine Attrappe, nie ein echter Aufruf.
 *  - Ein bestehendes Konto ändert sich nie: Weicht sein Land vom Hofland ab,
 *    geht höchstens eine Meldung je Hof und Tag an Sentry, nur mit Hof-ID und
 *    den beiden Länderkürzeln.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn(async () => ({ user: { id: 'user_1' } })) } } }))
vi.mock('@/lib/prisma', () => ({
  prisma: { farm: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() } },
}))
vi.mock('@/lib/stripe', () => ({
  stripe: { accounts: { create: vi.fn(), retrieve: vi.fn() } },
}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('@/server/bremse-datenbank', () => ({ bremseUeberAlleInstanzen: vi.fn() }))

import * as Sentry from '@sentry/nextjs'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { bremseUeberAlleInstanzen } from '@/server/bremse-datenbank'
import { DB_BREMSEN } from '@/lib/bremse-datenbank'
import { STRIPE_LAND, LAENDER } from '@/lib/laender'
import { meldeAbweichendesKontoLand } from '@/server/hofkonto-unbekannt'
import { checkConnectStatus, createConnectAccount } from '@/server/actions/stripe-connect'
import { GET as rueckkehr } from '@/app/api/stripe/return/route'
import { NextRequest } from 'next/server'

const bremse = vi.mocked(bremseUeberAlleInstanzen)
const hofSuche = vi.mocked(prisma.farm.findUnique)
const kontoErzeugen = vi.mocked(stripe.accounts.create)
const kontoLesen = vi.mocked(stripe.accounts.retrieve)

const hof = (country: unknown, stripeAccountId: string | null = null) => ({
  id: 'farm_1',
  name: 'Hof Test',
  slug: 'hof-test',
  email: 'hof@example.com',
  country,
  stripeAccountId,
  stripeAccountReady: false,
})

beforeEach(() => {
  vi.clearAllMocks()
  bremse.mockResolvedValue(true)
  kontoErzeugen.mockResolvedValue({ id: 'acct_erfunden_neu' } as never)
  vi.mocked(prisma.farm.update).mockResolvedValue({} as never)
})

describe('neues Konto im Land des Hofs', () => {
  it('Hof in Deutschland → country DE', async () => {
    hofSuche.mockResolvedValue(hof('DE') as never)
    await createConnectAccount()
    expect(kontoErzeugen.mock.calls[0][0]).toMatchObject({ country: 'DE' })
  })

  it('Hof in Österreich → country AT', async () => {
    hofSuche.mockResolvedValue(hof('AT') as never)
    await createConnectAccount()
    expect(kontoErzeugen.mock.calls[0][0]).toMatchObject({ country: 'AT' })
  })

  it('Hof ohne Land (oder Datenmüll) → country AT', async () => {
    hofSuche.mockResolvedValue(hof(undefined) as never)
    await createConnectAccount()
    hofSuche.mockResolvedValue(hof('XX') as never)
    await createConnectAccount()
    expect(kontoErzeugen.mock.calls.map((a) => (a[0] as { country: string }).country)).toEqual(['AT', 'AT'])
  })

  it('die Zuordnung kennt jedes Land des Hofs', () => {
    expect(Object.keys(STRIPE_LAND).sort()).toEqual([...LAENDER].sort())
  })
})

describe('Fähigkeiten eines neuen Kontos (Fix Kasse-Zahlarten)', () => {
  it('fordert Karte, Überweisung und EPS an — EPS braucht das Hofkonto als Händler im Hofpreis-Modell (on_behalf_of)', async () => {
    hofSuche.mockResolvedValue(hof('AT') as never)
    await createConnectAccount()
    expect((kontoErzeugen.mock.calls[0][0] as { capabilities: unknown }).capabilities).toEqual({
      card_payments: { requested: true },
      transfers: { requested: true },
      eps_payments: { requested: true },
    })
  })
})

describe('bestehendes Konto mit abweichendem Land', () => {
  it('meldet einmal, nur mit Hof-ID und Kürzeln; fragt die eigene Drossel', async () => {
    const jetzt = new Date('2026-10-23T09:00:00.000Z')
    await meldeAbweichendesKontoLand('farm_1', 'AT', 'DE', jetzt)

    expect(bremse).toHaveBeenCalledWith([{ bremse: DB_BREMSEN.stripeKontoLand, merkmal: 'farm_1' }], jetzt)
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
    expect(vi.mocked(Sentry.captureMessage).mock.calls[0][1]).toMatchObject({
      level: 'warning',
      tags: { aufgabe: 'stripe-konto', grund: 'konto_land_abweichend' },
      extra: { farmId: 'farm_1', kontoLand: 'AT', hofLand: 'DE' },
    })
    expect(DB_BREMSEN.stripeKontoLand).toEqual({ zweck: 'stripe-konto-land', max: 1, fensterMs: 24 * 60 * 60 * 1000 })
  })

  it('am selben Tag keine zweite Meldung (Drossel sagt nein)', async () => {
    bremse.mockResolvedValue(false)
    await meldeAbweichendesKontoLand('farm_1', 'AT', 'DE')
    expect(Sentry.captureMessage).not.toHaveBeenCalled()
  })

  it('gleiches Land oder unbekanntes Konto-Land: keine Meldung, keine Drossel-Frage', async () => {
    await meldeAbweichendesKontoLand('farm_1', 'DE', 'DE')
    await meldeAbweichendesKontoLand('farm_1', 'de', 'DE')
    await meldeAbweichendesKontoLand('farm_1', null, 'DE')
    await meldeAbweichendesKontoLand('farm_1', undefined, 'AT')
    expect(bremse).not.toHaveBeenCalled()
    expect(Sentry.captureMessage).not.toHaveBeenCalled()
  })

  it('wirft nie, auch wenn Drossel und Sentry ausfallen', async () => {
    bremse.mockRejectedValue(new Error('db'))
    vi.mocked(Sentry.captureMessage).mockImplementation(() => {
      throw new Error('sentry')
    })
    await expect(meldeAbweichendesKontoLand('farm_1', 'AT', 'DE')).resolves.toBeUndefined()
  })

  it('checkConnectStatus: Hof DE, Konto AT → eine Meldung, Konto bleibt unverändert', async () => {
    hofSuche.mockResolvedValue(hof('DE', 'acct_erfunden_alt') as never)
    kontoLesen.mockResolvedValue({ id: 'acct_erfunden_alt', country: 'AT', charges_enabled: false, payouts_enabled: false, details_submitted: false } as never)
    await checkConnectStatus()
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
    expect(kontoErzeugen).not.toHaveBeenCalled()
    expect(JSON.stringify(vi.mocked(prisma.farm.update).mock.calls)).not.toContain('country')
  })

  it('checkConnectStatus: gleiches Land → keine Meldung', async () => {
    hofSuche.mockResolvedValue(hof('AT', 'acct_erfunden_alt') as never)
    kontoLesen.mockResolvedValue({ id: 'acct_erfunden_alt', country: 'AT', charges_enabled: false, payouts_enabled: false, details_submitted: false } as never)
    await checkConnectStatus()
    expect(Sentry.captureMessage).not.toHaveBeenCalled()
  })

  it('Rückkehr aus dem Onboarding: Hof DE, Konto AT → eine Meldung; das Select holt country', async () => {
    hofSuche.mockResolvedValue(hof('DE', 'acct_erfunden_alt') as never)
    kontoLesen.mockResolvedValue({ id: 'acct_erfunden_alt', country: 'AT', charges_enabled: false, payouts_enabled: false, details_submitted: false } as never)
    await rueckkehr(new NextRequest('http://localhost:3000/api/stripe/return?account_id=acct_erfunden_alt'))
    expect((hofSuche.mock.calls[0][0] as { select: Record<string, boolean> }).select.country).toBe(true)
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
  })
})
