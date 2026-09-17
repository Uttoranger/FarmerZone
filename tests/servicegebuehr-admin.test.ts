/**
 * Tests für setServiceFeeAction (src/server/actions/admin.ts, Sprint
 * servicegebuehr Teil E) — am echten Code, Prisma/Auth/Mail gemockt.
 *
 * Beweist: ohne isAdmin wirkt nichts (auch mit gültiger Session, auch mit
 * isAdmin in der Session — das Recht kommt aus der DB); gültige Eingabe
 * schreibt Prozent, Mindestgebühr und „gilt ab" als Wiener Mitternacht; leer =
 * gebührenfrei (null); ungültige Werte werden abgelehnt; jede Änderung wird
 * außerhalb der Produktion mit Zeitstempel und Admin-ID protokolliert.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendFreischaltungEmail: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    farm: { findUnique: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}))

import { setServiceFeeAction } from '@/server/actions/admin'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const getSession = vi.mocked(auth.api.getSession)
const userFindUnique = vi.mocked(prisma.user.findUnique)
const farmFindUnique = vi.mocked(prisma.farm.findUnique)
const farmUpdate = vi.mocked(prisma.farm.update)

const GUELTIG = { percent: '4.9', minCents: 50, activeFrom: '2026-10-01' }

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue({ user: { id: 'admin_1' } } as never)
  userFindUnique.mockResolvedValue({ isAdmin: true } as never)
  farmFindUnique.mockResolvedValue({ slug: 'welszucht' } as never)
  farmUpdate.mockResolvedValue({} as never)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('setServiceFeeAction — Zugriff', () => {
  it('ohne Session: abgelehnt, nichts geschrieben', async () => {
    getSession.mockResolvedValue(null as never)
    const result = await setServiceFeeAction('farm_1', GUELTIG)
    expect(result.error).toBe('Nicht angemeldet.')
    expect(farmUpdate).not.toHaveBeenCalled()
  })

  it('ohne isAdmin: abgelehnt, obwohl eine gültige Session besteht', async () => {
    userFindUnique.mockResolvedValue({ isAdmin: false } as never)
    const result = await setServiceFeeAction('farm_1', GUELTIG)
    expect(result.error).toBe('Kein Zugriff.')
    expect(farmUpdate).not.toHaveBeenCalled()
  })

  it('das Recht kommt aus der Datenbank, nicht aus der Session', async () => {
    getSession.mockResolvedValue({ user: { id: 'user_1', isAdmin: true } } as never)
    userFindUnique.mockResolvedValue({ isAdmin: false } as never)
    const result = await setServiceFeeAction('farm_1', GUELTIG)
    expect(result.error).toBe('Kein Zugriff.')
    expect(farmUpdate).not.toHaveBeenCalled()
  })

  it('unbekannter Hof: Fehler statt stillem Nichts', async () => {
    farmFindUnique.mockResolvedValue(null)
    const result = await setServiceFeeAction('farm_weg', GUELTIG)
    expect(result.error).toBe('Hof nicht gefunden.')
    expect(farmUpdate).not.toHaveBeenCalled()
  })
})

describe('setServiceFeeAction — Schreiben', () => {
  it('speichert Prozent, Mindestgebühr und „gilt ab" als Wiener Mitternacht', async () => {
    const result = await setServiceFeeAction('farm_1', GUELTIG)
    expect(result).toEqual({})
    expect(farmUpdate).toHaveBeenCalledWith({
      where: { id: 'farm_1' },
      data: {
        serviceFeePercent: 4.9,
        serviceFeeMinCents: 50,
        // 1. Oktober 2026, 00:00 Wien (Sommerzeit) = 30.9. 22:00 UTC
        serviceFeeActiveFrom: new Date('2026-09-30T22:00:00.000Z'),
      },
    })
  })

  it('leeres Datum = gebührenfrei (null), Prozent und Mindestgebühr bleiben gespeichert', async () => {
    await setServiceFeeAction('farm_1', { percent: 4.9, minCents: 50, activeFrom: '' })
    expect(farmUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { serviceFeePercent: 4.9, serviceFeeMinCents: 50, serviceFeeActiveFrom: null },
      })
    )
  })

  it('nimmt Zahlen wie Text (Formularfelder) und rundet nichts still', async () => {
    await setServiceFeeAction('farm_1', { percent: '10', minCents: '200', activeFrom: null })
    expect(farmUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { serviceFeePercent: 10, serviceFeeMinCents: 200, serviceFeeActiveFrom: null },
      })
    )
  })

  it('protokolliert außerhalb der Produktion Zeitstempel, Admin-ID und Hof', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    await setServiceFeeAction('farm_1', GUELTIG)
    const zeile = log.mock.calls.map((c) => String(c[0])).find((z) => z.includes('Servicegebühr geändert'))
    expect(zeile).toBeDefined()
    expect(zeile).toContain('admin=admin_1')
    expect(zeile).toContain('farm=farm_1')
    expect(zeile).toContain('percent=4.9')
    expect(zeile).toContain('minCents=50')
    expect(zeile).toContain('activeFrom=2026-09-30T22:00:00.000Z')
    expect(zeile).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })
})

describe('setServiceFeeAction — Validierung', () => {
  it.each([
    [{ ...GUELTIG, percent: '101' }, 'Prozentsatz darf höchstens 100 sein'],
    [{ ...GUELTIG, percent: '-1' }, 'Prozentsatz darf nicht negativ sein'],
    [{ ...GUELTIG, percent: '4.999' }, 'Höchstens zwei Nachkommastellen'],
    [{ ...GUELTIG, percent: 'abc' }, 'Prozentsatz muss eine Zahl sein'],
    [{ ...GUELTIG, minCents: 12.5 }, 'Mindestgebühr in ganzen Cent'],
    [{ ...GUELTIG, minCents: -1 }, 'Mindestgebühr darf nicht negativ sein'],
    [{ ...GUELTIG, activeFrom: '01.10.2026' }, 'Datum als JJJJ-MM-TT'],
    [{ ...GUELTIG, activeFrom: '2026-13-40' }, 'Ungültiges Datum.'],
  ])('lehnt %j ab: %s', async (eingabe, meldung) => {
    const result = await setServiceFeeAction('farm_1', eingabe)
    expect(result.error).toBe(meldung)
    expect(farmUpdate).not.toHaveBeenCalled()
  })
})
