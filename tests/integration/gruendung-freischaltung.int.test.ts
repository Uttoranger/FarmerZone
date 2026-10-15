/**
 * Gründungshöfe sichtbar (Register K2-Ergänzung, Nr. 93) gegen ein ECHTES
 * Postgres.
 *
 * Die Aussage:
 *  - Die Migration 20261015120000_plattform_einstellung ist anwendbar
 *    (global-setup fährt `migrate deploy`): genau eine Zeile "plattform" mit
 *    den Standardwerten, RLS an; ein zweiter Lauf lässt eine geänderte Zeile
 *    stehen.
 *  - approveFarmAction mit echter Admin-Anmeldung legt nach dem Vergeben des
 *    Platzes GENAU EINE Nachricht an (Faden ohne Rundschreiben, Art SYSTEM,
 *    Link „Deine Konditionen") — auch nach Zurücknehmen und erneutem
 *    Freischalten nicht eine zweite; ohne freien Platz keine.
 *  - speichereGruendungEinstellung lehnt „weniger Plätze als vergeben" ab und
 *    schreibt dann nichts; bis zur Nacharbeit ebenso jede Abweichung von 12
 *    Plätzen bzw. 31.12.2027 (Sperre); nur die Anzeige umgeschaltet: Werte und
 *    Person stehen in der Zeile.
 *
 * Die Zeile ist geteilter Zustand der Test-Datenbank: Jeder Test stellt sie
 * im afterEach wieder her. Der Seed hat freigeschaltete Höfe — ein frisch
 * freigeschalteter Hof steht hinter ihnen; die Tests setzen die Plätze so,
 * dass er einen bekommt bzw. nicht.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }))
vi.mock('next/navigation', () => ({ redirect: vi.fn(), notFound: vi.fn(), unstable_rethrow: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendFreischaltungEmail: vi.fn(async () => ({})) }))

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { GRUENDUNG_BIS_STANDARD_TAG, MAX_GRUENDUNGSHOEFE, gruendungsplatzVon } from '@/lib/gruendungshof'
import { GRUENDUNGS_NACHRICHT_LINK } from '@/lib/postfach'
import { GRUENDUNG_EINSTELLUNG_FEHLER } from '@/lib/plattform-einstellung'
import { approveFarmAction, revokeFarmApprovalAction } from '@/server/actions/admin'
import { speichereGruendungEinstellung } from '@/server/actions/plattform-einstellung'
import { ladeHoefeFuerGruendung } from '@/server/queries/admin'
import { erstelleHof, erstelleHofMitAnmeldung, raeumeAuf } from './setup/basis'

const MIGRATION = readFileSync(join(process.cwd(), 'prisma', 'migrations', '20261015120000_plattform_einstellung', 'migration.sql'), 'utf8')

type Zeile = Awaited<ReturnType<typeof prisma.plattformEinstellung.findUnique>>
let vorher: Zeile = null

beforeEach(async () => {
  vorher = await prisma.plattformEinstellung.findUnique({ where: { id: 'plattform' } })
})

afterEach(async () => {
  vi.mocked(headers).mockResolvedValue(new Headers() as never)
  // Die eine Zeile so zurück, wie der Test sie vorfand.
  if (vorher) {
    const { id, ...werte } = vorher
    await prisma.plattformEinstellung.update({ where: { id }, data: { ...werte, zustellRegeln: werte.zustellRegeln ?? undefined } })
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

/** Ein wartender Hof, den die Sperren durchlassen (E-Mail bestätigt, Stripe fertig). */
async function wartenderHof() {
  const { farm } = await erstelleHof({ approvedAt: null, stripeAccountReady: true })
  return farm
}

async function setzePlaetze(plaetze: number): Promise<void> {
  await prisma.plattformEinstellung.update({ where: { id: 'plattform' }, data: { gruendungPlaetze: plaetze } })
}

function gruendungsNachrichten(farmId: string) {
  return prisma.nachricht.findMany({ where: { unterhaltung: { farmId } }, include: { unterhaltung: true } })
}

describe('Tabelle PlattformEinstellung', () => {
  it('genau eine Zeile "plattform" mit den Standardwerten der Spalten, RLS an', async () => {
    const spalten = await prisma.$queryRaw<{ column_name: string; column_default: string | null }[]>`
      SELECT column_name, column_default FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'PlattformEinstellung' ORDER BY column_name`
    expect(Object.fromEntries(spalten.map((s) => [s.column_name, s.column_default]))).toMatchObject({
      gruendungPlaetze: '12',
      gruendungBisStandard: "'2027-12-31'::date",
      gruendungAnzeige: 'true',
      zustellRegeln: null,
    })
    expect(await prisma.plattformEinstellung.count()).toBe(1)
    const [rls] = await prisma.$queryRaw<{ relrowsecurity: boolean }[]>`
      SELECT relrowsecurity FROM pg_class WHERE relname = 'PlattformEinstellung'`
    expect(rls?.relrowsecurity).toBe(true)
  })

  it('ein zweiter Lauf der Migration lässt eine geänderte Zeile stehen', async () => {
    await setzePlaetze(30)
    for (const anweisung of MIGRATION.replace(/--.*$/gm, '')
      .split(';')
      .map((teil) => teil.trim())
      .filter(Boolean)) {
      await prisma.$executeRawUnsafe(anweisung)
    }
    expect(await prisma.plattformEinstellung.count()).toBe(1)
    expect((await prisma.plattformEinstellung.findUniqueOrThrow({ where: { id: 'plattform' } })).gruendungPlaetze).toBe(30)
  })
})

