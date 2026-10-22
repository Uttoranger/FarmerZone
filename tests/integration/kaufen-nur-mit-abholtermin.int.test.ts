/**
 * Freischalten erst mit aktiver Abholzeit (Register Z1, Ergänzung 21.10.2026; /fix „Kaufen nur mit
 * Abholtermin“, N24) gegen ein ECHTES Postgres.
 *
 * Die Aussage:
 *  - approveFarmAction mit echter Admin-Anmeldung lehnt einen wartenden Hof ohne aktive Abholzeit ab
 *    (abgeschaltete Abholzeiten zählen nicht) und lässt ihn wartend; mit einer aktiven Abholzeit geht es.
 *  - Admin › Höfe: Ein schon freigeschalteter Hof ohne aktive Abholzeit trägt in den Daten der Seite
 *    (getAdminFarms → adminHofZeile) die Marke „Abholzeit fehlt“ und steht im gleichnamigen Filter; er
 *    bleibt freigeschaltet. Gegenprobe: mit aktiver Abholzeit nicht.
 *
 * Alles trägt das Präfix int- (raeumeAuf). Die Einstellung der Gründung wird je Fall gesetzt und im
 * afterEach exakt zurückgeschrieben. Die Uhr bleibt echt (geteilte Test-DB); geprüft werden Zustände.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }))
vi.mock('next/navigation', () => ({ redirect: vi.fn(), notFound: vi.fn(), unstable_rethrow: vi.fn() }))
vi.mock('@/lib/email', () => ({ sendFreischaltungEmail: vi.fn(async () => ({})) }))

import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { ABHOLZEIT_FEHLT_TEXT, FREISCHALTUNG_ABHOLZEIT_OFFEN_TEXT, adminHofZeile, filtereHoefe } from '@/lib/admin-hoefe'
import { approveFarmAction } from '@/server/actions/admin'
import { getAdminFarms } from '@/server/queries/admin'
import { erstelleHof, erstelleHofMitAnmeldung, erstelleProdukt, machePasskeyAdmin, raeumeAuf } from './setup/basis'

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
async function alsAdmin(): Promise<void> {
  const { ownerId, cookie } = await erstelleHofMitAnmeldung()
  await machePasskeyAdmin(ownerId)
  vi.mocked(headers).mockResolvedValue(new Headers({ cookie }) as never)
}

/** Alle Abholzeiten des Hofs abschalten — es gibt sie noch, aber keine ist aktiv. */
async function schalteAbholzeitenAb(farmId: string): Promise<void> {
  await prisma.pickupSlot.updateMany({ where: { farmId }, data: { isActive: false } })
}

describe('approveFarmAction — erst mit aktiver Abholzeit (Z1, Ergänzung 21.10.2026)', () => {
  it('ohne aktive Abholzeit abgewiesen, der Hof bleibt wartend; mit einer aktiven geht es', async () => {
    await alsAdmin()
    // Ein wartender Hof, den die übrigen Sperren durchlassen: E-Mail bestätigt, Stripe fertig, ein Produkt im Shop.
    const { farm } = await erstelleHof({ approvedAt: null, stripeAccountReady: true })
    await erstelleProdukt(farm.id)
    await schalteAbholzeitenAb(farm.id)

    expect(await approveFarmAction(farm.id)).toEqual({ error: FREISCHALTUNG_ABHOLZEIT_OFFEN_TEXT })
    expect((await prisma.farm.findUniqueOrThrow({ where: { id: farm.id } })).approvedAt).toBeNull()

    // Gegenprobe: eine Abholzeit wieder aktiv — jetzt geht es.
    const eine = await prisma.pickupSlot.findFirstOrThrow({ where: { farmId: farm.id } })
    await prisma.pickupSlot.update({ where: { id: eine.id }, data: { isActive: true } })
    expect(await approveFarmAction(farm.id)).toEqual({})
    expect((await prisma.farm.findUniqueOrThrow({ where: { id: farm.id } })).approvedAt).not.toBeNull()
  })
})

describe('Admin › Höfe — die Marke „Abholzeit fehlt“', () => {
  const JETZT = new Date()

  async function zeileVon(farmId: string) {
    const hof = (await getAdminFarms(JETZT)).find((f) => f.id === farmId)
    if (!hof) throw new Error('Hof fehlt in getAdminFarms')
    return { hof, zeile: adminHofZeile(hof, { gruendungsplatz: null, maxPlaetze: 12 }, JETZT) }
  }

  it('ein freigeschalteter Hof ohne aktive Abholzeit: Marke und Filter, bleibt freigeschaltet, keine Sperre', async () => {
    const { farm } = await erstelleHof({ stripeAccountReady: true })
    await erstelleProdukt(farm.id)
    await schalteAbholzeitenAb(farm.id)

    const { hof, zeile } = await zeileVon(farm.id)
    expect(hof.abholzeitAktiv).toBe(false)
    expect(zeile.abholzeitFehlt).toBe(true)
    expect(zeile.status.text).toBe(ABHOLZEIT_FEHLT_TEXT)
    expect(zeile.sperre).toBeNull()
    expect(filtereHoefe([zeile], { filter: 'abholzeit-fehlt', suche: '' }).map((z) => z.id)).toEqual([farm.id])
    // Keine Datenänderung: Der Hof bleibt freigeschaltet.
    expect((await prisma.farm.findUniqueOrThrow({ where: { id: farm.id } })).approvedAt).not.toBeNull()
  })

  it('Gegenprobe: mit aktiver Abholzeit keine Marke, nicht im Filter', async () => {
    const { farm } = await erstelleHof({ stripeAccountReady: true })
    await erstelleProdukt(farm.id)

    const { hof, zeile } = await zeileVon(farm.id)
    expect(hof.abholzeitAktiv).toBe(true)
    expect(zeile.abholzeitFehlt).toBe(false)
    expect(zeile.status.text).not.toBe(ABHOLZEIT_FEHLT_TEXT)
    expect(filtereHoefe([zeile], { filter: 'abholzeit-fehlt', suche: '' })).toEqual([])
  })
})
