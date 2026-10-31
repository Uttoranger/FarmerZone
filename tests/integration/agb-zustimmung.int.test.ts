/**
 * Zustimmung der Höfe zu den AGB (Nr. 207, Auftrag Punkt 4) gegen ein ECHTES
 * Postgres.
 *
 * Die Aussage:
 *  - Die Migration 20261031100000_agb_zustimmung ist angewandt (global-setup
 *    fährt `migrate deploy`): Farm.agbFassung (text) und Farm.agbZugestimmtAm
 *    (timestamp) sind nullbar und ohne Default — kein Hof gilt durch die
 *    Migration als zugestimmt (keine Zustimmungsfiktion); ein zweiter Lauf
 *    der Migration (IF NOT EXISTS) ändert nichts.
 *  - stimmeAgbZu mit echter Anmeldung speichert Fassung und Zeitpunkt nur am
 *    eigenen Hof; eine zweite Zustimmung derselben Fassung ändert nichts (auch
 *    den Zeitpunkt nicht); ein fremder Hof bleibt unberührt.
 *  - Gegenprobe: Eine Zustimmung zu einer älteren Fassung wird durch die
 *    aktuelle ersetzt; eine veraltete Fassung aus dem Browser speichert nichts.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }))

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { stimmeAgbZu } from '@/server/actions/agb-zustimmung'
import { agbFassung } from '@/lib/rechtstexte/agb-datei'
import { erstelleHof, erstelleHofMitAnmeldung, raeumeAuf } from './setup/basis'

const MIGRATION = readFileSync(join(process.cwd(), 'prisma', 'migrations', '20261031100000_agb_zustimmung', 'migration.sql'), 'utf8')

afterEach(async () => {
  vi.mocked(headers).mockResolvedValue(new Headers() as never)
  await raeumeAuf()
})

async function angemeldet(cookie: string): Promise<void> {
  vi.mocked(headers).mockResolvedValue(new Headers({ cookie }) as never)
}

describe('Spalten der Migration', () => {
  it('agbFassung und agbZugestimmtAm sind nullbar und ohne Default; ein neuer Hof hat beide leer', async () => {
    const spalten = await prisma.$queryRaw<{ column_name: string; data_type: string; is_nullable: string; column_default: string | null }[]>`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'Farm' AND column_name IN ('agbFassung', 'agbZugestimmtAm')
      ORDER BY column_name`
    expect(spalten).toEqual([
      { column_name: 'agbFassung', data_type: 'text', is_nullable: 'YES', column_default: null },
      { column_name: 'agbZugestimmtAm', data_type: 'timestamp without time zone', is_nullable: 'YES', column_default: null },
    ])
    const { farm } = await erstelleHof()
    expect(await prisma.farm.findUniqueOrThrow({ where: { id: farm.id }, select: { agbFassung: true, agbZugestimmtAm: true } })).toEqual({
      agbFassung: null,
      agbZugestimmtAm: null,
    })
  })

  it('ein zweiter Lauf der Migration ändert nichts (IF NOT EXISTS) — auch keine Zustimmung', async () => {
    const { farm } = await erstelleHof({ agbFassung: '0.9', agbZugestimmtAm: new Date('2026-10-31T10:00:00Z') })
    for (const anweisung of MIGRATION.replace(/--.*$/gm, '').split(';').map((s) => s.trim()).filter(Boolean)) {
      await prisma.$executeRawUnsafe(anweisung)
    }
    expect(await prisma.farm.findUniqueOrThrow({ where: { id: farm.id }, select: { agbFassung: true, agbZugestimmtAm: true } })).toEqual({
      agbFassung: '0.9',
      agbZugestimmtAm: new Date('2026-10-31T10:00:00Z'),
    })
  })
})

describe('stimmeAgbZu mit echter Anmeldung', () => {
  it('speichert Fassung und Zeitpunkt am eigenen Hof; eine zweite Zustimmung ändert nichts; der fremde Hof bleibt leer', async () => {
    const { farm, cookie } = await erstelleHofMitAnmeldung()
    const { farm: fremd } = await erstelleHof()
    await angemeldet(cookie)
    const vorher = Date.now()

    expect(await stimmeAgbZu({ fassung: agbFassung() })).toEqual({ ok: true })
    const erste = await prisma.farm.findUniqueOrThrow({ where: { id: farm.id }, select: { agbFassung: true, agbZugestimmtAm: true } })
    expect(erste.agbFassung).toBe(agbFassung())
    expect(erste.agbZugestimmtAm!.getTime()).toBeGreaterThanOrEqual(vorher - 1_000)

    await new Promise((fertig) => setTimeout(fertig, 20))
    expect(await stimmeAgbZu({ fassung: agbFassung() })).toEqual({ ok: true })
    const zweite = await prisma.farm.findUniqueOrThrow({ where: { id: farm.id }, select: { agbFassung: true, agbZugestimmtAm: true } })
    expect(zweite).toEqual(erste)

    expect(await prisma.farm.findUniqueOrThrow({ where: { id: fremd.id }, select: { agbFassung: true, agbZugestimmtAm: true } })).toEqual({
      agbFassung: null,
      agbZugestimmtAm: null,
    })
  })

  it('Gegenprobe: eine ältere Fassung wird ersetzt; eine veraltete Fassung aus dem Browser speichert nichts; ohne Anmeldung nichts', async () => {
    const alt = new Date('2026-01-01T10:00:00Z')
    const { farm, cookie } = await erstelleHofMitAnmeldung({ agbFassung: '0.1', agbZugestimmtAm: alt })

    expect(await stimmeAgbZu({ fassung: agbFassung() })).toEqual({ error: expect.any(String) })
    expect((await prisma.farm.findUniqueOrThrow({ where: { id: farm.id }, select: { agbFassung: true } })).agbFassung).toBe('0.1')

    await angemeldet(cookie)
    expect(await stimmeAgbZu({ fassung: '0.1' })).toEqual({ error: expect.any(String) })
    expect((await prisma.farm.findUniqueOrThrow({ where: { id: farm.id }, select: { agbFassung: true } })).agbFassung).toBe('0.1')

    expect(await stimmeAgbZu({ fassung: agbFassung() })).toEqual({ ok: true })
    const neu = await prisma.farm.findUniqueOrThrow({ where: { id: farm.id }, select: { agbFassung: true, agbZugestimmtAm: true } })
    expect(neu.agbFassung).toBe(agbFassung())
    expect(neu.agbZugestimmtAm!.getTime()).toBeGreaterThan(alt.getTime())
  })

  it('angemeldet, aber ohne eigenen Hof: kein Erfolg, nichts geschrieben (mit Hof: Erfolg, siehe oben)', async () => {
    const { farm, cookie } = await erstelleHofMitAnmeldung()
    const { farm: fremd } = await erstelleHof()
    await prisma.farm.delete({ where: { id: farm.id } })
    await angemeldet(cookie)
    expect(await stimmeAgbZu({ fassung: agbFassung() })).toEqual({ error: expect.any(String) })
    expect(await prisma.farm.findUniqueOrThrow({ where: { id: fremd.id }, select: { agbFassung: true } })).toEqual({ agbFassung: null })
  })
})
