/**
 * Das Gründungs-Enddatum je Hof im Admin (Nr. 62, Register K2): das Schema
 * src/schemas/gruendungshof.ts und setzeGruendungBisAction
 * (src/server/actions/admin.ts) — am echten Code, Prisma und Auth gemockt, die
 * Zeit fest.
 *
 * Beweist: ohne Admin-Recht aus der Datenbank wirkt nichts; ein Tag wird als
 * DATE-Wert (Mitternacht UTC) gespeichert, leer = Standard (null); ein Tag vor
 * dem heutigen WIENER Tag wird abgelehnt; ein früheres Ende als das bisher
 * wirksame (auch das Zurücksetzen auf einen früheren Standard) nur mit
 * Zustimmung des Hofs (K1); geschrieben wird bedingt auf den gelesenen Stand;
 * das Protokoll außerhalb der Produktion nennt den alten und den neuen Wert.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock('@/lib/prisma', async () => ({
  prisma: {
    farm: { findUnique: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
    // Die Wache liest seit Nr. 115 die Pflicht „erst Passkey“ (tests/admin-sitzung.ts).
    ...(await import('./admin-sitzung')).passkeyAttrappen(),
    user: { findUnique: vi.fn() },
    // Seit Nr. 116 liest die Platzvergabe die Einstellung mit (ohne Zeile: Standard, nicht festgeschrieben).
    plattformEinstellung: { findUnique: vi.fn(async () => null) },
  },
}))

import { revalidatePath } from 'next/cache'
import { setzeGruendungBisAction } from '@/server/actions/admin'
import {
  GRUENDUNG_BIS_GEAENDERT,
  GRUENDUNG_BIS_UNGUELTIG,
  GRUENDUNG_BIS_VERGANGEN,
  GRUENDUNG_BIS_ZUSTIMMUNG_FEHLT,
  gruendungBisSchema,
} from '@/schemas/gruendungshof'
import { EINSTELLUNG_UNGUELTIG } from '@/schemas/servicegebuehr'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { adminSitzung, alteAdminSitzung } from './admin-sitzung'
import { FRISCH_FEHLER } from '@/lib/admin-anmeldung'

const getSession = vi.mocked(auth.api.getSession)
const userFindUnique = vi.mocked(prisma.user.findUnique)
const farmFindUnique = vi.mocked(prisma.farm.findUnique)
const farmFindMany = vi.mocked(prisma.farm.findMany)
const farmUpdateMany = vi.mocked(prisma.farm.updateMany)

/** Montag, 12. Oktober 2026, 10:00 Uhr in Wien. */
const JETZT = new Date('2026-10-12T10:00:00+02:00')
const TAG = (kalendertag: string) => new Date(`${kalendertag}T00:00:00.000Z`)

