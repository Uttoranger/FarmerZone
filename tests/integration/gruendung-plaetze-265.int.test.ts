/**
 * Nr. 265 gegen echtes Postgres — Gründungsplätze aus der Einstellung, eine
 * Zählregel (Register K2, Änderung Nr. 116; N48):
 *  - Zählregel: mehr Höfe im Rennen als Plätze → Admin › Einstellungen nennt
 *    als „vergeben“ die Plätze (wie die Action), die Höfe im Rennen nur fürs
 *    Vorausrechnen;
 *  - Einstellung 100: Seiten, Abzeichen-Blatt, Admin › Höfe und das Ende für
 *    Tarif-Zeile und „Dein Stand“ rechnen mit 100 — ein Hof hinter Platz 12
 *    ist Gründungshof;
 *  - Rückfall: ohne Zeile gilt der Standard 12 wie bisher, derselbe Hof hat
 *    keinen Platz.
 * Die Zeile der Einstellung kommt nach jedem Fall so zurück, wie der Test sie
 * vorfand (auch nach dem Löschen). Die Uhr bleibt echt (geteilte Test-DB).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }))
vi.mock('next/navigation', () => ({ redirect: vi.fn(), notFound: vi.fn(), unstable_rethrow: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { MAX_GRUENDUNGSHOEFE, gruendungsplaetze } from '@/lib/gruendungshof'
import { GRUENDUNG_EINSTELLUNG_FEHLER, PLATTFORM_EINSTELLUNG_ID, gruendungEinstellungAus, pruefeGruendungEingabe } from '@/lib/plattform-einstellung'
import { gruendungFuerSeiten, ladeAbzeichenBlatt, ladeGruendungStandAdmin, lesePlattformEinstellung } from '@/server/queries/plattform-einstellung'
import { getAdminFarms, ladeGruendungBis, ladeHoefeFuerGruendung } from '@/server/queries/admin'
import { erstelleHof, raeumeAuf } from './setup/basis'

type Zeile = Awaited<ReturnType<typeof prisma.plattformEinstellung.findUnique>>
let vorher: Zeile = null

beforeEach(async () => {
  vorher = await prisma.plattformEinstellung.findUnique({ where: { id: PLATTFORM_EINSTELLUNG_ID } })
})

afterEach(async () => {
  if (vorher) {
    const { id, ...werte } = vorher
    const daten = { ...werte, zustellRegeln: werte.zustellRegeln ?? undefined }
    await prisma.plattformEinstellung.upsert({ where: { id }, create: { id, ...daten }, update: daten })
  }
  await raeumeAuf()
})

/** Plätze setzen, nicht festgeschrieben — wie vor dem ersten Festschreiben in Produktion. */
async function plaetze(anzahl: number): Promise<void> {
  await prisma.plattformEinstellung.update({ where: { id: PLATTFORM_EINSTELLUNG_ID }, data: { gruendungPlaetze: anzahl, gruendungFestAm: null } })
}

/** Wie viele Höfe schon im Rennen sind (Seed der geteilten Test-DB) — vor dem Festschreiben. */
async function imRennen(): Promise<number> {
  return gruendungsplaetze(await ladeHoefeFuerGruendung()).size
}

/** `anzahl` neue freigeschaltete Höfe, nach allen bisherigen freigeschaltet — der letzte steht hinten. */
async function neueHoefe(anzahl: number): Promise<string[]> {
  const start = Date.now() + 60_000
  const ids: string[] = []
  for (let i = 0; i < anzahl; i++) {
    const { farm } = await erstelleHof({ approvedAt: new Date(start + i * 1000), gruendungPlatz: null, gruendungAusgenommen: false, archivedAt: null })
    ids.push(farm.id)
  }
  return ids
}

describe('eine Zählregel für „vergeben“', () => {
  it('mehr Höfe im Rennen als Plätze: vergeben sind die Plätze — Lader, Prüfung und Satz mit derselben Zahl', async () => {
    await plaetze(MAX_GRUENDUNGSHOEFE)
    const schon = await imRennen()
    await plaetze(schon + 2)
    await neueHoefe(5)

    const einstellung = await lesePlattformEinstellung()
    const stand = await ladeGruendungStandAdmin(einstellung)

    expect(stand.vergeben).toBe(schon + 2)
    expect(stand.inDerVergabe).toBe(schon + 5)
    const zuWenig = { plaetze: schon + 1, monate: einstellung.gruendungMonate, aktionBisTag: einstellung.gruendungAktionBisTag, anzeige: true }
    expect(pruefeGruendungEingabe(zuWenig, gruendungEinstellungAus(einstellung), stand.vergeben, new Date())).toBe(GRUENDUNG_EINSTELLUNG_FEHLER.weniger(schon + 2))
  })
})

describe('Einstellung 100 gegen den Rückfall auf den Standard', () => {
  it('mit 100 Plätzen: ein Hof hinter Platz 12 ist Gründungshof — Seiten, Abzeichen-Blatt, Admin › Höfe und Ende sagen dasselbe', async () => {
    await plaetze(100)
    expect(await imRennen()).toBeLessThanOrEqual(100 - 13)
    const ids = await neueHoefe(13)
    const hinten = ids[ids.length - 1]

    const seiten = await gruendungFuerSeiten(new Date())
    const blatt = await ladeAbzeichenBlatt()
    const zeile = (await getAdminFarms(new Date())).find((f) => f.id === hinten)

    expect(seiten.gesamt).toBe(100)
    expect(blatt?.plaetze).toBe(100)
    expect(zeile?.gruendung).not.toBeNull()
    expect(await ladeGruendungBis({ id: hinten })).not.toBeNull()
  })

  it('ohne Zeile: der Standard 12 wie bisher — derselbe Hof hat keinen Platz', async () => {
    const ids = await neueHoefe(13)
    const hinten = ids[ids.length - 1]
    await prisma.plattformEinstellung.delete({ where: { id: PLATTFORM_EINSTELLUNG_ID } })

    const einstellung = await lesePlattformEinstellung()
    const stand = await ladeGruendungStandAdmin(einstellung)

    expect(einstellung.gruendungPlaetze).toBe(MAX_GRUENDUNGSHOEFE)
    expect((await gruendungFuerSeiten(new Date())).gesamt).toBe(MAX_GRUENDUNGSHOEFE)
    expect(stand.vergeben).toBe(MAX_GRUENDUNGSHOEFE)
    expect(await ladeGruendungBis({ id: hinten })).toBeNull()
  })
})
