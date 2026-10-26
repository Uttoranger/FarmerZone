/**
 * Der Satz vor „Mit Stripe einrichten" (Nachtlauf 24, Nr. 164, Punkt 5):
 * In welchem Land das Konto angelegt wird — Stripe lässt es danach nicht mehr
 * ändern. Er steht, solange es noch kein Konto gibt oder das Konto neu
 * eingerichtet wird (Nr. 171), und führt zu den Hofdaten.
 */
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  usePathname: () => '/settings/payments',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) => createElement('a', { href, ...rest }, children),
}))
vi.mock('@/server/hofbereich', () => ({ verlangeHofDerSitzung: vi.fn(async () => ({ userId: 'user_1', farmId: 'hof_1' })) }))
vi.mock('@/lib/prisma', () => ({ prisma: { farm: { findUnique: vi.fn() } } }))
vi.mock('@/lib/umgebung-server', () => ({ TESTBETRIEB: false }))
vi.mock('@/server/actions/stripe-connect', () => ({
  createConnectAccount: vi.fn(),
  createOnboardingLink: vi.fn(),
  checkConnectStatus: vi.fn(),
  schalteOnlineZahlungEin: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import PaymentsPage from '@/app/(hof)/settings/payments/page'
import { stripeLandSatz } from '@/lib/laender'

const findUnique = vi.mocked(prisma.farm.findUnique)

async function seite(hof: { stripeAccountId: string | null; country: string }, stripe?: string): Promise<string> {
  findUnique.mockResolvedValue({ stripeAccountReady: false, acceptsOnline: false, acceptsOnsite: true, ...hof } as never)
  const baum = await PaymentsPage({ searchParams: Promise.resolve(stripe ? { stripe } : {}) })
  return renderToStaticMarkup(baum)
}

beforeEach(() => vi.clearAllMocks())

describe('stripeLandSatz', () => {
  it('nennt das Land des Hofs in Worten', () => {
    expect(stripeLandSatz('AT')).toBe('Dein Stripe-Konto wird in Österreich angelegt. Stimmt das Land? Sonst zuerst in den Hofdaten ändern.')
    expect(stripeLandSatz('DE')).toContain('in Deutschland angelegt')
    expect(stripeLandSatz('DE')).not.toContain('Österreich')
  })
})

describe('/settings/payments: Land vor „Mit Stripe einrichten"', () => {
  it('ohne Konto: der Satz mit dem Land des Hofs und dem Link auf die Hofdaten', async () => {
    const html = await seite({ stripeAccountId: null, country: 'DE' })
    expect(html).toContain(stripeLandSatz('DE'))
    expect(html).toContain('href="/settings/profile"')
    // Der Satz steht über dem Knopf.
    expect(html.indexOf(stripeLandSatz('DE'))).toBeLessThan(html.indexOf('Mit Stripe einrichten'))
  })

  it('ohne Konto und mit Österreich: Österreich', async () => {
    expect(await seite({ stripeAccountId: null, country: 'AT' })).toContain(stripeLandSatz('AT'))
  })

  it('„Online-Zahlung neu einrichten“ (Konto da, ?stripe=neu): Stripe legt ein neues Konto an, also steht der Satz (Nr. 171)', async () => {
    const html = await seite({ stripeAccountId: 'acct_test', country: 'AT' }, 'neu')
    expect(html).toContain(stripeLandSatz('AT'))
    expect(html).toContain('href="/settings/profile"')
  })

  it('Gegenprobe: mit Konto steht der Satz nicht da', async () => {
    const html = await seite({ stripeAccountId: 'acct_test', country: 'DE' })
    expect(html).not.toContain('Dein Stripe-Konto wird in')
    expect(html).not.toContain('href="/settings/profile"')
  })
})