/** Der Hof farm_1 auf Platz 1, mit seiner Spalte; dazu ein Hof davor auf keinem Platz (wartet). */
function stand(gruendungBis: Date | null, platzVorher = 0) {
  const davor = Array.from({ length: platzVorher }, (_, i) => ({
    id: `vor_${i}`,
    ownerId: `u_vor_${i}`,
    approvedAt: new Date(Date.UTC(2025, 0, i + 1)),
    createdAt: new Date(Date.UTC(2025, 0, i + 1)),
    archivedAt: null,
    gruendungBis: null,
  }))
  const eigener = {
    id: 'farm_1',
    ownerId: 'u_1',
    approvedAt: new Date('2026-03-01T10:00:00Z'),
    createdAt: new Date('2026-02-01T10:00:00Z'),
    archivedAt: null,
    gruendungBis,
  }
  farmFindUnique.mockResolvedValue({ slug: 'hof-test', gruendungBis } as never)
  farmFindMany.mockResolvedValue([...davor, eigener] as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(JETZT)
  getSession.mockResolvedValue(adminSitzung('admin_1') as never)
  userFindUnique.mockResolvedValue({ isAdmin: true } as never)
  farmUpdateMany.mockResolvedValue({ count: 1 } as never)
  stand(null)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('gruendungBisSchema — Tag oder Standard, nicht vor heute (Wien)', () => {
  it('nimmt einen Kalendertag ab heute und leer bzw. null als Standard', () => {
    const schema = gruendungBisSchema(JETZT)
    expect(schema.parse({ gruendungBis: '2026-10-12', bestaetigt: false })).toEqual({ gruendungBis: '2026-10-12', bestaetigt: false })
    expect(schema.parse({ gruendungBis: '', bestaetigt: true })).toEqual({ gruendungBis: null, bestaetigt: true })
    expect(schema.parse({ gruendungBis: null, bestaetigt: false })).toEqual({ gruendungBis: null, bestaetigt: false })
  })

  it('gestern ist vorbei — mit eigenem Satz', () => {
    const ergebnis = gruendungBisSchema(JETZT).safeParse({ gruendungBis: '2026-10-11', bestaetigt: false })
    expect(ergebnis.success).toBe(false)
    expect(ergebnis.error?.issues[0]?.message).toBe(GRUENDUNG_BIS_VERGANGEN)
  })

  it('Tagesgrenze Wien: um 0:30 Uhr ist der Vortag vorbei, obwohl in UTC noch sein Datum gilt', () => {
    const kurzVorMitternacht = new Date('2026-10-12T23:30:00+02:00')
    const kurzNachMitternacht = new Date('2026-10-13T00:30:00+02:00') // in UTC noch der 12.
    expect(gruendungBisSchema(kurzVorMitternacht).safeParse({ gruendungBis: '2026-10-12', bestaetigt: false }).success).toBe(true)
    expect(gruendungBisSchema(kurzNachMitternacht).safeParse({ gruendungBis: '2026-10-12', bestaetigt: false }).success).toBe(false)
  })

  it.each([['2027-02-30'], ['31.12.2027'], ['morgen'], [20271231], [{}]])('„%s" ist kein Tag', (wert) => {
    const ergebnis = gruendungBisSchema(JETZT).safeParse({ gruendungBis: wert, bestaetigt: false })
    expect(ergebnis.error?.issues[0]?.message).toBe(GRUENDUNG_BIS_UNGUELTIG)
  })
})

describe('setzeGruendungBisAction — Zugriff', () => {
  it('ohne Session: abgelehnt, nichts gelesen und nichts geschrieben', async () => {
    getSession.mockResolvedValue(null as never)
    expect(await setzeGruendungBisAction('farm_1', { gruendungBis: '2028-06-30', bestaetigt: false })).toEqual({ error: 'Nicht angemeldet.' })
    expect(farmFindUnique).not.toHaveBeenCalled()
    expect(farmUpdateMany).not.toHaveBeenCalled()
  })

  it('ohne Admin-Recht aus der Datenbank: abgelehnt, auch wenn die Session es behauptet', async () => {
    getSession.mockResolvedValue(adminSitzung('user_1', { isAdmin: true }) as never)
    userFindUnique.mockResolvedValue({ isAdmin: false } as never)
    expect(await setzeGruendungBisAction('farm_1', { gruendungBis: '2028-06-30', bestaetigt: false })).toEqual({ error: 'Kein Zugriff.' })
    expect(farmUpdateMany).not.toHaveBeenCalled()
  })

  it('ohne frische Bestätigung (N20, Ergänzung 23.10.2026): { error: frisch }, nichts gelesen und nichts geschrieben', async () => {
    getSession.mockResolvedValue(alteAdminSitzung('user_1') as never)
    expect(await setzeGruendungBisAction('farm_1', { gruendungBis: '2028-06-30', bestaetigt: false })).toEqual({ error: FRISCH_FEHLER })
    expect(farmFindUnique).not.toHaveBeenCalled()
    expect(farmUpdateMany).not.toHaveBeenCalled()
  })

  it('unbekannter Hof: Fehler statt stillem Nichts', async () => {
    farmFindUnique.mockResolvedValue(null)
    expect(await setzeGruendungBisAction('farm_weg', { gruendungBis: '2028-06-30', bestaetigt: false })).toEqual({ error: 'Hof nicht gefunden.' })
    expect(farmUpdateMany).not.toHaveBeenCalled()
  })
})

describe('setzeGruendungBisAction — Validierung', () => {
  it.each([
    [{ gruendungBis: '2026-10-11', bestaetigt: false }, GRUENDUNG_BIS_VERGANGEN],
    [{ gruendungBis: '2027-02-30', bestaetigt: false }, GRUENDUNG_BIS_UNGUELTIG],
    [{ gruendungBis: 20281231, bestaetigt: false }, GRUENDUNG_BIS_UNGUELTIG],
    [{ gruendungBis: '2028-06-30', bestaetigt: 'ja' }, EINSTELLUNG_UNGUELTIG],
    [{ gruendungBis: '2028-06-30' }, EINSTELLUNG_UNGUELTIG],
  ])('%j → eigener deutscher Satz, nichts geschrieben', async (eingabe, satz) => {
    expect(await setzeGruendungBisAction('farm_1', eingabe as { gruendungBis: unknown; bestaetigt: unknown })).toEqual({ error: satz })
    expect(farmUpdateMany).not.toHaveBeenCalled()
  })

  it('keine Eingabe als Objekt: fester Satz statt Zods englischem Text', async () => {
    expect(await setzeGruendungBisAction('farm_1', null as never)).toEqual({ error: EINSTELLUNG_UNGUELTIG })
  })
})

describe('setzeGruendungBisAction — Schreiben', () => {
  it('ein späterer Tag: als DATE-Wert gespeichert, bedingt auf den gelesenen Stand, Seiten neu', async () => {
    expect(await setzeGruendungBisAction('farm_1', { gruendungBis: '2028-06-30', bestaetigt: false })).toEqual({})
    expect(farmUpdateMany).toHaveBeenCalledWith({
      where: { id: 'farm_1', gruendungBis: null },
      data: { gruendungBis: TAG('2028-06-30') },
    })
    expect(revalidatePath).toHaveBeenCalledWith('/admin')
    expect(revalidatePath).toHaveBeenCalledWith('/settings/konditionen')
  })

  it('leer = Standard: die Spalte wird null', async () => {
    stand(TAG('2026-12-31'))
    expect(await setzeGruendungBisAction('farm_1', { gruendungBis: '', bestaetigt: false })).toEqual({})
    expect(farmUpdateMany).toHaveBeenCalledWith({
      where: { id: 'farm_1', gruendungBis: TAG('2026-12-31') },
      data: { gruendungBis: null },
    })
  })

  it('früher als der Standard: ohne Zustimmung abgelehnt, mit Zustimmung gespeichert', async () => {
    expect(await setzeGruendungBisAction('farm_1', { gruendungBis: '2027-06-30', bestaetigt: false })).toEqual({
      error: GRUENDUNG_BIS_ZUSTIMMUNG_FEHLT,
    })
    expect(farmUpdateMany).not.toHaveBeenCalled()

    expect(await setzeGruendungBisAction('farm_1', { gruendungBis: '2027-06-30', bestaetigt: true })).toEqual({})
    expect(farmUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { gruendungBis: TAG('2027-06-30') } }))
  })

  it('zurück auf einen früheren Standard verkürzt auch — nur mit Zustimmung', async () => {
    stand(TAG('2028-06-30'))
    expect(await setzeGruendungBisAction('farm_1', { gruendungBis: null, bestaetigt: false })).toEqual({ error: GRUENDUNG_BIS_ZUSTIMMUNG_FEHLT })
    expect(await setzeGruendungBisAction('farm_1', { gruendungBis: null, bestaetigt: true })).toEqual({})
  })

  it('derselbe Tag oder später braucht keine Zustimmung', async () => {
    stand(TAG('2028-06-30'))
    expect(await setzeGruendungBisAction('farm_1', { gruendungBis: '2028-06-30', bestaetigt: false })).toEqual({})
    expect(await setzeGruendungBisAction('farm_1', { gruendungBis: '2029-01-31', bestaetigt: false })).toEqual({})
  })

  it('ohne Gründungsplatz gibt es keine Zusage zu verkürzen', async () => {
    stand(null, 12) // farm_1 steht auf Platz 13
    expect(await setzeGruendungBisAction('farm_1', { gruendungBis: '2026-12-31', bestaetigt: false })).toEqual({})
  })

  it('hat ein zweiter Tab das Ende inzwischen verschoben: Satz statt Überschreiben, kein Protokoll', async () => {
    farmUpdateMany.mockResolvedValue({ count: 0 } as never)
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    expect(await setzeGruendungBisAction('farm_1', { gruendungBis: '2028-06-30', bestaetigt: false })).toEqual({ error: GRUENDUNG_BIS_GEAENDERT })
    expect(log.mock.calls.some((c) => String(c[0]).includes('Gründungshof bis geändert'))).toBe(false)
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('protokolliert außerhalb der Produktion Zeitpunkt, Admin, Hof, alten und neuen Wert — keine Personendaten', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    await setzeGruendungBisAction('farm_1', { gruendungBis: '2028-06-30', bestaetigt: false })
    stand(TAG('2028-06-30'))
    await setzeGruendungBisAction('farm_1', { gruendungBis: '', bestaetigt: true })

    const zeilen = log.mock.calls.map((c) => String(c[0])).filter((z) => z.includes('Gründungshof bis geändert'))
    expect(zeilen).toHaveLength(2)
    expect(zeilen[0]).toContain(JETZT.toISOString())
    expect(zeilen[0]).toContain('admin=admin_1')
    expect(zeilen[0]).toContain('farm=farm_1')
    expect(zeilen[0]).toContain('alt=Standard neu=2028-06-30')
    expect(zeilen[1]).toContain('alt=2028-06-30 neu=Standard')
    expect(zeilen[1]).toContain('bestaetigt=true')
    expect(zeilen.join(' ')).not.toMatch(/@|hof-test/)
  })
})
