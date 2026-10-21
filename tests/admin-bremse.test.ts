/**
 * Die Bremse der Admin-Anmeldung, fail-closed (Register N20, Nr. 126;
 * Nacharbeit zu Nr. 115) — EIN Helfer für die Anmeldung mit Ersatzcode
 * (src/lib/auth.ts) und den E-Mail-Code der Einrichtung
 * (src/server/actions/admin-anmeldung.ts); vorher stand er zweimal wörtlich.
 *
 * Beweist (Datenbank-Zählung und Sentry gemockt, Zeit gestellt):
 *  - innerhalb der Grenze gilt die Bremse als nicht voll, jenseits als voll;
 *  - ein Datenbank-Fehler ergibt „gesperrt“ — nie „offen“ — und geht ohne
 *    Merkmal (Adresse, Konto, Schlüssel) nach Sentry, nur mit Art und Zweck;
 *  - antwortet die Datenbank nicht innerhalb der Frist, gilt sie als voll;
 *  - die beiden Aufrufer benutzen den Helfer und haben keine zweite Fassung.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const sentry = vi.hoisted(() => ({ captureException: vi.fn() }))
vi.mock('@sentry/nextjs', () => sentry)
const zaehle = vi.hoisted(() => ({ zaehleVersuche: vi.fn() }))
vi.mock('@/server/bremse-datenbank', () => zaehle)

import { DB_BREMSEN, DB_BREMSE_ZEITLIMIT_MS } from '@/lib/bremse-datenbank'
import { adminBremseVoll } from '@/server/admin-bremse'

const BREMSE = DB_BREMSEN.adminEinrichtungscode
const MERKMAL = 'merkmal-nur-buchstaben'

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('adminBremseVoll', () => {
  it('lässt durch, solange der Zähler die Grenze nicht übersteigt (genau max zählt noch)', async () => {
    zaehle.zaehleVersuche.mockResolvedValue([BREMSE.max])

    expect(await adminBremseVoll(BREMSE, MERKMAL)).toBe(false)
    expect(zaehle.zaehleVersuche).toHaveBeenCalledWith([{ bremse: BREMSE, merkmal: MERKMAL }])
  })

  it('ist voll, sobald der Zähler die Grenze übersteigt', async () => {
    zaehle.zaehleVersuche.mockResolvedValue([BREMSE.max + 1])

    expect(await adminBremseVoll(BREMSE, MERKMAL)).toBe(true)
    expect(sentry.captureException).not.toHaveBeenCalled()
  })

  it('ein Datenbank-Fehler ergibt „gesperrt“ und geht ohne Merkmal nach Sentry', async () => {
    zaehle.zaehleVersuche.mockRejectedValue(new Error(`Verbindung zu ${MERKMAL} abgebrochen`))

    expect(await adminBremseVoll(BREMSE, MERKMAL)).toBe(true)

    expect(sentry.captureException).toHaveBeenCalledTimes(1)
    const [fehler, kontext] = sentry.captureException.mock.calls[0] as [Error, { level: string; tags: Record<string, string> }]
    expect(kontext).toEqual({ level: 'warning', tags: { aufgabe: 'admin-bremse', zweck: BREMSE.zweck } })
    // Nur die Klasse des Fehlers, nie sein Text — der trüge Merkmal oder Adresse des Datenbank-Servers.
    expect(fehler.name).toBe('Error')
    expect(JSON.stringify([fehler.message, fehler.name, kontext])).not.toContain(MERKMAL)
  })

  it('antwortet die Datenbank nicht innerhalb der Frist, gilt die Bremse als voll', async () => {
    zaehle.zaehleVersuche.mockReturnValue(new Promise(() => undefined))

    const ergebnis = adminBremseVoll(BREMSE, MERKMAL)
    await vi.advanceTimersByTimeAsync(DB_BREMSE_ZEITLIMIT_MS)

    expect(await ergebnis).toBe(true)
    expect(sentry.captureException).toHaveBeenCalledTimes(1)
  })

  it('räumt die Frist auf, wenn die Datenbank rechtzeitig antwortet', async () => {
    zaehle.zaehleVersuche.mockResolvedValue([1])

    expect(await adminBremseVoll(BREMSE, MERKMAL)).toBe(false)

    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('keine zweite Fassung', () => {
  const lies = (pfad: string): string => readFileSync(join(process.cwd(), pfad), 'utf8')

  it('src/lib/auth.ts und die Actions der Admin-Anmeldung rufen den Helfer und zählen nicht selbst', () => {
    for (const pfad of ['src/lib/auth.ts', 'src/server/actions/admin-anmeldung.ts']) {
      const quelle = lies(pfad)
      expect(quelle, pfad).toContain("from '@/server/admin-bremse'")
      expect(quelle, pfad).not.toContain('DB_BREMSE_ZEITLIMIT_MS')
      expect(quelle, pfad).not.toContain('zaehleVersuche')
    }
  })

  it('Gegenprobe: der Helfer selbst zählt mit zaehleVersuche und der Frist', () => {
    const quelle = lies('src/server/admin-bremse.ts')
    expect(quelle).toContain('zaehleVersuche')
    expect(quelle).toContain('DB_BREMSE_ZEITLIMIT_MS')
  })
})
