/**
 * Gründungshöfe: Testhöfe ausnehmen (Register K2, Ergänzung 16.10.2026,
 * Nachtlauf Nr. 109) gegen ein ECHTES Postgres.
 *
 * Die Aussage:
 *  - Die Migration 20261016120000_gruendung_ausgenommen ist anwendbar
 *    (global-setup fährt `migrate deploy`): drei Spalten, die Pflichtspalte mit
 *    Default false. DEPLOY-FENSTER: Ein Hof aus altem Code (rohes INSERT ohne
 *    die Spalten) zählt wie bisher. Ein zweiter Lauf lässt einen
 *    ausgenommenen Hof ausgenommen.
 *  - Zwei gleichzeitige Wiederaufnahmen bei einem freien Platz: genau eine
 *    gelingt — die Sperre GRUENDUNGSPLAETZE_SPERRE reiht sie hintereinander.
 *  - Freischalten ∥ Wiederaufnahme bei einem freien Platz: genau einer bekommt
 *    ihn; der Freigeschaltete bekommt die Gründungs-Nachricht nur mit Platz.
 *    Kein Hof, der vorher einen Platz hatte, verliert ihn.
 *  - Ohne Admin nichts; ohne Haken bei Platz abgewiesen, mit Haken
 *    ausgenommen samt wer und wann; wieder aufgenommen zählt er wieder.
 *
 * Nebenläufigkeit: Zugesichert wird der ZUSTAND, nicht der Zweig
 * (TESTING_GUIDELINES §1). Die Zahl der Plätze setzt jeder Test so, dass genau
 * ein Platz frei ist (der Seed hat freigeschaltete Höfe); die Zeile der
 * Einstellung kommt im afterEach zurück.
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
import { gruendungAlleVergeben, gruendungsplaetze } from '@/lib/gruendungshof'
import { GRUENDUNG_AUSNEHMEN_ZUSTIMMUNG_FEHLT } from '@/schemas/gruendung'
import { nimmAusGruendung, nimmWiederAuf } from '@/server/actions/gruendung'
import { approveFarmAction } from '@/server/actions/admin'
import { ladeHoefeFuerGruendung } from '@/server/queries/admin'
import { erstelleHof, erstelleHofMitAnmeldung, intKennung, raeumeAuf, erstelleProdukt, machePasskeyAdmin } from './setup/basis'

const MIGRATION = readFileSync(join(process.cwd(), 'prisma', 'migrations', '20261016120000_gruendung_ausgenommen', 'migration.sql'), 'utf8')

/** Vor jedem Hof des Seeds freigeschaltet — damit Platz 1. */
const FRUEH = new Date('2000-01-01T00:00:00.000Z')

type Zeile = Awaited<ReturnType<typeof prisma.plattformEinstellung.findUnique>>
let vorher: Zeile = null

beforeEach(async () => {
  vorher = await prisma.plattformEinstellung.findUnique({ where: { id: 'plattform' } })
})

afterEach(async () => {
  vi.mocked(headers).mockResolvedValue(new Headers() as never)
  if (vorher) {
    const { id, ...werte } = vorher
    await prisma.plattformEinstellung.update({ where: { id }, data: { ...werte, zustellRegeln: werte.zustellRegeln ?? undefined } })
  }
  await raeumeAuf()
})

/** Ein Admin mit echter Sitzung — das Cookie geht über das gemockte headers() an die Action. */
async function alsAdmin(): Promise<string> {
  const { ownerId, cookie } = await erstelleHofMitAnmeldung()
  await machePasskeyAdmin(ownerId)
  vi.mocked(headers).mockResolvedValue(new Headers({ cookie }) as never)
  return ownerId
}

/** Höfe im Rennen jetzt (freigeschaltet, nicht stillgelegt, nicht ausgenommen) — Seed und Test zusammen. */
async function imRennen(): Promise<Map<string, number>> {
  return gruendungsplaetze(await ladeHoefeFuerGruendung())
}

async function setzePlaetze(plaetze: number): Promise<void> {
  await prisma.plattformEinstellung.update({ where: { id: 'plattform' }, data: { gruendungPlaetze: plaetze } })
}

