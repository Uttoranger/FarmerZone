/**
 * Die Zahl der wartenden Höfe für die Gründungs-Bausteine der Seiten
 * (zaehleGruendungSeiten hinter gruendungFuerSeiten, Register N21, Nr. 119):
 * Die Abfrage zählt wartende, nicht stillgelegte Höfe OHNE Testhof — das
 * `where` steht hier exakt, damit kein Feld verloren geht oder dazukommt.
 * Gegenprobe: ohne `istTesthof: false` ist der Test rot.
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))
vi.mock('next/navigation', () => ({ unstable_rethrow: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    farm: { count: vi.fn(async () => 2) },
    plattformEinstellung: { findUnique: vi.fn(async () => null) },
  },
}))
vi.mock('@/server/queries/admin', () => ({ ladeHoefeFuerGruendung: vi.fn(async () => []), ladeHoefeFuerFestschreiben: vi.fn() }))

import * as Sentry from '@sentry/nextjs'
import { prisma } from '@/lib/prisma'
import { gruendungFuerSeiten } from '@/server/queries/plattform-einstellung'

describe('zaehleGruendungSeiten — wartende Höfe ohne Testhof', () => {
  it('zählt genau mit { approvedAt: null, archivedAt: null, istTesthof: false }', async () => {
    await gruendungFuerSeiten(new Date('2026-10-01T08:00:00.000Z'))
    expect(Sentry.captureException).not.toHaveBeenCalled()
    expect(prisma.farm.count).toHaveBeenCalledTimes(1)
    expect(prisma.farm.count).toHaveBeenCalledWith({ where: { approvedAt: null, archivedAt: null, geschlossenAm: null, istTesthof: false } })
  })
})
