/**
 * Startseite gestalten (Register N16, Nr. 96) gegen ein ECHTES Postgres.
 *
 * Die Aussage:
 *  - Die Migration 20261015140000_startseite_gestalten ist anwendbar
 *    (global-setup fährt `migrate deploy`): die acht festen Abschnitte mit
 *    festen Kennungen in der heutigen Reihenfolge, alle sichtbar, RLS an auf
 *    beiden Tabellen.
 *  - speichereEntwurf (bis Nr. 99 speichereStartseite) mit echter
 *    Admin-Anmeldung schreibt Block, Reihenfolge und Auge zusammen; die
 *    Vorschau des Entwurfs liest danach genau diese Reihenfolge (die Höfe des
 *    Blocks aus derselben Runde). Die öffentliche Seite liest den Entwurf nie
 *    (tests/integration/startseite-fassung.int.test.ts).
 *  - Feste Abschnitte bleiben unverschiebbar und sichtbar: Ein Versuch ändert
 *    in der Datenbank nichts — weder Positionen noch Blöcke.
 *  - Ein Block mit einem nicht freigeschalteten Hof wird nicht angelegt.
 *  - Löschen nimmt die Zeile des Blocks mit (Cascade).
 *
 * Die acht Zeilen sind geteilter Zustand der Test-Datenbank: Jeder Test stellt
 * sie im afterEach wieder her und löscht seine Blöcke.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()), draftMode: vi.fn(async () => ({ isEnabled: false, enable: vi.fn() })) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }))
vi.mock('next/navigation', () => ({ redirect: vi.fn(), notFound: vi.fn(), unstable_rethrow: vi.fn() }))

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { NEUER_BLOCK, REIHENFOLGE_FEHLER_TEXT, STANDARD_REIHENFOLGE } from '@/lib/startseite-gestalten'
import { loescheStartseitenBlock, speichereEntwurf } from '@/server/actions/startseite'
import { ladeVorschauZeilen } from '@/server/queries/startseite'
import type { StartseitenBlockEingabe } from '@/schemas/startseite'
import { erstelleHof, erstelleHofMitAnmeldung, raeumeAuf } from './setup/basis'

const MIGRATION = readFileSync(join(process.cwd(), 'prisma', 'migrations', '20261015140000_startseite_gestalten', 'migration.sql'), 'utf8')
const SEED_IDS = STANDARD_REIHENFOLGE.map((art) => `startseite-${art.toLowerCase().replace(/_/g, '-')}`)

afterEach(async () => {
  vi.mocked(headers).mockResolvedValue(new Headers() as never)
  await prisma.startseiteBlock.deleteMany({ where: { erstelltVonUserId: { startsWith: 'int-' } } })
  await prisma.startseiteBlock.deleteMany({ where: { titel: { startsWith: 'int-' } } })
  for (const [position, id] of SEED_IDS.entries()) {
    await prisma.startseiteAbschnitt.update({ where: { id }, data: { position, sichtbar: true } })
  }
  await raeumeAuf()
})

/** Ein Admin mit echter Sitzung — das Cookie geht über das gemockte headers() an die Action. */
async function alsAdmin(): Promise<string> {
  const { ownerId, cookie } = await erstelleHofMitAnmeldung()
  await prisma.user.update({ where: { id: ownerId }, data: { isAdmin: true } })
  vi.mocked(headers).mockResolvedValue(new Headers({ cookie }) as never)
  return ownerId
}

async function zustand(): Promise<{ id: string; art: string; position: number; sichtbar: boolean; blockId: string | null }[]> {
  return prisma.startseiteAbschnitt.findMany({ orderBy: [{ position: 'asc' }, { id: 'asc' }], select: { id: true, art: true, position: true, sichtbar: true, blockId: true } })
}

function block(teil: Partial<StartseitenBlockEingabe> = {}): StartseitenBlockEingabe {
  return {
    vorlage: 'SAISONKARTE',
    ueberzeile: 'Erntezeit',
    titel: 'int-Kürbis und Most',
    text: null,
    bildUrl: null,
    linkUrl: '/hoefe',
    linkText: null,
    farmIds: [],
    kategorie: null,
    liveAbTag: '2026-10-01',
    liveAbUhrzeit: '06:00',
    liveBisTag: null,
    liveBisUhrzeit: null,
    ...teil,
  }
}

describe('Migration und Seed', () => {
  it('legt die acht festen Abschnitte in der heutigen Reihenfolge an, alle sichtbar', async () => {
    const zeilen = await prisma.startseiteAbschnitt.findMany({ where: { id: { in: SEED_IDS } }, orderBy: { position: 'asc' } })
    expect(zeilen.map((z) => [z.id, z.art, z.position, z.sichtbar, z.blockId])).toEqual(
      STANDARD_REIHENFOLGE.map((art, i) => [SEED_IDS[i], art, i, true, null])
    )
    expect(MIGRATION).toMatch(/ON CONFLICT \("id"\) DO NOTHING/)
  })

  it('schaltet RLS auf beiden Tabellen ein', async () => {
    const rls = await prisma.$queryRaw<{ relname: string; relrowsecurity: boolean }[]>`
      SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('StartseiteAbschnitt', 'StartseiteBlock') ORDER BY relname`
    expect(rls).toEqual([
      { relname: 'StartseiteAbschnitt', relrowsecurity: true },
      { relname: 'StartseiteBlock', relrowsecurity: true },
    ])
  })
})

