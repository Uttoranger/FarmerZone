/**
 * Aktion „100 Gründungshöfe“ (Register K2, Änderung Nr. 116) gegen echtes
 * Postgres — Aussagen, die nur die Datenbank beantworten kann:
 *  - zwei gleichzeitige Freischaltungen um den letzten Platz: genau eine
 *    bekommt ihn (Sperre + eindeutiger Index), beide sind freigeschaltet;
 *  - die Lage aus Morgenbericht 16: Hof stilllegen, ein anderer rückt NICHT
 *    nach, wieder aktivieren (reactivateFarm unter der Sperre) → beide behalten
 *    ihren Platz;
 *  - Freigabe entziehen und erneut freigeben ändert Platz und Ende nicht;
 *  - „Zusagen festschreiben“ einmal wirklich: Nummern 1…n eindeutig, Ende nie
 *    kürzer, stillgelegter Hof mit Platz, ausgenommener ohne — dabei werden
 *    auch die Seed-Höfe der geteilten Test-DB umgeschrieben; Platz, Ende und
 *    Änderungszeit aller Höfe kommen im finally exakt zurück;
 *  - „Zusagen festschreiben“ ein zweites Mal: abgewiesen, nichts geschrieben;
 *  - der eindeutige Index verbietet eine doppelte Nummer.
 * Die übrigen Fälle schreiben nur über die eine Spalte der Einstellung fest.
 * Die Einstellung kommt nach jedem Fall so zurück, wie der Test sie vorfand.
 * Die Uhr bleibt echt (geteilte Test-DB).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }))
vi.mock('next/navigation', () => ({ redirect: vi.fn(), notFound: vi.fn(), unstable_rethrow: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendFreischaltungEmail: vi.fn(async () => ({})) }))

import { Prisma } from '@prisma/client'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { EINSTELLUNGEN_TEXT } from '@/lib/plattform-einstellung'
import { GRUENDUNG_BIS_STANDARD } from '@/lib/gruendungshof'
import { approveFarmAction, revokeFarmApprovalAction } from '@/server/actions/admin'
import { archiveFarm, reactivateFarm } from '@/server/actions/farm-archive'
import { schreibeZusagenFest } from '@/server/actions/gruendung'
import { erstelleHof, erstelleHofMitAnmeldung, erstelleProdukt, raeumeAuf, machePasskeyAdmin } from './setup/basis'

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

/** Ein Admin mit echter Sitzung; das Cookie geht über das gemockte headers() an die Action. */
async function alsAdmin(): Promise<string> {
  const { ownerId, cookie } = await erstelleHofMitAnmeldung()
  await machePasskeyAdmin(ownerId)
  vi.mocked(headers).mockResolvedValue(new Headers({ cookie }) as never)
  return cookie
}

/** Festgeschrieben, ohne Stichtag, mit genau `frei` freien Plätzen über den schon vergebenen. */
async function festgeschrieben(frei: number): Promise<number> {
  const vergeben = await prisma.farm.count({ where: { gruendungPlatz: { not: null } } })
  await prisma.plattformEinstellung.update({
    where: { id: 'plattform' },
    data: { gruendungFestAm: new Date(), gruendungAktionBis: null, gruendungMonate: 24, gruendungPlaetze: vergeben + frei },
  })
  return vergeben
}

/** Die kleinste Nummer, die noch niemand hält — für Höfe, die der Test mit Platz anlegt. */
async function freieNummern(anzahl: number): Promise<number[]> {
  const belegt = new Set((await prisma.farm.findMany({ where: { gruendungPlatz: { not: null } }, select: { gruendungPlatz: true } })).map((f) => f.gruendungPlatz))
  const frei: number[] = []
  for (let n = 1; frei.length < anzahl; n++) if (!belegt.has(n)) frei.push(n)
  return frei
}

/** Ein wartender Hof, den alle Sperren durchlassen (E-Mail, Stripe, ein Produkt im Shop). */
async function wartenderHof() {
  const { farm } = await erstelleHof({ approvedAt: null, stripeAccountReady: true })
  await erstelleProdukt(farm.id)
  return farm
}

