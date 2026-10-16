/**
 * Entwurf und Fassung der Startseite (Register N16, Änderung Nr. 99) gegen ein
 * ECHTES Postgres.
 *
 * Die Aussage:
 *  - Die Migration 20261016100000_startseite_fassung ist anwendbar (global-setup
 *    fährt `migrate deploy`): Tabelle samt Index auf liveAb, RLS an, KEIN Seed.
 *  - Auswahl der Live-Fassung an echten Zeilen: von drei Fassungen —
 *    vergangen, künftig, zurückgezogen (jünger als die vergangene) — ist die
 *    vergangene live; Startseite (Prisma-Bedingung) und Zeitplan
 *    (ordneFassungen) sagen dasselbe.
 *  - Veröffentlichen mit echter Admin-Anmeldung schreibt genau eine Fassung mit
 *    dem Entwurf von diesem Moment und dem Admin; „jetzt“ ist sofort live, der
 *    Entwurf allein ändert die Startseite nicht.
 *  - Zurückziehen geht nur vor der Zeit; eine laufende Fassung bleibt.
 *  - Wien → UTC an der Sommerzeitgrenze (Ende Oktober): 09:00 am Samstag davor
 *    ist 07:00 UTC, am Sonntag der Umstellung 08:00 UTC.
 *  - Als Entwurf übernehmen schreibt die Tabellen des Entwurfs aus der Fassung.
 *
 * Systemuhr (TESTING_GUIDELINES §1): Zeiten großzügig in Tagen gesetzt. Die acht
 * Abschnitte sind geteilter Zustand — jeder Test stellt sie im afterEach wieder
 * her und löscht seine Blöcke und Fassungen.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()), draftMode: vi.fn(async () => ({ isEnabled: false, enable: vi.fn() })) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }))
vi.mock('next/navigation', () => ({ redirect: vi.fn(), notFound: vi.fn(), unstable_rethrow: vi.fn() }))

import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { NEUER_BLOCK, STANDARD_REIHENFOLGE } from '@/lib/startseite-gestalten'
import { standardFassung } from '@/lib/startseite-fassung'
import type { FassungInhalt } from '@/schemas/startseite-fassung'
import { speichereEntwurf, uebernehmeFassungAlsEntwurf, veroeffentlicheStartseite, zieheFassungZurueck } from '@/server/actions/startseite'
import { ladeStartseite, ladeStartseiteAdmin } from '@/server/queries/startseite'
import { erstelleHofMitAnmeldung, raeumeAuf } from './setup/basis'

const SEED_IDS = STANDARD_REIHENFOLGE.map((art) => `startseite-${art.toLowerCase().replace(/_/g, '-')}`)
const TAG_MS = 24 * 60 * 60 * 1000
const INT_ADMIN = 'int-admin-fassung'

afterEach(async () => {
  vi.mocked(headers).mockResolvedValue(new Headers() as never)
  const testPersonen = await prisma.user.findMany({ where: { email: { startsWith: 'int-' } }, select: { id: true } })
  const ids = [INT_ADMIN, ...testPersonen.map((p) => p.id)]
  await prisma.startseiteFassung.deleteMany({ where: { erstelltVonUserId: { in: ids } } })
  await prisma.startseiteBlock.deleteMany({ where: { OR: [{ erstelltVonUserId: { in: ids } }, { titel: { startsWith: 'int-' } }] } })
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

function mitFragen(sichtbar: boolean): FassungInhalt {
  return { v: 1, zeilen: standardFassung().zeilen.map((z) => (z.art === 'FRAGEN' ? { ...z, sichtbar } : z)) }
}

async function fassung(liveAb: Date, inhalt: FassungInhalt, zurueckgezogenAm: Date | null = null): Promise<string> {
  const f = await prisma.startseiteFassung.create({ data: { inhalt, liveAb, zurueckgezogenAm, erstelltVonUserId: INT_ADMIN }, select: { id: true } })
  return f.id
}

const fragenSichtbar = async (): Promise<boolean | undefined> => (await ladeStartseite(new Date())).find((z) => z.art === 'FRAGEN')?.sichtbar

/** Der Samstag vor der Umstellung Ende Oktober — der nächste, der noch kommt (höchstens ein Jahr voraus). */
function samstagVorUmstellung(jetzt: Date): string {
  for (const jahr of [jetzt.getUTCFullYear(), jetzt.getUTCFullYear() + 1]) {
    const letzterOktober = new Date(Date.UTC(jahr, 9, 31))
    const sonntag = 31 - letzterOktober.getUTCDay()
    const samstag = new Date(Date.UTC(jahr, 9, sonntag - 1, 12))
    if (samstag.getTime() > jetzt.getTime() + TAG_MS) return samstag.toISOString().slice(0, 10)
  }
  throw new Error('kein Samstag gefunden')
}

