/**
 * Nr. 263: Eine Kurznummer im Admin-Eingang (/admin/meldungen/<nr> → ?meldung=<nr>), die zu mehreren Meldungen
 * passt, öffnet keine beliebige, sondern zeigt den Satz KURZNUMMER_MEHRDEUTIG — ohne Kennungen, ohne Anzahl.
 * Gegenprobe: Eine Nummer, die zu nichts passt, zeigt weiter den Leerzustand „Wähl einen Eintrag …“.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'

vi.mock('next/link', () => ({ default: ({ children }: { children: React.ReactNode }) => children, useLinkStatus: () => ({ pending: false }) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }), usePathname: () => '/admin/postfach', useSearchParams: () => new URLSearchParams() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/server/queries/postfach', () => ({ ladeEingang: vi.fn(async () => ({})), ladeFadenAdmin: vi.fn() }))
vi.mock('@/server/queries/admin', () => ({ getAdminFarms: vi.fn() }))
vi.mock('@/server/queries/meldung', () => ({ getDuplikateVon: vi.fn(), getMeldungDetail: vi.fn(), getWunschCluster: vi.fn(async () => []) }))
vi.mock('@/lib/postfach', async (original) => ({ ...(await original<typeof import('@/lib/postfach')>()), eingangEintraege: vi.fn(() => []) }))

import { getDuplikateVon, getMeldungDetail } from '@/server/queries/meldung'
import { EingangReiter, ladeEingangReiter } from '@/app/admin/postfach/eingang-reiter'
import { KURZNUMMER_MEHRDEUTIG } from '@/lib/kurznummer'
import { EINGANG_TEXT } from '@/lib/postfach'

const JETZT = new Date('2026-11-08T10:00:00Z')

beforeEach(() => {
  vi.clearAllMocks()
})

async function eingang(nummer: string): Promise<string> {
  const daten = await ladeEingangReiter('meldung' as never, { art: 'meldung', id: nummer }, JETZT)
  return renderToStaticMarkup(createElement(EingangReiter, { daten, jetzt: JETZT }))
}

describe('Admin-Eingang: Kurznummer zu mehreren Meldungen', () => {
  it('zeigt den Satz statt einer beliebigen Meldung', async () => {
    vi.mocked(getMeldungDetail).mockResolvedValue({ art: 'mehrdeutig' })
    const html = await eingang('4F8M2Q')
    expect(html).toContain(KURZNUMMER_MEHRDEUTIG)
    expect(html).not.toContain(EINGANG_TEXT.waehlen)
    expect(getDuplikateVon).not.toHaveBeenCalled()
  })

  it('Gegenprobe: eine Nummer ohne Treffer zeigt den Leerzustand, nicht den Satz', async () => {
    vi.mocked(getMeldungDetail).mockResolvedValue({ art: 'keine' })
    const html = await eingang('ZZZZZZ')
    expect(html).toContain(EINGANG_TEXT.waehlen)
    expect(html).not.toContain(KURZNUMMER_MEHRDEUTIG)
  })
})