describe('zwei gleichzeitige Freischaltungen um den letzten Platz', () => {
  it('beide sind freigeschaltet, genau eine bekommt den Platz — keine doppelte Nummer', async () => {
    await alsAdmin()
    await festgeschrieben(1)
    const [a, b] = [await wartenderHof(), await wartenderHof()]

    const ergebnisse = await Promise.all([approveFarmAction(a.id), approveFarmAction(b.id)])
    expect(ergebnisse).toEqual([{}, {}])

    const hoefe = await prisma.farm.findMany({ where: { id: { in: [a.id, b.id] } }, select: { approvedAt: true, gruendungPlatz: true, gruendungBis: true } })
    expect(hoefe.every((h) => h.approvedAt !== null)).toBe(true)
    const mitPlatz = hoefe.filter((h) => h.gruendungPlatz !== null)
    expect(mitPlatz).toHaveLength(1)
    // Das Ende ab heute vor dem Tarifstart: der letzte Jänner zwei Jahre nach dem Tarifstart (24 Monate).
    expect(mitPlatz[0]?.gruendungBis?.toISOString().slice(0, 10)).toBe('2029-01-31')
  })
})

describe('Stilllegen und Wieder-Aktivieren nehmen niemandem den Platz (Morgenbericht 16)', () => {
  it('A stilllegen, C rückt nicht nach, A wieder aktivieren — A und B behalten ihre Plätze', async () => {
    const adminCookie = await alsAdmin()
    await festgeschrieben(2)
    const [n1, n2] = await freieNummern(2)
    const ende = new Date('2029-01-31T00:00:00.000Z')
    const a = await erstelleHofMitAnmeldung({ approvedAt: new Date(), stripeAccountReady: true, gruendungPlatz: n1, gruendungBis: ende })
    const { farm: b } = await erstelleHof({ approvedAt: new Date(), stripeAccountReady: true, gruendungPlatz: n2, gruendungBis: ende })

    vi.mocked(headers).mockResolvedValue(new Headers({ cookie: a.cookie }) as never)
    expect(await archiveFarm()).toEqual({})

    vi.mocked(headers).mockResolvedValue(new Headers({ cookie: adminCookie }) as never)
    const c = await wartenderHof()
    expect(await approveFarmAction(c.id)).toEqual({})
    expect((await prisma.farm.findUniqueOrThrow({ where: { id: c.id } })).gruendungPlatz).toBeNull()

    vi.mocked(headers).mockResolvedValue(new Headers({ cookie: a.cookie }) as never)
    expect(await reactivateFarm()).toEqual({})

    const stand = await prisma.farm.findMany({ where: { id: { in: [a.farm.id, b.id, c.id] } }, select: { id: true, archivedAt: true, gruendungPlatz: true } })
    const von = (id: string) => stand.find((h) => h.id === id)
    expect(von(a.farm.id)).toMatchObject({ archivedAt: null, gruendungPlatz: n1 })
    expect(von(b.id)?.gruendungPlatz).toBe(n2)
    expect(von(c.id)?.gruendungPlatz).toBeNull()
  })
})

describe('Freigabe entziehen und erneut freigeben', () => {
  it('Platz und Ende bleiben, wie sie waren — auch nach dem Stichtag', async () => {
    await alsAdmin()
    await festgeschrieben(1)
    const farm = await wartenderHof()
    expect(await approveFarmAction(farm.id)).toEqual({})
    const nachher = await prisma.farm.findUniqueOrThrow({ where: { id: farm.id }, select: { gruendungPlatz: true, gruendungBis: true } })
    expect(nachher.gruendungPlatz).not.toBeNull()

    expect(await revokeFarmApprovalAction(farm.id)).toEqual({})
    expect(await prisma.farm.findUniqueOrThrow({ where: { id: farm.id }, select: { gruendungPlatz: true, gruendungBis: true } })).toEqual(nachher)

    // Stichtag vorbei: Wer schon einen Platz hat, behält ihn bei der erneuten Freigabe.
    await prisma.plattformEinstellung.update({ where: { id: 'plattform' }, data: { gruendungAktionBis: new Date('2026-01-01T00:00:00.000Z') } })
    expect(await approveFarmAction(farm.id)).toEqual({})
    expect(await prisma.farm.findUniqueOrThrow({ where: { id: farm.id }, select: { gruendungPlatz: true, gruendungBis: true } })).toEqual(nachher)
  })
})