describe('Migration', () => {
  it('legt die Tabelle mit RLS an — ohne Seed', async () => {
    const rls = await prisma.$queryRaw<{ relrowsecurity: boolean }[]>`SELECT relrowsecurity FROM pg_class WHERE relname = 'StartseiteFassung'`
    expect(rls).toEqual([{ relrowsecurity: true }])
    const index = await prisma.$queryRaw<{ indexname: string }[]>`SELECT indexname FROM pg_indexes WHERE tablename = 'StartseiteFassung' AND indexname = 'StartseiteFassung_liveAb_idx'`
    expect(index).toHaveLength(1)
    expect(await prisma.startseiteFassung.count({ where: { erstelltVonUserId: { not: INT_ADMIN } } })).toBe(0)
  })
})

describe('Auswahl der Live-Fassung', () => {
  it('nimmt von vergangen, künftig und zurückgezogen die vergangene — Startseite und Zeitplan gleich', async () => {
    const jetzt = Date.now()
    const vergangen = await fassung(new Date(jetzt - 3 * TAG_MS), mitFragen(false))
    const kuenftig = await fassung(new Date(jetzt + 3 * TAG_MS), mitFragen(true))
    await fassung(new Date(jetzt - TAG_MS), mitFragen(true), new Date(jetzt - 2 * TAG_MS))

    expect(await fragenSichtbar()).toBe(false)
    const admin = await ladeStartseiteAdmin(new Date())
    expect(admin.live?.id).toBe(vergangen)
    expect(admin.geplant.map((f) => f.id)).toEqual([kuenftig])
    expect(admin.frueher).toEqual([])
  })

  it('zeigt ohne Fassung die Standard-Reihenfolge', async () => {
    expect((await ladeStartseite(new Date())).map((z) => z.art)).toEqual([...STANDARD_REIHENFOLGE])
  })
})

describe('Veröffentlichen', () => {
  it('schreibt den Entwurf dieses Moments als Fassung — der Entwurf allein ändert die Startseite nicht', async () => {
    const adminId = await alsAdmin()
    const reihenfolge = SEED_IDS.map((id) => ({ id, sichtbar: id !== 'startseite-fragen' }))
    expect(await speichereEntwurf({ reihenfolge, block: null })).toMatchObject({ ok: true })
    expect(await fragenSichtbar()).toBe(true)

    expect(await veroeffentlicheStartseite({ wann: 'jetzt' })).toMatchObject({ ok: true })

    const geschrieben = await prisma.startseiteFassung.findMany({ where: { erstelltVonUserId: adminId } })
    expect(geschrieben).toHaveLength(1)
    expect(geschrieben[0].inhalt).toEqual(mitFragen(false))
    expect(await fragenSichtbar()).toBe(false)
  })

  it('nimmt einen neuen Block mit in die Fassung — mit seiner Kennung aus dem Entwurf', async () => {
    const adminId = await alsAdmin()
    const reihenfolge = [{ id: SEED_IDS[0], sichtbar: true }, { id: NEUER_BLOCK, sichtbar: true }, ...SEED_IDS.slice(1).map((id) => ({ id, sichtbar: true }))]
    const block = {
      vorlage: 'HINWEISBAND' as const,
      ueberzeile: null,
      titel: 'int-Winterpause',
      text: null,
      bildUrl: null,
      linkUrl: null,
      linkText: null,
      farmIds: [],
      kategorie: null,
      liveAbTag: '2026-01-01',
      liveAbUhrzeit: '06:00',
      liveBisTag: null,
      liveBisUhrzeit: null,
    }
    const gespeichert = await speichereEntwurf({ reihenfolge, block })
    expect(gespeichert).toMatchObject({ ok: true })
    const blockId = 'blockId' in gespeichert ? gespeichert.blockId : null

    expect(await veroeffentlicheStartseite({ wann: 'jetzt' })).toMatchObject({ ok: true })
    const [f] = await prisma.startseiteFassung.findMany({ where: { erstelltVonUserId: adminId } })
    expect((f.inhalt as FassungInhalt).zeilen[1]).toEqual({
      art: 'BLOCK',
      sichtbar: true,
      block: { id: blockId, vorlage: 'HINWEISBAND', titel: 'int-Winterpause', farmIds: [], liveAb: '2026-01-01T05:00:00.000Z' },
    })
  })

  it('rechnet Wiener Zeit an der Sommerzeitgrenze richtig um', async () => {
    const adminId = await alsAdmin()
    const samstag = samstagVorUmstellung(new Date())
    const sonntag = new Date(Date.parse(`${samstag}T12:00:00Z`) + TAG_MS).toISOString().slice(0, 10)
    expect(await veroeffentlicheStartseite({ wann: 'termin', datum: samstag, uhrzeit: '09:00' })).toMatchObject({ ok: true, liveAb: `${samstag}T07:00:00.000Z` })
    expect(await veroeffentlicheStartseite({ wann: 'termin', datum: sonntag, uhrzeit: '09:00' })).toMatchObject({ ok: true, liveAb: `${sonntag}T08:00:00.000Z` })
    const geplant = await prisma.startseiteFassung.findMany({ where: { erstelltVonUserId: adminId }, orderBy: { liveAb: 'asc' }, select: { liveAb: true } })
    expect(geplant.map((g) => g.liveAb.toISOString())).toEqual([`${samstag}T07:00:00.000Z`, `${sonntag}T08:00:00.000Z`])
    // Geplant ist noch nicht live.
    expect(await fragenSichtbar()).toBe(true)
  })
})