async function ausgenommen(id: string): Promise<boolean> {
  return (await prisma.farm.findUniqueOrThrow({ where: { id }, select: { gruendungAusgenommen: true } })).gruendungAusgenommen
}

describe('Spalten an Farm', () => {
  it('drei Spalten: gruendungAusgenommen boolean NOT NULL DEFAULT false, die anderen nullable ohne Default', async () => {
    const spalten = await prisma.$queryRaw<{ column_name: string; data_type: string; is_nullable: string; column_default: string | null }[]>`
      SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'Farm'
        AND column_name IN ('gruendungAusgenommen', 'gruendungGeaendertAm', 'gruendungGeaendertVonUserId')
      ORDER BY column_name`
    expect(spalten).toEqual([
      { column_name: 'gruendungAusgenommen', data_type: 'boolean', is_nullable: 'NO', column_default: 'false' },
      { column_name: 'gruendungGeaendertAm', data_type: 'timestamp without time zone', is_nullable: 'YES', column_default: null },
      { column_name: 'gruendungGeaendertVonUserId', data_type: 'text', is_nullable: 'YES', column_default: null },
    ])
  })

  it('Deploy-Fenster: ein Hof aus altem Code zählt wie bisher; ein zweiter Lauf lässt einen ausgenommenen Hof stehen', async () => {
    const kennung = intKennung('althof')
    await prisma.user.create({ data: { id: kennung, email: `${kennung}@example.com`, name: 'Max Mustermann', role: 'FARMER' } })
    // Nur Spalten, die es vor der Migration gab — so schreibt der alte Code.
    await prisma.$executeRaw`
      INSERT INTO "Farm" ("id", "slug", "name", "ownerName", "description", "address",
                          "postalCode", "city", "phone", "email", "ownerId", "approvedAt", "updatedAt")
      VALUES (${kennung}, ${kennung}, 'Testhof A', 'Max Mustermann', 'Erfundener Hof.',
              'Teststraße 1', '8700', 'Teststadt', '+43 660 0000000',
              ${`${kennung}@example.com`}, ${kennung}, ${FRUEH}, now())`
    expect(await ausgenommen(kennung)).toBe(false)
    expect((await imRennen()).has(kennung)).toBe(true)

    const { farm } = await erstelleHof({ gruendungAusgenommen: true })
    for (const anweisung of MIGRATION.replace(/--.*$/gm, '')
      .split(';')
      .map((teil) => teil.trim())
      .filter(Boolean)) {
      await prisma.$executeRawUnsafe(anweisung)
    }
    expect(await ausgenommen(farm.id)).toBe(true)
    expect(await ausgenommen(kennung)).toBe(false)
  })
})