describe('approveFarmAction — die eine Gründungs-Nachricht', () => {
  it('mit Platz: genau eine Nachricht, auch nach erneutem Klick und nach Zurücknehmen und Freischalten', async () => {
    await alsAdmin()
    await setzePlaetze(999)
    const farm = await wartenderHof()

    expect(await approveFarmAction(farm.id)).toEqual({})
    const platz = gruendungsplatzVon(farm.id, await ladeHoefeFuerGruendung())
    const nachrichten = await gruendungsNachrichten(farm.id)
    expect(nachrichten).toHaveLength(1)
    expect(nachrichten[0]).toMatchObject({
      vonFarmId: null,
      art: 'SYSTEM',
      linkUrl: GRUENDUNGS_NACHRICHT_LINK,
      unterhaltung: { rundschreibenId: null },
    })
    expect(nachrichten[0]?.text).toContain(`Du bist Gründungshof Nr. ${platz} – Hofladen ohne Grundgebühr bis 31.`)

    // Ein zweiter Klick trifft nichts (schon freigeschaltet) — keine zweite Nachricht.
    expect((await approveFarmAction(farm.id)).error).toBeDefined()
    // Zurücknehmen und wieder freischalten: die eigene Prüfung hält die eine.
    expect(await revokeFarmApprovalAction(farm.id)).toEqual({})
    expect(await approveFarmAction(farm.id)).toEqual({})
    expect(await gruendungsNachrichten(farm.id)).toHaveLength(1)
    expect(await prisma.unterhaltung.count({ where: { farmId: farm.id } })).toBe(1)
  })

  it('ohne freien Platz: freigeschaltet, aber keine Nachricht', async () => {
    await alsAdmin()
    await setzePlaetze(0)
    const farm = await wartenderHof()

    expect(await approveFarmAction(farm.id)).toEqual({})
    expect((await prisma.farm.findUniqueOrThrow({ where: { id: farm.id } })).approvedAt).not.toBeNull()
    expect(await gruendungsNachrichten(farm.id)).toHaveLength(0)
  })
})

describe('speichereGruendungEinstellung mit echter Admin-Anmeldung', () => {
  it('weniger Plätze als vergeben: abgelehnt, die Zeile bleibt', async () => {
    await alsAdmin()
    await setzePlaetze(999)
    await erstelleHof() // mindestens ein Hof im Rennen, auch ohne Seed
    const vergeben = (await ladeHoefeFuerGruendung()).length

    const ergebnis = await speichereGruendungEinstellung({ plaetze: vergeben - 1, bisTag: '2099-12-31', anzeige: true })
    expect(ergebnis).toEqual({ error: GRUENDUNG_EINSTELLUNG_FEHLER.weniger(vergeben) })
    expect((await prisma.plattformEinstellung.findUniqueOrThrow({ where: { id: 'plattform' } })).gruendungPlaetze).toBe(999)
  })

  it('gesperrt: andere Plätze oder anderes Ende abgelehnt, die Zeile bleibt', async () => {
    await alsAdmin()
    await setzePlaetze(MAX_GRUENDUNGSHOEFE)

    for (const eingabe of [
      { plaetze: MAX_GRUENDUNGSHOEFE + 3, bisTag: GRUENDUNG_BIS_STANDARD_TAG, anzeige: true },
      { plaetze: MAX_GRUENDUNGSHOEFE, bisTag: '2099-06-30', anzeige: true },
    ]) {
      expect(await speichereGruendungEinstellung(eingabe)).toEqual({ error: GRUENDUNG_EINSTELLUNG_FEHLER.gesperrt })
    }
    const zeile = await prisma.plattformEinstellung.findUniqueOrThrow({ where: { id: 'plattform' } })
    expect(zeile.gruendungPlaetze).toBe(MAX_GRUENDUNGSHOEFE)
    expect(zeile.gruendungBisStandard.toISOString()).toBe(vorher?.gruendungBisStandard.toISOString())
  })

  it('gültig (nur die Anzeige umgeschaltet): Werte, DATE und Person stehen in der Zeile', async () => {
    const adminId = await alsAdmin()
    await setzePlaetze(MAX_GRUENDUNGSHOEFE)

    expect(await speichereGruendungEinstellung({ plaetze: MAX_GRUENDUNGSHOEFE, bisTag: GRUENDUNG_BIS_STANDARD_TAG, anzeige: false })).toEqual({ ok: true })
    const zeile = await prisma.plattformEinstellung.findUniqueOrThrow({ where: { id: 'plattform' } })
    expect(zeile).toMatchObject({ gruendungPlaetze: MAX_GRUENDUNGSHOEFE, gruendungAnzeige: false, geaendertVonUserId: adminId })
    expect(zeile.gruendungBisStandard.toISOString()).toBe(`${GRUENDUNG_BIS_STANDARD_TAG}T00:00:00.000Z`)
  })

  it('ohne Admin-Recht: abgelehnt, nichts geschrieben', async () => {
    const { cookie } = await erstelleHofMitAnmeldung()
    vi.mocked(headers).mockResolvedValue(new Headers({ cookie }) as never)
    expect(await speichereGruendungEinstellung({ plaetze: 500, bisTag: '2099-06-30', anzeige: true })).toEqual({ error: 'Kein Zugriff.' })
    expect((await prisma.plattformEinstellung.findUniqueOrThrow({ where: { id: 'plattform' } })).gruendungPlaetze).toBe(vorher?.gruendungPlaetze)
  })
})
