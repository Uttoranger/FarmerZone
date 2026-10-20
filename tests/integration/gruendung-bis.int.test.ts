/**
 * Gründungs-Enddatum je Hof (Nachtlauf Nr. 62, Register K2) gegen ein ECHTES
 * Postgres.
 *
 * Die Aussage:
 *  - Die Migration 20261012120000_gruendung_bis ist auf den Bestand anwendbar
 *    (global-setup fährt `migrate deploy`): Farm.gruendungBis existiert als
 *    date, nullable, ohne Default.
 *  - DEPLOY-FENSTER: Alter Code schreibt Höfe, ohne die Spalte zu kennen
 *    (rohes SQL nur mit den alten Spalten) — der Hof hat null, und null wirkt
 *    als Standard: Lader und alle vier Stellen liefern 31.12.2027.
 *  - Ein zweiter Lauf der Migration (IF NOT EXISTS) fasst keinen Hof an — null
 *    bleibt null, ein gesetztes Datum bleibt.
 *  - setzeGruendungBisAction mit echter Admin-Anmeldung speichert den Tag als
 *    DATE (zurückgelesen derselbe Tag), schreibt bedingt auch auf ein schon
 *    gesetztes Datum (DATE = Parameter trifft) und setzt nur mit Zustimmung
 *    auf den früheren Standard zurück; ohne Admin-Recht nichts.
 *
 * Ein Gründungsplatz braucht Platz ≤ 12 unter allen freigeschalteten Höfen —
 * der Seed hat mehr. Die Höfe hier tragen deshalb eine frühe Freigabe.
 * Kalendertage weit in der Zukunft: Die Action lehnt Tage vor heute ab, und
 * diese Schicht hängt an der Systemuhr (TESTING_GUIDELINES §1).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn(), notFound: vi.fn() }))

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { GRUENDUNG_BIS_STANDARD } from '@/lib/gruendungshof'
import { GRUENDUNG_BIS_ZUSTIMMUNG_FEHLT } from '@/schemas/gruendungshof'
import { setzeGruendungBisAction } from '@/server/actions/admin'
import { ladeGruendungBis } from '@/server/queries/admin'
import { ladeEinstellungenUebersicht, ladeKonditionenHof, ladeTarifStand } from '@/server/queries/einstellungen'
import { ladeTarifZeile } from '@/server/hofbereich'
import { erstelleHof, erstelleHofMitAnmeldung, intKennung, raeumeAuf, machePasskeyAdmin } from './setup/basis'

const MIGRATION = readFileSync(join(process.cwd(), 'prisma', 'migrations', '20261012120000_gruendung_bis', 'migration.sql'), 'utf8')

/** Vor jedem Hof des Seeds freigeschaltet — damit Platz 1. */
const FRUEH = new Date('2000-01-01T00:00:00.000Z')
const TAG = (kalendertag: string) => new Date(`${kalendertag}T00:00:00.000Z`)

afterEach(async () => {
  vi.mocked(headers).mockResolvedValue(new Headers() as never)
  await raeumeAuf()
})

