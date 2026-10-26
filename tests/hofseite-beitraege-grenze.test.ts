/**
 * Die Fünfer-Grenze der Beiträge auf der Hofseite (Register F8, Nr. 68) in der
 * schnellen Suite — bisher prüfte sie nur der Integrationstest
 * (tests/integration/hofseite-beitraege.int.test.ts, Nacharbeit in Nr. 75).
 * Die Anzeige kürzt nicht (hofseite-kunde.tsx): Die Hofseite fragt mit
 * HOFSEITE_BEITRAEGE_MAX, und die Abfrage gibt die Grenze als `take` an die
 * Datenbank weiter. Wie viele dann kommen, sagt die Datenbank — das bleibt
 * Sache des Integrationstests.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: { statusPost: { findMany: vi.fn(async () => []) } } }))

import { prisma } from '@/lib/prisma'
import { HOFSEITE_BEITRAEGE_MAX } from '@/lib/hofseite-kunde'
import { getActiveStatusPosts } from '@/server/queries/status-posts'

describe('Beiträge der Hofseite: höchstens fünf (F8)', () => {
  it('die Hofseite fragt mit der Grenze, und die Abfrage reicht fünf als take an die Datenbank', async () => {
    const seite = readFileSync(join(process.cwd(), 'src', 'server', 'hofseite-beitraege.ts'), 'utf8')
    expect(seite).toContain('getActiveStatusPosts(farmId, HOFSEITE_BEITRAEGE_MAX)')

    await getActiveStatusPosts('farm_test', HOFSEITE_BEITRAEGE_MAX)

    // Die Bedingung „aktiv“ steht seit Nr. 128 an EINER Stelle (AKTIVER_BEITRAG), als Element der AND-Liste.
    expect(vi.mocked(prisma.statusPost.findMany).mock.calls[0]?.[0]).toMatchObject({ take: 5, where: { farmId: 'farm_test', AND: [{ showOnFarmPage: true }] } })
  })
})
