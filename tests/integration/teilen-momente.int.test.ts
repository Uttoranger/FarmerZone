/**
 * Teilen-Momente abschaltbar (Gate 7 Aufgabe 5, Nachtlauf Nr. 30) gegen ein
 * ECHTES Postgres.
 *
 * Die Aussage:
 *  - Die Migration 20261007120000_teilen_momente_aus ist auf den Bestand
 *    anwendbar (global-setup fährt `migrate deploy`): Farm.teilenMomenteAus
 *    existiert als boolean NOT NULL mit Default false.
 *  - DEPLOY-FENSTER: Alter Code schreibt Höfe, ohne die Spalte zu kennen
 *    (rohes SQL nur mit den alten Spalten) — der Hof hat danach false, also
 *    Momente an, wie vorher.
 *  - Ein bestehender Hof bleibt unverändert: Ein zweiter Lauf der Migration
 *    (wiederholbar, IF NOT EXISTS) fasst keine Zeile an — auch einen Hof, der
 *    die Momente schon abgeschaltet hat, nicht.
 *  - setzeTeilenMomente schreibt mit echter Anmeldung nur den eigenen Hof, und
 *    die Lesepfade der drei Momente (Heute, Produkte, Einstellungen) liefern
 *    den Schalter mit.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }))

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { setzeTeilenMomente } from '@/server/actions/teilen-momente'
import { getHeute } from '@/server/queries/heute'
import { getProdukteSeite } from '@/server/queries/products'
import { ladeEinstellungenUebersicht, ladeTeilenMomente } from '@/server/queries/einstellungen'
import { erstelleHof, erstelleHofMitAnmeldung, intKennung, raeumeAuf } from './setup/basis'

const MIGRATION = readFileSync(
  join(process.cwd(), 'prisma', 'migrations', '20261007120000_teilen_momente_aus', 'migration.sql'),
  'utf8'
)

afterEach(async () => {
  vi.mocked(headers).mockResolvedValue(new Headers() as never)
  await raeumeAuf()
})

describe('Spalte Farm.teilenMomenteAus', () => {
  it('existiert als boolean NOT NULL mit Default false', async () => {
    const spalten = await prisma.$queryRaw<{ data_type: string; is_nullable: string; column_default: string | null }[]>`
      SELECT data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'Farm' AND column_name = 'teilenMomenteAus'`
    expect(spalten).toEqual([{ data_type: 'boolean', is_nullable: 'NO', column_default: 'false' }])
  })

  it('Deploy-Fenster: ein Hof aus altem Code (ohne die Spalte) hat false — Momente an wie bisher', async () => {
    const kennung = intKennung('althof')
    await prisma.user.create({
      data: { id: kennung, email: `${kennung}@example.com`, name: 'Max Mustermann', role: 'FARMER' },
    })
    // Nur Spalten, die es vor der Migration gab — so schreibt der alte Code.
    await prisma.$executeRaw`
      INSERT INTO "Farm" ("id", "slug", "name", "ownerName", "description", "address",
                          "postalCode", "city", "phone", "email", "ownerId", "updatedAt")
      VALUES (${kennung}, ${kennung}, 'Hof Test', 'Max Mustermann', 'Erfundener Hof.',
              'Teststraße 1', '8700', 'Teststadt', '+43 660 0000000',
              ${`${kennung}@example.com`}, ${kennung}, now())`

    const hof = await prisma.farm.findUniqueOrThrow({ where: { slug: kennung } })
    expect(hof.teilenMomenteAus).toBe(false)
  })

  it('ein zweiter Lauf der Migration ändert keinen bestehenden Hof', async () => {
    const { farm: an } = await erstelleHof()
    const { farm: aus } = await erstelleHof({ teilenMomenteAus: true })
    const vorher = await prisma.farm.findMany({ where: { id: { in: [an.id, aus.id] } }, orderBy: { id: 'asc' } })

    // Prisma fährt eine Migration nicht in einer Transaktion — sie muss wiederholbar sein.
    // Erst die Kommentare weg (sie enthalten selbst Semikolons), dann je Anweisung.
    for (const anweisung of MIGRATION.replace(/--.*$/gm, '')
      .split(';')
      .map((teil) => teil.trim())
      .filter(Boolean)) {
      await prisma.$executeRawUnsafe(anweisung)
    }

    const nachher = await prisma.farm.findMany({ where: { id: { in: [an.id, aus.id] } }, orderBy: { id: 'asc' } })
    expect(nachher).toEqual(vorher)
    expect(nachher.find((f) => f.id === aus.id)?.teilenMomenteAus).toBe(true)
    expect(nachher.find((f) => f.id === an.id)?.teilenMomenteAus).toBe(false)
  })

  it('die Grunddaten (Seed) haben die Momente an', async () => {
    const abgeschaltet = await prisma.farm.count({ where: { slug: { not: { startsWith: 'int-' } }, teilenMomenteAus: true } })
    expect(abgeschaltet).toBe(0)
  })
})

describe('setzeTeilenMomente mit echter Anmeldung', () => {
  it('schaltet nur den eigenen Hof ab und wieder an; die Lesepfade liefern den Schalter mit', async () => {
    const { farm, ownerId, cookie } = await erstelleHofMitAnmeldung()
    const { farm: fremd } = await erstelleHof()
    vi.mocked(headers).mockResolvedValue(new Headers({ cookie }) as never)

    expect(await setzeTeilenMomente({ an: false })).toEqual({ ok: true, an: false })
    expect((await prisma.farm.findUniqueOrThrow({ where: { id: farm.id } })).teilenMomenteAus).toBe(true)
    expect((await prisma.farm.findUniqueOrThrow({ where: { id: fremd.id } })).teilenMomenteAus).toBe(false)

    // Alle drei Momente lesen den Schalter serverseitig.
    expect((await getHeute(farm.id)).hof.teilenMomenteAus).toBe(true)
    expect((await getProdukteSeite(farm.id, new Date())).teilenMomenteAus).toBe(true)
    expect((await ladeEinstellungenUebersicht(ownerId))?.teilenMomenteAus).toBe(true)
    expect(await ladeTeilenMomente(ownerId)).toEqual({ teilenMomenteAus: true })

    expect(await setzeTeilenMomente({ an: true })).toEqual({ ok: true, an: true })
    expect((await prisma.farm.findUniqueOrThrow({ where: { id: farm.id } })).teilenMomenteAus).toBe(false)
  })

  it('eine fremde farmId in der Eingabe wird abgelehnt, nichts geschrieben', async () => {
    const { cookie } = await erstelleHofMitAnmeldung()
    const { farm: fremd } = await erstelleHof()
    vi.mocked(headers).mockResolvedValue(new Headers({ cookie }) as never)

    expect(await setzeTeilenMomente({ an: false, farmId: fremd.id })).toHaveProperty('error')
    expect((await prisma.farm.findUniqueOrThrow({ where: { id: fremd.id } })).teilenMomenteAus).toBe(false)
  })

  it('ohne Anmeldung passiert nichts', async () => {
    const { farm } = await erstelleHof()
    expect(await setzeTeilenMomente({ an: false })).toEqual({ error: 'Bitte melde dich neu an.' })
    expect((await prisma.farm.findUniqueOrThrow({ where: { id: farm.id } })).teilenMomenteAus).toBe(false)
  })
})