describe('Spalte Farm.gruendungBis', () => {
  it('existiert als date, nullable, ohne Default', async () => {
    const spalten = await prisma.$queryRaw<{ data_type: string; is_nullable: string; column_default: string | null }[]>`
      SELECT data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'Farm' AND column_name = 'gruendungBis'`
    expect(spalten).toEqual([{ data_type: 'date', is_nullable: 'YES', column_default: null }])
  })

  it('Deploy-Fenster: ein Hof aus altem Code hat null — und null wirkt als Standard, an allen vier Stellen', async () => {
    const kennung = intKennung('althof')
    await prisma.user.create({
      data: { id: kennung, email: `${kennung}@example.com`, name: 'Max Mustermann', role: 'FARMER' },
    })
    // Nur Spalten, die es vor der Migration gab — so schreibt der alte Code.
    await prisma.$executeRaw`
      INSERT INTO "Farm" ("id", "slug", "name", "ownerName", "description", "address",
                          "postalCode", "city", "phone", "email", "ownerId", "approvedAt", "updatedAt")
      VALUES (${kennung}, ${kennung}, 'Hof Test', 'Max Mustermann', 'Erfundener Hof.',
              'Teststraße 1', '8700', 'Teststadt', '+43 660 0000000',
              ${`${kennung}@example.com`}, ${kennung}, ${FRUEH}, now())`

    const hof = await prisma.farm.findUniqueOrThrow({ where: { slug: kennung } })
    expect(hof.gruendungBis).toBeNull()

    expect(await ladeGruendungBis({ id: hof.id })).toEqual(GRUENDUNG_BIS_STANDARD)
    expect((await ladeTarifStand(hof.id)).gruendungBis).toEqual(GRUENDUNG_BIS_STANDARD)
    expect((await ladeKonditionenHof(kennung))?.gruendungBis).toEqual(GRUENDUNG_BIS_STANDARD)
    expect((await ladeEinstellungenUebersicht(kennung))?.gruendungBis).toEqual(GRUENDUNG_BIS_STANDARD)
    const zeile = await ladeTarifZeile(hof.id, new Date('2026-10-12T10:00:00+02:00'))
    expect(zeile).toMatchObject({ zustand: 'gruendungshof', zeile: 'ohne Grundgebühr bis 31. Dezember 2027' })
  })

  it('Gegenprobe: ein Hof weit hinter Platz 12 bekommt kein Ende', async () => {
    const { farm } = await erstelleHof({ gruendungBis: TAG('2099-06-30') })
    expect(await ladeGruendungBis({ id: farm.id })).toBeNull()
  })

  it('ein zweiter Lauf der Migration ändert keinen bestehenden Hof', async () => {
    const { farm: standard } = await erstelleHof({ approvedAt: FRUEH })
    const { farm: eigenes } = await erstelleHof({ approvedAt: FRUEH, gruendungBis: TAG('2099-06-30') })
    const ids = [standard.id, eigenes.id]
    const vorher = await prisma.farm.findMany({ where: { id: { in: ids } }, orderBy: { id: 'asc' } })

    // Prisma fährt eine Migration nicht in einer Transaktion — sie muss wiederholbar sein.
    // Erst die Kommentare weg (sie enthalten selbst Semikolons), dann je Anweisung.
    for (const anweisung of MIGRATION.replace(/--.*$/gm, '')
      .split(';')
      .map((teil) => teil.trim())
      .filter(Boolean)) {
      await prisma.$executeRawUnsafe(anweisung)
    }

    const nachher = await prisma.farm.findMany({ where: { id: { in: ids } }, orderBy: { id: 'asc' } })
    expect(nachher).toEqual(vorher)
    expect(nachher.find((f) => f.id === standard.id)?.gruendungBis).toBeNull()
    expect(nachher.find((f) => f.id === eigenes.id)?.gruendungBis).toEqual(TAG('2099-06-30'))
  })
})

describe('setzeGruendungBisAction mit echter Admin-Anmeldung', () => {
  it('speichert den Tag als DATE, schreibt bedingt auch auf ein gesetztes Datum und setzt nur mit Zustimmung zurück', async () => {
    const { ownerId, cookie } = await erstelleHofMitAnmeldung()
    await machePasskeyAdmin(ownerId)
    const { farm } = await erstelleHof({ approvedAt: FRUEH })
    vi.mocked(headers).mockResolvedValue(new Headers({ cookie }) as never)

    expect(await setzeGruendungBisAction(farm.id, { gruendungBis: '2099-06-30', bestaetigt: false })).toEqual({})
    const gelesen = await prisma.farm.findUniqueOrThrow({ where: { id: farm.id }, select: { gruendungBis: true } })
    expect(gelesen.gruendungBis?.toISOString()).toBe('2099-06-30T00:00:00.000Z')
    expect(await ladeGruendungBis({ id: farm.id })).toEqual(TAG('2099-06-30'))

    // Die Bedingung „Spalte = gelesenes Datum" trifft in der echten DATE-Spalte.
    expect(await setzeGruendungBisAction(farm.id, { gruendungBis: '2099-12-31', bestaetigt: false })).toEqual({})
    expect((await prisma.farm.findUniqueOrThrow({ where: { id: farm.id } })).gruendungBis).toEqual(TAG('2099-12-31'))

    // Zurück auf den früheren Standard verkürzt: nur mit Zustimmung (K1).
    expect(await setzeGruendungBisAction(farm.id, { gruendungBis: null, bestaetigt: false })).toEqual({ error: GRUENDUNG_BIS_ZUSTIMMUNG_FEHLT })
    expect((await prisma.farm.findUniqueOrThrow({ where: { id: farm.id } })).gruendungBis).toEqual(TAG('2099-12-31'))
    expect(await setzeGruendungBisAction(farm.id, { gruendungBis: null, bestaetigt: true })).toEqual({})
    expect((await prisma.farm.findUniqueOrThrow({ where: { id: farm.id } })).gruendungBis).toBeNull()
  })

  it('ohne Admin-Recht: abgelehnt, nichts geschrieben', async () => {
    const { cookie } = await erstelleHofMitAnmeldung()
    const { farm } = await erstelleHof({ approvedAt: FRUEH })
    vi.mocked(headers).mockResolvedValue(new Headers({ cookie }) as never)

    expect(await setzeGruendungBisAction(farm.id, { gruendungBis: '2099-06-30', bestaetigt: false })).toEqual({ error: 'Kein Zugriff.' })
    expect((await prisma.farm.findUniqueOrThrow({ where: { id: farm.id } })).gruendungBis).toBeNull()
  })
})