describe('Sperre: der letzte freie Platz geht genau einmal weg', () => {
  it('zwei gleichzeitige Wiederaufnahmen bei einem freien Platz: genau eine', async () => {
    await alsAdmin()
    for (let runde = 0; runde < 3; runde++) {
      const { farm: a } = await erstelleHof({ gruendungAusgenommen: true })
      const { farm: b } = await erstelleHof({ gruendungAusgenommen: true })
      const plaetze = (await imRennen()).size + 1
      await setzePlaetze(plaetze)

      const ergebnisse = await Promise.all([nimmWiederAuf({ farmId: a.id }), nimmWiederAuf({ farmId: b.id })])

      // Zustand, nicht Zweig: genau einer zählt wieder, die Plätze sind voll, nicht überbucht.
      expect([await ausgenommen(a.id), await ausgenommen(b.id)].filter((x) => !x)).toHaveLength(1)
      expect((await imRennen()).size).toBe(plaetze)
      expect(ergebnisse.filter((e) => 'ok' in e)).toHaveLength(1)
      expect(ergebnisse.filter((e) => 'error' in e)).toEqual([{ error: gruendungAlleVergeben(plaetze) }])
    }
  })

  it('Freischalten ∥ Wiederaufnahme bei einem freien Platz: genau einer bekommt ihn, kein anderer Hof verliert seinen', async () => {
    await alsAdmin()
    for (let runde = 0; runde < 3; runde++) {
      const { farm: zurueck } = await erstelleHof({ gruendungAusgenommen: true })
      const { farm: neu } = await erstelleHof({ approvedAt: null, stripeAccountReady: true })
      // Seit Nr. 116 verlangt das Freischalten ein Produkt im Shop (Register K2).
      await erstelleProdukt(neu.id)
      const vorherPlaetze = await imRennen()
      const plaetze = vorherPlaetze.size + 1
      await setzePlaetze(plaetze)

      const [freigabe, wieder] = await Promise.all([approveFarmAction(neu.id), nimmWiederAuf({ farmId: zurueck.id })])

      // Freischalten gelingt immer (die Plätze sind eine Konditions-, keine Zugangsgrenze).
      expect(freigabe).toEqual({})
      const nachher = await imRennen()
      const neuHatPlatz = (nachher.get(neu.id) ?? Infinity) <= plaetze
      const zurueckZaehlt = !(await ausgenommen(zurueck.id))
      // Genau einer von beiden hat den letzten Platz.
      expect(neuHatPlatz !== zurueckZaehlt).toBe(true)
      expect('ok' in wieder).toBe(zurueckZaehlt)
      // Die Gründungs-Nachricht nur mit Platz — sie nennt nie einen Platz, den es danach nicht gibt.
      expect(await prisma.nachricht.count({ where: { unterhaltung: { farmId: neu.id } } })).toBe(neuHatPlatz ? 1 : 0)
      // Wer vorher einen Platz hatte, hat danach einen.
      for (const id of vorherPlaetze.keys()) expect(nachher.get(id) ?? Infinity).toBeLessThanOrEqual(plaetze)
    }
  })
})

describe('mit echter Admin-Anmeldung', () => {
  it('ohne Admin-Recht: nichts geschrieben', async () => {
    const { farm } = await erstelleHof({ approvedAt: FRUEH })
    const { cookie } = await erstelleHofMitAnmeldung()
    vi.mocked(headers).mockResolvedValue(new Headers({ cookie }) as never)

    expect(await nimmAusGruendung({ farmId: farm.id, bestaetigt: true })).toEqual({ error: 'Kein Zugriff.' })
    expect(await ausgenommen(farm.id)).toBe(false)
  })

  it('Hof mit Platz: ohne Haken abgewiesen, mit Haken ausgenommen samt wer und wann, wieder aufgenommen zählt er wieder', async () => {
    const adminId = await alsAdmin()
    await setzePlaetze(999)
    const { farm } = await erstelleHof({ approvedAt: FRUEH })

    expect(await nimmAusGruendung({ farmId: farm.id, bestaetigt: false })).toEqual({ error: GRUENDUNG_AUSNEHMEN_ZUSTIMMUNG_FEHLT })
    expect(await prisma.farm.findUniqueOrThrow({ where: { id: farm.id } })).toMatchObject({
      gruendungAusgenommen: false,
      gruendungGeaendertAm: null,
      gruendungGeaendertVonUserId: null,
    })

    expect(await nimmAusGruendung({ farmId: farm.id, bestaetigt: true })).toEqual({ ok: true })
    const aus = await prisma.farm.findUniqueOrThrow({ where: { id: farm.id } })
    expect(aus).toMatchObject({ gruendungAusgenommen: true, gruendungGeaendertVonUserId: adminId })
    expect(aus.gruendungGeaendertAm).toBeInstanceOf(Date)
    expect((await imRennen()).has(farm.id)).toBe(false)
    // Zweimal ausnehmen ändert nichts — auch nicht „zuletzt geändert“.
    expect('error' in (await nimmAusGruendung({ farmId: farm.id, bestaetigt: true }))).toBe(true)
    expect((await prisma.farm.findUniqueOrThrow({ where: { id: farm.id } })).gruendungGeaendertAm).toEqual(aus.gruendungGeaendertAm)

    expect(await nimmWiederAuf({ farmId: farm.id })).toEqual({ ok: true })
    expect(await ausgenommen(farm.id)).toBe(false)
    expect((await imRennen()).get(farm.id)).toBe(1)
  })
})