describe('speichereEntwurf', () => {
  it('schreibt Block, Reihenfolge und Auge zusammen — die Liste liest genau das', async () => {
    const adminId = await alsAdmin()
    const { farm } = await erstelleHof({ approvedAt: new Date() })
    const vorher = await zustand()
    const reihenfolge = vorher.map((z) => ({ id: z.id, sichtbar: z.art !== 'FRAGEN' }))
    reihenfolge.splice(1, 0, { id: NEUER_BLOCK, sichtbar: true })
    // Futter und Brennmaterial tauschen.
    ;[reihenfolge[3], reihenfolge[4]] = [reihenfolge[4], reihenfolge[3]]

    const ergebnis = await speichereEntwurf({ reihenfolge, block: block({ vorlage: 'HOEFE_AUSWAHL', farmIds: [farm.id] }) })
    expect(ergebnis).toMatchObject({ ok: true })
    const blockId = 'blockId' in ergebnis ? ergebnis.blockId : null

    const nachher = await zustand()
    expect(nachher.map((z) => z.art)).toEqual(['KOPF', 'BLOCK', 'HOEFE', 'BRENNMATERIAL', 'FUTTER', 'SO_FUNKTIONIERTS', 'FUER_HOEFE', 'FRAGEN', 'FUSS'])
    expect(nachher.map((z) => z.position)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
    expect(nachher.find((z) => z.art === 'FRAGEN')?.sichtbar).toBe(false)
    expect(nachher[1].blockId).toBe(blockId)
    const gespeichert = await prisma.startseiteBlock.findUniqueOrThrow({ where: { id: blockId ?? '' } })
    expect(gespeichert).toMatchObject({ vorlage: 'HOEFE_AUSWAHL', farmIds: [farm.id], erstelltVonUserId: adminId, liveAb: new Date('2026-10-01T04:00:00.000Z') })

    const liste = await ladeVorschauZeilen({ quelle: 'entwurf', datum: new Date() })
    const imBlock = liste.find((z) => z.art === 'BLOCK')
    expect(imBlock && imBlock.art === 'BLOCK' ? imBlock.block.hofSlugs : null).toEqual([farm.slug])
  })

  it('lässt feste Abschnitte nicht verschieben oder ausblenden — und ändert dann nichts', async () => {
    await alsAdmin()
    const vorher = await zustand()

    const fussHoch = vorher.map((z) => ({ id: z.id, sichtbar: true }))
    ;[fussHoch[6], fussHoch[7]] = [fussHoch[7], fussHoch[6]]
    expect(await speichereEntwurf({ reihenfolge: [...fussHoch.slice(0, 1), { id: NEUER_BLOCK, sichtbar: true }, ...fussHoch.slice(1)], block: block() })).toEqual({
      error: REIHENFOLGE_FEHLER_TEXT['fuss-nicht-unten'],
    })

    const hoefeAus = vorher.map((z) => ({ id: z.id, sichtbar: z.art !== 'HOEFE' }))
    expect(await speichereEntwurf({ reihenfolge: hoefeAus, block: null })).toEqual({ error: REIHENFOLGE_FEHLER_TEXT['fest-ausgeblendet'] })

    const futterHoch = vorher.map((z) => ({ id: z.id, sichtbar: true }))
    ;[futterHoch[1], futterHoch[2]] = [futterHoch[2], futterHoch[1]]
    expect(await speichereEntwurf({ reihenfolge: futterHoch, block: null })).toEqual({ error: REIHENFOLGE_FEHLER_TEXT['hoefe-nicht-unter-kopf'] })

    expect(await zustand()).toEqual(vorher)
    expect(await prisma.startseiteBlock.count({ where: { titel: { startsWith: 'int-' } } })).toBe(0)
  })

  it('legt keinen Block mit einem nicht freigeschalteten Hof an', async () => {
    await alsAdmin()
    const { farm } = await erstelleHof({ approvedAt: null })
    const vorher = await zustand()
    const reihenfolge = [{ id: vorher[0].id, sichtbar: true }, { id: NEUER_BLOCK, sichtbar: true }, ...vorher.slice(1).map((z) => ({ id: z.id, sichtbar: true }))]
    expect(await speichereEntwurf({ reihenfolge, block: block({ vorlage: 'HOEFE_AUSWAHL', farmIds: [farm.id] }) })).toEqual({ error: 'Wähle nur freigeschaltete Höfe.' })
    expect(await zustand()).toEqual(vorher)
  })

  it('löscht einen Block samt seiner Zeile', async () => {
    await alsAdmin()
    const vorher = await zustand()
    const reihenfolge = [{ id: vorher[0].id, sichtbar: true }, { id: NEUER_BLOCK, sichtbar: true }, ...vorher.slice(1).map((z) => ({ id: z.id, sichtbar: true }))]
    const ergebnis = await speichereEntwurf({ reihenfolge, block: block() })
    const blockId = 'blockId' in ergebnis ? (ergebnis.blockId ?? '') : ''
    expect(await prisma.startseiteAbschnitt.count({ where: { blockId } })).toBe(1)

    expect(await loescheStartseitenBlock({ blockId })).toEqual({ ok: true })
    expect(await prisma.startseiteAbschnitt.count({ where: { blockId } })).toBe(0)
    expect(await prisma.startseiteBlock.count({ where: { id: blockId } })).toBe(0)
  })
})