describe('Zusagen festschreiben — einmal wirklich in der Datenbank', () => {
  it('Nummern 1…n eindeutig, Ende nie kürzer, stillgelegter Hof mit Platz, ausgenommener ohne', async () => {
    await alsAdmin()
    // Sichern: Platz, Ende und Änderungszeit ALLER Höfe (auch der Seed-Höfe) und die Einstellung.
    const hoefeVorher = await prisma.farm.findMany({ select: { id: true, gruendungPlatz: true, gruendungBis: true, updatedAt: true } })
    try {
      // Ausgangslage vor dem Festschreiben: niemand hält eine Nummer, sonst stieße die Vergabe an den eindeutigen Index.
      await prisma.farm.updateMany({ where: { gruendungPlatz: { not: null } }, data: { gruendungPlatz: null } })
      const { farm: still } = await erstelleHof({ approvedAt: new Date('2026-01-02T10:00:00.000Z'), archivedAt: new Date() })
      const { farm: aus } = await erstelleHof({ approvedAt: new Date('2026-01-02T10:00:00.000Z'), gruendungAusgenommen: true })
      const langesEnde = new Date('2031-06-30T00:00:00.000Z')
      const { farm: lang } = await erstelleHof({ approvedAt: new Date(), gruendungBis: langesEnde })
      const imRennen = await prisma.farm.count({ where: { approvedAt: { not: null }, gruendungAusgenommen: false } })
      await prisma.plattformEinstellung.update({
        where: { id: 'plattform' },
        data: { gruendungFestAm: null, gruendungAktionBis: null, gruendungMonate: 24, gruendungPlaetze: imRennen + 5 },
      })
      const bisVorher = new Map((await prisma.farm.findMany({ select: { id: true, gruendungBis: true } })).map((h) => [h.id, h.gruendungBis]))

      expect(await schreibeZusagenFest({ bestaetigt: true })).toEqual({ ok: true })

      const nachher = await prisma.farm.findMany({
        where: { approvedAt: { not: null } },
        select: { id: true, gruendungPlatz: true, gruendungBis: true, gruendungAusgenommen: true },
      })
      const nummern = nachher.flatMap((h) => (h.gruendungPlatz === null ? [] : [h.gruendungPlatz])).sort((a, b) => a - b)
      expect(nummern).toEqual(Array.from({ length: imRennen }, (_, i) => i + 1))
      for (const h of nachher.filter((z) => z.gruendungPlatz !== null)) {
        // Nie kürzer als bisher (K1): das gespeicherte Ende bzw. der Standard, den ein Gründungshof ohne Ende hatte.
        expect(h.gruendungBis?.getTime()).toBeGreaterThanOrEqual((bisVorher.get(h.id) ?? GRUENDUNG_BIS_STANDARD).getTime())
      }
      const von = (id: string) => nachher.find((h) => h.id === id)
      expect(von(still.id)?.gruendungPlatz).not.toBeNull()
      expect(von(aus.id)?.gruendungPlatz).toBeNull()
      expect(von(lang.id)?.gruendungBis).toEqual(langesEnde)
      expect((await prisma.plattformEinstellung.findUniqueOrThrow({ where: { id: 'plattform' } })).gruendungFestAm).not.toBeNull()
    } finally {
      // Exakt zurück: erst alle Nummern frei, dann die gesicherten Werte (samt Änderungszeit).
      await prisma.farm.updateMany({ where: { gruendungPlatz: { not: null } }, data: { gruendungPlatz: null } })
      for (const { id, ...werte } of hoefeVorher) await prisma.farm.update({ where: { id }, data: werte })
      if (vorher) {
        const { id, ...werte } = vorher
        await prisma.plattformEinstellung.update({ where: { id }, data: { ...werte, zustellRegeln: werte.zustellRegeln ?? undefined } })
      }
    }
  })
})

describe('Zusagen festschreiben und der eindeutige Platz', () => {
  it('ein zweites Mal: abgewiesen, der Zeitpunkt bleibt, kein Hof angefasst', async () => {
    await alsAdmin()
    await festgeschrieben(1)
    const zeitpunkt = (await prisma.plattformEinstellung.findUniqueOrThrow({ where: { id: 'plattform' } })).gruendungFestAm
    const { farm } = await erstelleHof({ approvedAt: new Date() })

    expect(await schreibeZusagenFest({ bestaetigt: true })).toEqual({ error: EINSTELLUNGEN_TEXT.gruendung.festschreibenSchon })
    expect((await prisma.plattformEinstellung.findUniqueOrThrow({ where: { id: 'plattform' } })).gruendungFestAm).toEqual(zeitpunkt)
    expect((await prisma.farm.findUniqueOrThrow({ where: { id: farm.id } })).gruendungPlatz).toBeNull()
  })

  it('zwei Höfe mit derselben Nummer lehnt die Datenbank ab (P2002)', async () => {
    const [n] = await freieNummern(1)
    await erstelleHof({ approvedAt: new Date(), gruendungPlatz: n })
    await expect(erstelleHof({ approvedAt: new Date(), gruendungPlatz: n })).rejects.toSatisfy(
      (fehler) => fehler instanceof Prisma.PrismaClientKnownRequestError && fehler.code === 'P2002'
    )
  })
})
