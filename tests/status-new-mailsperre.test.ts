/**
 * Die Seite „Neuer Beitrag" fragt die Mail-Sperre mit derselben Bedingung
 * wie die Action (mailSperreWo, Nr. 149) und demselben Zeitpunkt, den sie
 * dem Assistenten gibt. Vorher rechnete sie die Sperre selbst (nur
 * `sentViaEmail`) — ein Beitrag ohne angenommene Mail hätte den Schalter
 * abgestellt, obwohl die Action den Versand erlaubt.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement } from 'react'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn(async () => ({ user: { id: 'user_1' } })) } } }))
vi.mock('@/server/queries/dashboard', () => ({ getFarmForUser: vi.fn(async () => ({ id: 'farm_1' })) }))
vi.mock('@/server/queries/status-posts', () => ({ getStatusTemplate: vi.fn(async () => null) }))
vi.mock('@/components/hofbereich/unterseiten-kopf', () => ({ UnterseitenKopf: () => null }))
vi.mock('@/app/(hof)/status/new/status-new-client', () => ({ StatusNewClient: () => createElement('div') }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    product: { findMany: vi.fn(async () => []) },
    customerFarmSubscription: { count: vi.fn(async () => 2) },
    statusPost: { findFirst: vi.fn() },
  },
}))

import StatusNewPage from '@/app/(hof)/status/new/page'
import { prisma } from '@/lib/prisma'
import { mailSperreWo } from '@/lib/beitrag-mailabstand'

const JETZT = new Date('2026-10-23T08:00:00.000Z')

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ now: JETZT, toFake: ['Date'] })
})

describe('Seite „Neuer Beitrag" — Mail-Sperre', () => {
  it('fragt mailSperreWo mit dem Zeitpunkt der Seite und gibt den Fund an den Assistenten', async () => {
    const frueher = new Date('2026-10-21T08:00:00.000Z')
    vi.mocked(prisma.statusPost.findFirst).mockResolvedValue({ publishedAt: frueher } as never)

    const seite = (await StatusNewPage({ searchParams: Promise.resolve({}) })) as { props: { children: { props: Record<string, unknown> }[] } }

    expect(vi.mocked(prisma.statusPost.findFirst).mock.calls[0]![0]).toMatchObject({ where: mailSperreWo('farm_1', JETZT) })
    const props = seite.props.children[1]!.props
    expect(props).toMatchObject({ recentEmailSentAt: frueher.toISOString(), jetzt: JETZT.toISOString(), emailCount: 2 })
  })

  it('Gegenprobe: ohne Fund bleibt der Schalter frei (recentEmailSentAt null)', async () => {
    vi.mocked(prisma.statusPost.findFirst).mockResolvedValue(null as never)
    const seite = (await StatusNewPage({ searchParams: Promise.resolve({}) })) as { props: { children: { props: Record<string, unknown> }[] } }
    expect(seite.props.children[1]!.props.recentEmailSentAt).toBeNull()
  })
})
