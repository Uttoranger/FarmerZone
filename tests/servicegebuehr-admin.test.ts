/**
 * Tests für setServiceFeeAction (src/server/actions/admin.ts, Sprint
 * servicegebuehr Teil E) — am echten Code, Prisma/Auth/Mail gemockt.
 *
 * Beweist: ohne isAdmin wirkt nichts (auch mit gültiger Session, auch mit
 * isAdmin in der Session — das Recht kommt aus der DB); gültige Eingabe
 * schreibt Prozent, Mindestgebühr und „gilt ab" als Wiener Mitternacht; leer =
 * gebührenfrei (null); ungültige Werte werden mit einem deutschen Satz
 * abgelehnt (Prozent nur als Zahl, Nr. 35); jede Änderung wird
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
import {
  EINSTELLUNG_UNGUELTIG,
  GILT_AB_UNGUELTIG,
  MINDESTGEBUEHR_GANZE_CENT,
  MINDESTGEBUEHR_KEINE_ZAHL,
  MINDESTGEBUEHR_MAX_CENTS,
  MINDESTGEBUEHR_NEGATIV,
  MINDESTGEBUEHR_ZU_HOCH,
  PROZENT_UNGUELTIG,
} from '@/schemas/servicegebuehr'
import { MINDESTGEBUEHR_UNGUELTIG } from '@/lib/admin-hoefe'
import { centsAlsEuro, formatEuro } from '@/lib/format'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const getSession = vi.mocked(auth.api.getSession)
const userFindUnique = vi.mocked(prisma.user.findUnique)
const farmFindUnique = vi.mocked(prisma.farm.findUnique)
const farmUpdate = vi.mocked(prisma.farm.update)

const GUELTIG = { percent: 4.9, minCents: 50, activeFrom: '2026-10-01' }

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

  it('nimmt den Prozentsatz als Zahl und rundet nichts still', async () => {
    await setServiceFeeAction('farm_1', { percent: 10, minCents: 200, activeFrom: null })
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
    [{ ...GUELTIG, percent: 101 }, PROZENT_UNGUELTIG],
    [{ ...GUELTIG, percent: -1 }, PROZENT_UNGUELTIG],
    [{ ...GUELTIG, percent: 4.999 }, PROZENT_UNGUELTIG],
    // Nr. 35: Der Prozentsatz kommt nur als Zahl. Text las z.coerce vorher
    // still („" als 0 %, „1e1" als 10 %), und die erste Zod-Meldung ging
    // ungefiltert an die Oberfläche.
    [{ ...GUELTIG, percent: 'abc' }, PROZENT_UNGUELTIG],
    [{ ...GUELTIG, percent: '4.9' }, PROZENT_UNGUELTIG],
    [{ ...GUELTIG, percent: '' }, PROZENT_UNGUELTIG],
    [{ ...GUELTIG, percent: '1e1' }, PROZENT_UNGUELTIG],
    [{ ...GUELTIG, percent: null }, PROZENT_UNGUELTIG],
    [{ ...GUELTIG, percent: true }, PROZENT_UNGUELTIG],
    [{ ...GUELTIG, percent: Number.NaN }, PROZENT_UNGUELTIG],
    [{ ...GUELTIG, percent: Number.POSITIVE_INFINITY }, PROZENT_UNGUELTIG],
    // Nr. 47: jede Ablehnung der Mindestgebühr geduzt, mit Punkt und Ausweg.
    [{ ...GUELTIG, minCents: 12.5 }, MINDESTGEBUEHR_GANZE_CENT],
    [{ ...GUELTIG, minCents: -1 }, MINDESTGEBUEHR_NEGATIV],
    [{ ...GUELTIG, minCents: MINDESTGEBUEHR_MAX_CENTS + 1 }, MINDESTGEBUEHR_ZU_HOCH],
    // Nr. 32, Runde 1: Die Mindestgebühr kommt nur als ganze Cent-Zahl. Text
    // las z.coerce vorher still als Cent („1e2" → 100 Cent, „" → 0).
    [{ ...GUELTIG, minCents: '200' }, MINDESTGEBUEHR_KEINE_ZAHL],
    [{ ...GUELTIG, minCents: '1e2' }, MINDESTGEBUEHR_KEINE_ZAHL],
    [{ ...GUELTIG, minCents: '' }, MINDESTGEBUEHR_KEINE_ZAHL],
    [{ ...GUELTIG, minCents: '0,50' }, MINDESTGEBUEHR_KEINE_ZAHL],
    [{ ...GUELTIG, minCents: true }, MINDESTGEBUEHR_KEINE_ZAHL],
    [{ ...GUELTIG, minCents: null }, MINDESTGEBUEHR_KEINE_ZAHL],
    [{ ...GUELTIG, minCents: Number.NaN }, MINDESTGEBUEHR_KEINE_ZAHL],
    [{ ...GUELTIG, activeFrom: '01.10.2026' }, GILT_AB_UNGUELTIG],
    [{ ...GUELTIG, activeFrom: '2026-13-40' }, GILT_AB_UNGUELTIG],
    // Kein Text: Vorher stand hier Zods englische Standardmeldung.
    [{ ...GUELTIG, activeFrom: 20261001 }, GILT_AB_UNGUELTIG],
    [{ ...GUELTIG, activeFrom: { tag: '2026-10-01' } }, GILT_AB_UNGUELTIG],
  ])('lehnt %j ab: %s', async (eingabe, meldung) => {
    const result = await setServiceFeeAction('farm_1', eingabe)
    expect(result.error).toBe(meldung)
    expect(farmUpdate).not.toHaveBeenCalled()
  })

  // Nachbesserung Runde 1: Ohne Feld (Eingabe kein Objekt) kam Zods englischer
  // Standardsatz durch. Nur die Mindestgebühr gibt ihre eigene Schema-Meldung weiter.
  it.each([
    ['null', null],
    ['Text', 'percent=5'],
    ['Zahl', 42],
    ['Liste', [4.9, 50, '2026-10-01']],
  ])('Eingabe kein Objekt (%s) → fester deutscher Satz, nichts geschrieben', async (_fall, eingabe) => {
    const result = await setServiceFeeAction('farm_1', eingabe as never)
    expect(result.error).toBe(EINSTELLUNG_UNGUELTIG)
    expect(result.error).not.toMatch(/Invalid|expected|received/)
    expect(farmUpdate).not.toHaveBeenCalled()
  })

  it('die höchste Mindestgebühr ist noch erlaubt, der Satz darüber nennt sie im Anzeigeformat', async () => {
    expect(await setServiceFeeAction('farm_1', { ...GUELTIG, minCents: MINDESTGEBUEHR_MAX_CENTS })).toEqual({})
    expect(farmUpdate).toHaveBeenCalledTimes(1)
    expect(MINDESTGEBUEHR_ZU_HOCH).toContain(formatEuro(centsAlsEuro(MINDESTGEBUEHR_MAX_CENTS)))
    // Auch die Untergrenze im Anzeigeformat, nicht von Hand (Nachbesserung 1).
    expect(MINDESTGEBUEHR_NEGATIV).toContain(formatEuro(0))
  })

  it('die Sätze zur Mindestgebühr sind geduzt, enden mit einem Punkt und nennen einen Ausweg', () => {
    for (const satz of [MINDESTGEBUEHR_KEINE_ZAHL, MINDESTGEBUEHR_GANZE_CENT, MINDESTGEBUEHR_NEGATIV, MINDESTGEBUEHR_ZU_HOCH]) {
      expect(satz).toMatch(/^[A-ZÄÖÜ].*\.$/)
      // Ausweg: eine Handlung, die die Admin-Person jetzt tun kann.
      expect(satz).toMatch(/\b(?:Gib|Lass)\b/)
      expect(satz).not.toMatch(/Invalid|expected|received|muss eine Zahl sein|zu hoch$/)
    }
    // Eine Quelle: Der Dialog sagt bei unlesbarem Text denselben Satz wie der Server.
    expect(MINDESTGEBUEHR_UNGUELTIG).toBe(MINDESTGEBUEHR_KEINE_ZAHL)
  })

  it('die Sätze für Prozent, Datum und Eingabe sind deutsch, geduzt und enden mit einem Punkt', () => {
    expect(EINSTELLUNG_UNGUELTIG).toMatch(/Lade die Seite neu/)
    for (const satz of [PROZENT_UNGUELTIG, GILT_AB_UNGUELTIG, EINSTELLUNG_UNGUELTIG]) {
      expect(satz).toMatch(/^[A-ZÄÖÜ].*\.$/)
      expect(satz).toMatch(/\b(?:Gib|Wähle|du|dein|Lade|versuch)\b/)
      expect(satz).not.toMatch(/Invalid|expected|received/)
    }
  })
})
