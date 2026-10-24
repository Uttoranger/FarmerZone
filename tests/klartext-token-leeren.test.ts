/**
 * Bar-Token nur als Hash (Register S17, Ergänzung 24.10.2026; Nachtlauf 24, Nr. 164, Punkt 6).
 *
 * Beweist (Attrappen; die echte Datenbank prüft tests/integration/bar-link-hash.int.test.ts):
 *  - Das Aufräumen setzt `confirmationToken` mit EINEM updateMany auf null, für Werte
 *    ungleich null OHNE das Präfix des Hashs — nie ein Löschen, nie ein anderer Wert.
 *  - Die Bedingung nimmt das Präfix aus der einen Quelle (BAR_HASH_PRAEFIX).
 *  - Die Zahl kommt im Ergebnis an.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => {
  const nichts = { count: 0 }
  return {
    updateMany: vi.fn(async (...args: unknown[]) => ({ count: args.length * 0 + 3 })),
    nichts,
  }
})
vi.mock('@/lib/prisma', () => ({
  prisma: {
    session: { deleteMany: vi.fn(async () => m.nichts) },
    verification: { deleteMany: vi.fn(async () => m.nichts) },
    webhookEvent: { deleteMany: vi.fn(async () => m.nichts) },
    betriebMessung: { deleteMany: vi.fn(async () => m.nichts) },
    einmalLink: { deleteMany: vi.fn(async () => m.nichts) },
    order: { updateMany: m.updateMany },
    // Seit Nr. 158 räumt raeumeAltesAuf auch das Mail-Protokoll auf; eigene Attrappe, damit
    // m.updateMany nur das Leeren der Klartext-Token zählt.
    mailAuftrag: { deleteMany: vi.fn(async () => m.nichts), updateMany: vi.fn(async () => m.nichts) },
  },
}))

import { raeumeAltesAuf } from '@/server/aufraeumen'
import { BAR_HASH_PRAEFIX, barTokenHash } from '@/lib/bar-bestaetigung'

beforeEach(() => vi.clearAllMocks())

describe('Aufräumen: Klartext-Token leeren', () => {
  it('ein updateMany auf Order: nur confirmationToken wird null, für Werte ohne das Präfix des Hashs', async () => {
    const ergebnis = await raeumeAltesAuf(new Date('2026-10-24T03:00:00Z'))

    expect(m.updateMany).toHaveBeenCalledTimes(1)
    expect(m.updateMany.mock.calls[0]![0]).toEqual({
      where: { confirmationToken: { not: null }, NOT: { confirmationToken: { startsWith: BAR_HASH_PRAEFIX } } },
      data: { confirmationToken: null },
    })
    expect(ergebnis.klartextTokens).toBe(3)
  })

  it('Gegenprobe: ein echter Hash trägt das Präfix und fiele nie in die Bedingung', () => {
    expect(barTokenHash('V1StGXR8_Z5jdHi6BmyT9pqLnv2wYc4k').startsWith(BAR_HASH_PRAEFIX)).toBe(true)
    expect(BAR_HASH_PRAEFIX).toBe('h1:')
  })
})
