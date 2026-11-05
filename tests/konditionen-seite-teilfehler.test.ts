/**
 * „Deine Konditionen“ (/settings/konditionen): Gebührenlage als eigener Teil
 * (Nr. 224, Lauf 30, Nachbesserung Runde 1).
 *
 * Ursache: Plattform-Einstellung und Satz des Hofs standen im selben
 * Promise.all wie der Hof — scheiterte nur die Einstellung, fiel die ganze
 * Seite auf „konnte nicht geladen werden“.
 *
 * Beweist:
 *  - Scheitert das Lesen der Plattform-Einstellung, steht die Seite mit Stand
 *    und Tarifen, ohne Rechenbeispiel, ohne „So rechnen wir ab“ und ohne
 *    „Stand:“ — und nie als Fassung „bisher“ (kein „Servicegebühr“). Der
 *    Fehler geht mit eigenem Teil an Sentry.
 *  - Gegenprobe: Gelingt das Lesen, stehen Rechenbeispiel und Stand da.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode; [k: string]: unknown }) => {
    const attribute = { ...rest }
    delete attribute.prefetch
    return createElement('a', { href, ...attribute }, children)
  },
}))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((ziel: string) => {
    throw new Error(`redirect:${ziel}`)
  }),
  usePathname: () => '/settings/konditionen',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('@/server/hofbereich', () => ({ verlangeHofDerSitzung: vi.fn(async () => ({ userId: 'nutzer_1', farmId: 'hof_1' })) }))
vi.mock('@/server/queries/einstellungen', () => ({ ladeKonditionenHof: vi.fn() }))
vi.mock('@/server/queries/farm', () => ({ ladeAbzeichenSchalter: vi.fn(async () => null) }))
vi.mock('@/server/queries/plattformgebuehr', () => ({ ladeBarzahlung: vi.fn(async () => null) }))
vi.mock('@/server/actions/abzeichen', () => ({ setzeAbzeichenSichtbar: vi.fn() }))
vi.mock('@/components/hof-einstellungen/barzahlung', () => ({ Barzahlung: () => null }))
vi.mock('@/lib/prisma', () => ({ prisma: { farm: { findUnique: vi.fn(async () => ({ id: 'hof_1' })) } } }))
vi.mock('@/server/queries/plattform-einstellung', () => ({
  HOF_FUER_GEBUEHR_LAGE: { id: true },
  lesePlattformEinstellung: vi.fn(),
  ladeGebuehrLage: vi.fn(),
}))

import * as Sentry from '@sentry/nextjs'
import KonditionenEinstellungenPage from '@/app/(hof)/settings/konditionen/page'
import { ladeKonditionenHof } from '@/server/queries/einstellungen'
import { ladeGebuehrLage, lesePlattformEinstellung } from '@/server/queries/plattform-einstellung'
import type { KonditionenHof } from '@/lib/hof-einstellungen'

const HOF: KonditionenHof = {
  tarif: null,
  serviceFeePercent: '5',
  serviceFeeMinCents: 50,
  serviceFeeActiveFrom: new Date('2026-01-01T00:00:00Z'),
  platformFeePercent: '0',
  gruendungBis: null,
  produkteImShop: 9,
  abholzeitenJeWoche: 3,
}

async function seite(): Promise<string> {
  return renderToStaticMarkup(await KonditionenEinstellungenPage())
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(ladeKonditionenHof).mockResolvedValue(HOF)
})

describe('„Deine Konditionen“: scheitert nur die Plattform-Einstellung, bleibt die Seite', () => {
  it('ohne Rechenbeispiel, Abrechnung und Stand — und nie als Fassung „bisher“', async () => {
    vi.mocked(lesePlattformEinstellung).mockRejectedValue(new Error('Einstellung nicht lesbar'))
    const markup = await seite()
    expect(markup).toContain('Deine Konditionen')
    expect(markup).not.toContain('konnte')
    expect(markup).not.toContain('Rechenbeispiel')
    expect(markup).not.toContain('So rechnen wir ab')
    expect(markup).not.toContain('Stand:')
    expect(markup).not.toContain('Servicegebühr')
    expect(vi.mocked(Sentry.captureException)).toHaveBeenCalledWith(expect.any(Error), {
      tags: { bereich: 'einstellungen', seite: 'konditionen', teil: 'gebuehr' },
    })
  })

  it('Gegenprobe: gelingt das Lesen, stehen Rechenbeispiel, Abrechnung und Stand da', async () => {
    vi.mocked(lesePlattformEinstellung).mockResolvedValue({ hofpreisModellAb: '2027-02-01T00:00:00+01:00' } as never)
    vi.mocked(ladeGebuehrLage).mockResolvedValue({
      modell: 'hofpreis',
      hundertstel: 600,
      einzugAb: new Date('2027-02-01T00:00:00+01:00'),
      barMandatPflicht: true,
      sepaMandatAm: new Date('2027-01-15T00:00:00+01:00'),
    })
    const markup = (await seite()).replace(/ /g, ' ')
    expect(markup).toContain('Rechenbeispiel')
    expect(markup).toContain('So rechnen wir ab')
    expect(markup).toContain('Stand: 1. Februar 2027')
    expect(markup).not.toContain('Servicegebühr')
    expect(vi.mocked(Sentry.captureException)).not.toHaveBeenCalled()
  })
})
