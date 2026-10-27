/**
 * Stichtag „Hofpreis-Modell ab“ in Admin › Einstellungen (Register N38,
 * Nr. 197, Punkt 6): nur in der Zukunft, nur änderbar, solange er noch nicht
 * erreicht ist; die Action verlangt Recht `geld`, frisch mit Passkey, und
 * schreibt ins Protokoll. Gegenproben: erreichter Stichtag, Tag in der
 * Vergangenheit, ohne Recht.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }))
vi.mock('@/server/admin-wache', () => ({ verlangeAdminAktion: vi.fn(), verlangeFrischeBestaetigung: vi.fn() }))
vi.mock('@/server/admin-protokoll', () => ({ protokolliere: vi.fn(async () => true) }))
vi.mock('@/server/queries/admin', () => ({ ladeHoefeFuerGruendung: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: { plattformEinstellung: { findUnique: vi.fn(), upsert: vi.fn() } },
}))

import { prisma } from '@/lib/prisma'
import { updateTag } from 'next/cache'
import { verlangeAdminAktion } from '@/server/admin-wache'
import { protokolliere } from '@/server/admin-protokoll'
import { speichereHofpreisStichtag } from '@/server/actions/plattform-einstellung'
import { HOFPREIS_STICHTAG_FEHLER, PLATTFORM_EINSTELLUNG_TAG, hofpreisStichtagTag, pruefeHofpreisStichtag } from '@/lib/plattform-einstellung'
import { BAR_SERVICEGEBUEHR_AB } from '@/lib/konditionen'
import { einstellungsZeile } from './fabrik/plattform-einstellung'

const JETZT = new Date('2026-10-27T10:00:00.000Z')
const OHNE = { hofpreisModellAb: null }

describe('pruefeHofpreisStichtag — die Regel für Formular und Action', () => {
  it('ohne Einstellung gilt BAR_SERVICEGEBUEHR_AB; ein Tag in der Zukunft ist in Ordnung', () => {
    expect(hofpreisStichtagTag(OHNE)).toBe('2027-02-01')
    expect(BAR_SERVICEGEBUEHR_AB.getTime()).toBeGreaterThan(JETZT.getTime())
    expect(pruefeHofpreisStichtag('2027-01-01', OHNE, JETZT)).toBeNull()
    expect(pruefeHofpreisStichtag('2026-10-28', OHNE, JETZT)).toBeNull()
  })

  it('heute oder früher: „muss in der Zukunft liegen“', () => {
    expect(pruefeHofpreisStichtag('2026-10-27', OHNE, JETZT)).toBe(HOFPREIS_STICHTAG_FEHLER.zukunft)
    expect(pruefeHofpreisStichtag('2026-01-01', OHNE, JETZT)).toBe(HOFPREIS_STICHTAG_FEHLER.zukunft)
  })

  it('erreichter Stichtag lässt sich nicht mehr ändern — auch nicht nach hinten', () => {
    const erreicht = { hofpreisModellAb: new Date('2026-10-01T00:00:00.000Z') }
    expect(pruefeHofpreisStichtag('2027-06-01', erreicht, JETZT)).toBe(HOFPREIS_STICHTAG_FEHLER.erreicht)
  })

  it('unlesbares Datum und derselbe Tag fallen auf', () => {
    expect(pruefeHofpreisStichtag('2027-13-45', OHNE, JETZT)).toBe(HOFPREIS_STICHTAG_FEHLER.datum)
    expect(pruefeHofpreisStichtag('morgen', OHNE, JETZT)).toBe(HOFPREIS_STICHTAG_FEHLER.datum)
    expect(pruefeHofpreisStichtag('2027-02-01', OHNE, JETZT)).toBe(HOFPREIS_STICHTAG_FEHLER.gleich)
  })
})

describe('speichereHofpreisStichtag — Recht geld, frisch, Protokoll', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(JETZT)
    vi.mocked(verlangeAdminAktion).mockResolvedValue({ ok: true, userId: 'admin_1', sitzungId: 's_1', mitPasskey: true })
    vi.mocked(prisma.plattformEinstellung.findUnique).mockResolvedValue(einstellungsZeile(null) as never)
    vi.mocked(prisma.plattformEinstellung.upsert).mockResolvedValue({} as never)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('speichert Wiener Mitternacht, protokolliert und leert den Cache', async () => {
    expect(await speichereHofpreisStichtag({ tag: '2027-01-01' })).toEqual({ ok: true })
    expect(verlangeAdminAktion).toHaveBeenCalledWith({ frisch: true, recht: 'geld' })
    const aufruf = vi.mocked(prisma.plattformEinstellung.upsert).mock.calls[0]?.[0] as unknown as { update: { hofpreisModellAb: Date } }
    // 1. Jänner 2027 in Wien = 31.12.2026, 23:00 UTC.
    expect(aufruf.update.hofpreisModellAb.toISOString()).toBe('2026-12-31T23:00:00.000Z')
    expect(protokolliere).toHaveBeenCalledWith(expect.objectContaining({ art: 'hofpreis_stichtag_geaendert', bezugArt: 'plattform', mitPasskey: true }))
    expect(updateTag).toHaveBeenCalledWith(PLATTFORM_EINSTELLUNG_TAG)
  })

  it('Gegenprobe: ohne Recht oder nicht frisch — nichts geschrieben, nichts protokolliert', async () => {
    vi.mocked(verlangeAdminAktion).mockResolvedValue({ error: 'frisch' })
    expect(await speichereHofpreisStichtag({ tag: '2027-01-01' })).toEqual({ error: 'frisch' })
    expect(prisma.plattformEinstellung.upsert).not.toHaveBeenCalled()
    expect(protokolliere).not.toHaveBeenCalled()
  })

  it('Gegenprobe: erreichter Stichtag in der Datenbank — abgelehnt', async () => {
    vi.mocked(prisma.plattformEinstellung.findUnique).mockResolvedValue(einstellungsZeile(new Date('2026-10-01T00:00:00.000Z')) as never)
    expect(await speichereHofpreisStichtag({ tag: '2027-01-01' })).toEqual({ error: HOFPREIS_STICHTAG_FEHLER.erreicht })
    expect(prisma.plattformEinstellung.upsert).not.toHaveBeenCalled()
  })

  it('Gegenprobe: unbekanntes Feld oder Tag in der Vergangenheit — abgelehnt', async () => {
    expect(await speichereHofpreisStichtag({ tag: '2027-01-01', mehr: 1 })).toEqual({ error: HOFPREIS_STICHTAG_FEHLER.datum })
    expect(await speichereHofpreisStichtag({ tag: '2026-09-01' })).toEqual({ error: HOFPREIS_STICHTAG_FEHLER.zukunft })
    expect(prisma.plattformEinstellung.upsert).not.toHaveBeenCalled()
  })
})
