/**
 * Admin-Sperre eines Hofs (Register N34, Nachtlauf Nr. 187).
 *
 * Beweist an den echten Actions (Prisma und Wache gestellt, Protokoll echt):
 *  - beide Actions fragen genau die EINE heikle Wache mit Recht
 *    `hof_sperren_storno`; ohne Recht bzw. ohne frische Bestätigung wird nichts
 *    geschrieben, nichts protokolliert, keine Nachricht angelegt;
 *  - Sperren schreibt bedingt (`adminGesperrtAm: null`), protokolliert Art,
 *    Bezug und Grund und legt eine SYSTEM-Nachricht mit dem Grund an;
 *    zweimal sperren ändert nichts (Gegenprobe ohne Protokoll);
 *  - ein Grund mit E-Mail-Adresse wird abgelehnt (nichts geschrieben);
 *  - Aufheben leert Zeitpunkt, Grund und Person — nur bei einem gesperrten Hof;
 *  - eine fehlgeschlagene Nachricht nimmt die Sperre nicht zurück (Nachlauf);
 *  - der Hof kann die Sperre nicht aufheben: setPause schreibt sie nicht, und
 *    unter src/ schreibt nur src/server/actions/admin-hof.ts `adminGesperrtAm`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn(), unstable_cache: (f: unknown) => f }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn(async () => ({ user: { id: 'inhaber-1' } })) } } }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    farm: { findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    unterhaltung: { create: vi.fn() },
    adminAktion: { create: vi.fn() },
  },
}))
vi.mock('@/server/admin-wache', () => ({
  verlangeFrischeBestaetigung: vi.fn(),
  verlangeAdminAktion: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { verlangeFrischeBestaetigung, verlangeAdminAktion } from '@/server/admin-wache'
import { sperreHof, hebeHofSperreAuf } from '@/server/actions/admin-hof'
import { setPause } from '@/server/actions/farm'
import { ADMIN_GRUND_FEHLER } from '@/schemas/admin-aktion'
import { ADMIN_RECHT_FEHLER } from '@/lib/admin-rechte'
import { SPERRE_AUFGEHOBEN_NACHRICHT, SPERRE_TEXT } from '@/lib/admin-hof-akte'

const wache = vi.mocked(verlangeFrischeBestaetigung)
const updateMany = vi.mocked(prisma.farm.updateMany)
const nachricht = vi.mocked(prisma.unterhaltung.create)
const protokoll = vi.mocked(prisma.adminAktion.create)

beforeEach(() => {
  vi.clearAllMocks()
  wache.mockResolvedValue({ ok: true, userId: 'admin-1', sitzungId: 's-1', mitPasskey: true })
  vi.mocked(prisma.farm.findUnique).mockResolvedValue({ slug: 'hof-am-bach' } as never)
  updateMany.mockResolvedValue({ count: 1 } as never)
  nachricht.mockResolvedValue({ id: 'u-1' } as never)
  protokoll.mockResolvedValue({ id: 'p-1' } as never)
})

function nichtsGeschrieben() {
  expect(updateMany).not.toHaveBeenCalled()
  expect(protokoll).not.toHaveBeenCalled()
  expect(nachricht).not.toHaveBeenCalled()
}

describe('sperreHof', () => {
  it('fragt die heikle Wache mit Recht hof_sperren_storno — genau einmal, nie zusätzlich verlangeAdminAktion', async () => {
    await sperreHof({ farmId: 'hof-1', grund: 'Beschwerden klären' })
    expect(wache).toHaveBeenCalledTimes(1)
    expect(wache).toHaveBeenCalledWith({ recht: 'hof_sperren_storno' })
    expect(verlangeAdminAktion).not.toHaveBeenCalled()
  })

  it.each([
    ['ohne Recht', ADMIN_RECHT_FEHLER],
    ['ohne frische Bestätigung', 'frisch'],
  ])('%s: Satz der Wache, nichts geschrieben', async (_name, fehler) => {
    wache.mockResolvedValue({ error: fehler })
    expect(await sperreHof({ farmId: 'hof-1', grund: 'Beschwerden klären' })).toEqual({ error: fehler })
    nichtsGeschrieben()
  })

  it('sperrt bedingt, protokolliert mit Grund und sagt es dem Hof im Postfach', async () => {
    expect(await sperreHof({ farmId: 'hof-1', grund: 'Beschwerden klären' })).toEqual({ ok: true })

    const aufruf = updateMany.mock.calls[0]?.[0] as { where: unknown; data: Record<string, unknown> }
    expect(aufruf.where).toEqual({ id: 'hof-1', adminGesperrtAm: null })
    expect(aufruf.data.adminGesperrtAm).toBeInstanceOf(Date)
    expect(aufruf.data).toMatchObject({ adminSperrGrund: 'Beschwerden klären', adminGesperrtVonUserId: 'admin-1' })
    // Die Pause bleibt unabhängig.
    expect(aufruf.data).not.toHaveProperty('isPaused')

    expect(protokoll).toHaveBeenCalledWith({
      data: { wer: 'admin-1', art: 'hof_gesperrt', bezugArt: 'hof', bezugId: 'hof-1', mitPasskey: true, grund: 'Beschwerden klären' },
      select: { id: true },
    })
    const faden = nachricht.mock.calls[0]?.[0] as { data: { farmId: string; nachrichten: { create: { text: string; art: string; vonFarmId: null } } } }
    expect(faden.data.farmId).toBe('hof-1')
    expect(faden.data.nachrichten.create.art).toBe('SYSTEM')
    expect(faden.data.nachrichten.create.vonFarmId).toBeNull()
    expect(faden.data.nachrichten.create.text).toContain('Dein Hof ist vom Team gesperrt: Beschwerden klären.')
  })

  it('schon gesperrt: Satz, kein Protokoll, keine zweite Nachricht', async () => {
    updateMany.mockResolvedValue({ count: 0 } as never)
    expect(await sperreHof({ farmId: 'hof-1', grund: 'Beschwerden klären' })).toEqual({ error: SPERRE_TEXT.schonGesperrt })
    expect(protokoll).not.toHaveBeenCalled()
    expect(nachricht).not.toHaveBeenCalled()
  })

  it.each([
    ['E-Mail-Adresse', 'Bitte melden: someone@example.com', ADMIN_GRUND_FEHLER],
    ['Telefonnummer', 'Ruf an: 06640000000', ADMIN_GRUND_FEHLER],
    ['leer', '   ', SPERRE_TEXT.eingabe],
  ])('Grund mit %s: abgelehnt, nichts geschrieben', async (_name, grund, fehler) => {
    expect(await sperreHof({ farmId: 'hof-1', grund })).toEqual({ error: fehler })
    nichtsGeschrieben()
  })

  it('unbekannter Hof: Satz, nichts geschrieben', async () => {
    vi.mocked(prisma.farm.findUnique).mockResolvedValue(null)
    expect(await sperreHof({ farmId: 'weg', grund: 'Beschwerden klären' })).toEqual({ error: SPERRE_TEXT.nichtGefunden })
    nichtsGeschrieben()
  })

  it('Nachricht scheitert: die Sperre gilt trotzdem (Nachlauf)', async () => {
    nachricht.mockRejectedValue(new Error('db weg'))
    expect(await sperreHof({ farmId: 'hof-1', grund: 'Beschwerden klären' })).toEqual({ ok: true })
    expect(updateMany).toHaveBeenCalledTimes(1)
    expect(protokoll).toHaveBeenCalledTimes(1)
  })
})

describe('hebeHofSperreAuf', () => {
  it('ohne Recht: Satz der Wache, nichts geschrieben', async () => {
    wache.mockResolvedValue({ error: ADMIN_RECHT_FEHLER })
    expect(await hebeHofSperreAuf({ farmId: 'hof-1' })).toEqual({ error: ADMIN_RECHT_FEHLER })
    expect(wache).toHaveBeenCalledWith({ recht: 'hof_sperren_storno' })
    nichtsGeschrieben()
  })

  it('hebt nur eine bestehende Sperre auf, leert Grund und Person, protokolliert und schreibt dem Hof', async () => {
    expect(await hebeHofSperreAuf({ farmId: 'hof-1' })).toEqual({ ok: true })
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'hof-1', adminGesperrtAm: { not: null } },
      data: { adminGesperrtAm: null, adminSperrGrund: null, adminGesperrtVonUserId: null },
    })
    expect(protokoll).toHaveBeenCalledWith({
      data: { wer: 'admin-1', art: 'hof_sperre_aufgehoben', bezugArt: 'hof', bezugId: 'hof-1', mitPasskey: true, grund: null },
      select: { id: true },
    })
    const faden = nachricht.mock.calls[0]?.[0] as { data: { nachrichten: { create: { text: string } } } }
    expect(faden.data.nachrichten.create.text).toBe(SPERRE_AUFGEHOBEN_NACHRICHT)
  })

  it('nicht gesperrt: Satz, kein Protokoll', async () => {
    updateMany.mockResolvedValue({ count: 0 } as never)
    expect(await hebeHofSperreAuf({ farmId: 'hof-1' })).toEqual({ error: SPERRE_TEXT.nichtGesperrt })
    expect(protokoll).not.toHaveBeenCalled()
  })
})

/** Ein Schreiben der Sperre: die Felder in `data`, `create` oder `update` einer Prisma-Abfrage. */
const SCHREIBT_SPERRE = /\b(data|create|update)\s*:\s*\{[^{}]*\b(adminGesperrtAm|adminSperrGrund|adminGesperrtVonUserId)\b/

describe('der Hof kann die Sperre nicht aufheben', () => {
  it('setPause (Weg des Hofs) schreibt die Sperre nicht', async () => {
    vi.mocked(prisma.farm.findUnique).mockResolvedValue({ id: 'hof-1', slug: 'hof-am-bach', pauseMessage: null } as never)
    vi.mocked(prisma.farm.update).mockResolvedValue({} as never)
    expect(await setPause(false, '')).toEqual({})
    const daten = (vi.mocked(prisma.farm.update).mock.calls[0]?.[0] as { data: Record<string, unknown> }).data
    expect(Object.keys(daten).some((k) => k.startsWith('adminGesperrt') || k === 'adminSperrGrund')).toBe(false)
  })

  it('unter src/ schreibt nur src/server/actions/admin-hof.ts adminGesperrtAm (Lesen mit `: true` ist erlaubt)', { timeout: 30_000 }, () => {
    const wurzel = join(process.cwd(), 'src')
    const dateien: string[] = []
    const gehe = (ordner: string): void => {
      for (const name of readdirSync(ordner)) {
        const pfad = join(ordner, name)
        if (statSync(pfad).isDirectory()) gehe(pfad)
        else if (/\.(ts|tsx)$/.test(name)) dateien.push(pfad)
      }
    }
    gehe(wurzel)
    const schreiber = dateien
      .filter((d) => SCHREIBT_SPERRE.test(readFileSync(d, 'utf8').replace(/\/\/.*$/gm, '')))
      .map((d) => relative(process.cwd(), d).split(sep).join('/'))
    expect(schreiber).toEqual(['src/server/actions/admin-hof.ts'])
  })

  it('Gegenprobe der Wache: ein Schreiben in einer anderen Datei fällt auf', () => {
    expect(SCHREIBT_SPERRE.test('prisma.farm.update({ where, data: { adminGesperrtAm: null } })')).toBe(true)
    expect(SCHREIBT_SPERRE.test('db.farm.upsert({ create: {\n  name, adminSperrGrund: g } })')).toBe(true)
    expect(SCHREIBT_SPERRE.test('select: { adminGesperrtAm: true }')).toBe(false)
    expect(SCHREIBT_SPERRE.test('type X = { adminGesperrtAm: Date | null }')).toBe(false)
  })
})