describe('Zurückziehen', () => {
  it('zieht eine geplante Fassung zurück, eine laufende nicht', async () => {
    await alsAdmin()
    const jetzt = Date.now()
    const laufend = await fassung(new Date(jetzt - TAG_MS), mitFragen(false))
    const geplant = await fassung(new Date(jetzt + TAG_MS), mitFragen(true))

    expect(await zieheFassungZurueck({ id: laufend })).toEqual({ error: 'Diese Fassung ist schon live oder zurückgezogen. Lade die Seite neu.' })
    expect(await zieheFassungZurueck({ id: geplant })).toEqual({ ok: true })

    const stand = await prisma.startseiteFassung.findMany({ where: { id: { in: [laufend, geplant] } }, select: { id: true, zurueckgezogenAm: true } })
    expect(stand.find((f) => f.id === laufend)?.zurueckgezogenAm).toBeNull()
    expect(stand.find((f) => f.id === geplant)?.zurueckgezogenAm).toBeInstanceOf(Date)
    expect(await fragenSichtbar()).toBe(false)
  })
})

describe('Als Entwurf übernehmen', () => {
  it('schreibt Reihenfolge, Auge und Blöcke der Fassung in den Entwurf', async () => {
    await alsAdmin()
    const [kopf, hoefe, futter, brenn, ...rest] = mitFragen(false).zeilen
    const alt: FassungInhalt = {
      v: 1,
      zeilen: [
        kopf,
        hoefe,
        { art: 'BLOCK', sichtbar: true, block: { vorlage: 'HINWEISBAND', titel: 'int-Erntedank am Hof', farmIds: [], liveAb: '2026-10-01T04:00:00.000Z' } },
        brenn,
        futter,
        ...rest,
      ],
    }
    const id = await fassung(new Date(Date.now() - 10 * TAG_MS), alt)
    const liveVorher = await ladeStartseite(new Date())

    expect(await uebernehmeFassungAlsEntwurf({ id })).toMatchObject({ ok: true })

    const zeilen = await prisma.startseiteAbschnitt.findMany({ orderBy: [{ position: 'asc' }, { id: 'asc' }], include: { block: true } })
    expect(zeilen.map((z) => [z.art, z.sichtbar])).toEqual([
      ['KOPF', true],
      ['HOEFE', true],
      ['BLOCK', true],
      ['BRENNMATERIAL', true],
      ['FUTTER', true],
      ['SO_FUNKTIONIERTS', true],
      ['FUER_HOEFE', true],
      ['FRAGEN', false],
      ['FUSS', true],
    ])
    expect(zeilen[2].block).toMatchObject({ titel: 'int-Erntedank am Hof', vorlage: 'HINWEISBAND' })
    // Live ändert sich dadurch nicht.
    expect(await ladeStartseite(new Date())).toEqual(liveVorher)
  })
})
