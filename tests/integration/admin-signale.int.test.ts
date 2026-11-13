/**
 * Stille Ereignisse eines Hofs (Nr. 304) gegen ein ECHTES Postgres:
 * `ladeHofSignale` liest die drei Quellen, `ladeAdminAufgaben` macht daraus
 * Aufgaben in Admin › Heute. Beweist:
 *  - Lastschrift beendet: Mandat beendet mit Protokoll → Aufgabe, seit dem
 *    jüngsten Eintrag; neues Mandat (sepaMandatAm gesetzt), barMandatPflicht
 *    false, bar aus oder kein Eintrag im Protokoll → keine;
 *  - AGB offen: agbFassung null oder eine ältere Fassung → Aufgabe, '1.0' → keine;
 *  - Konto-Frist um: geschlossen vor 31 Tagen → Aufgabe (seit Ende der 30
 *    Tage); vor 29 Tagen oder endgültig geschlossen → keine;
 *  - ein pausierter Hof und ein Testhof erscheinen in keiner der drei Quellen;
 *  - der Weg bis „Braucht dich“: dieselben Höfe stehen als Aufgaben da, ohne
 *    Adresse, und verschwinden, wenn die Ursache weg ist (N32).
 *
 * Testdaten mit Präfix int- (raeumeAuf); die Protokollzeilen (ohne
 * Fremdschlüssel) räumt der Test selbst ab. Es gibt keine Uhr außer `jetzt`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))

import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ladeHofSignale } from '@/server/queries/admin-signale'
import { ladeAdminAufgaben } from '@/server/queries/admin-heute'
import { erstelleHof, raeumeAuf } from './setup/basis'

const TAG = 24 * 60 * 60_000
const bezuege: string[] = []

afterEach(async () => {
  await prisma.adminAktion.deleteMany({ where: { bezugId: { in: bezuege.splice(0) } } })
  await raeumeAuf()
})

/** Ein Hof (Präfix int-), der verkauft: freigeschaltet, sichtbar, nicht pausiert, kein Testhof; bar mit Mandatspflicht, ohne Mandat, ohne AGB-Zustimmung. */
async function hof(abweichend: Partial<Prisma.FarmUncheckedCreateInput> = {}): Promise<string> {
  const { farm } = await erstelleHof({ acceptsOnsite: true, barMandatPflicht: true, sepaMandatAm: null, agbFassung: null, ...abweichend })
  bezuege.push(farm.id)
  return farm.id
}

async function mandatBeendet(farmId: string, wann: Date): Promise<void> {
  await prisma.adminAktion.create({ data: { wer: null, art: 'lastschrift_mandat_beendet', bezugArt: 'hof', bezugId: farmId, mitPasskey: false, wann } })
}

function kennungen(liste: readonly { farmId: string }[], unter: readonly string[]): string[] {
  return liste.map((h) => h.farmId).filter((id) => unter.includes(id))
}

describe('Lastschrift beendet', () => {
  it('Mandat beendet mit Protokoll → Aufgabe, seit dem jüngsten Eintrag; neues Mandat, ohne Pflicht, bar aus oder ohne Eintrag → keine', async () => {
    const jetzt = new Date()
    const beendet = await hof({ agbFassung: '1.0' })
    await mandatBeendet(beendet, new Date(jetzt.getTime() - 10 * TAG))
    await mandatBeendet(beendet, new Date(jetzt.getTime() - 2 * TAG))
    const neuesMandat = await hof({ agbFassung: '1.0', sepaMandatAm: new Date(jetzt.getTime() - TAG) })
    await mandatBeendet(neuesMandat, new Date(jetzt.getTime() - 3 * TAG))
    const ohnePflicht = await hof({ agbFassung: '1.0', barMandatPflicht: false })
    await mandatBeendet(ohnePflicht, new Date(jetzt.getTime() - 3 * TAG))
    const barAus = await hof({ agbFassung: '1.0', acceptsOnsite: false })
    await mandatBeendet(barAus, new Date(jetzt.getTime() - 3 * TAG))
    const nieMandat = await hof({ agbFassung: '1.0' })

    const { lastschrift } = await ladeHofSignale(jetzt)
    const alle = [beendet, neuesMandat, ohnePflicht, barAus, nieMandat]
    expect(kennungen(lastschrift, alle)).toEqual([beendet])
    expect(lastschrift.find((h) => h.farmId === beendet)).toEqual({ farmId: beendet, hofName: 'Hof Test', seit: new Date(jetzt.getTime() - 2 * TAG) })

    // Das neue Mandat kommt: Die Aufgabe verschwindet von selbst.
    await prisma.farm.update({ where: { id: beendet }, data: { sepaMandatAm: jetzt } })
    expect(kennungen((await ladeHofSignale(jetzt)).lastschrift, alle)).toEqual([])
  })
})

describe('AGB offen', () => {
  it('agbFassung null oder 0.9 → Aufgabe seit der Freischaltung; 1.0 → keine', async () => {
    const jetzt = new Date()
    const approvedAt = new Date(jetzt.getTime() - 40 * TAG)
    const ohne = await hof({ approvedAt })
    const alt = await hof({ approvedAt, agbFassung: '0.9' })
    const zugestimmt = await hof({ approvedAt, agbFassung: '1.0' })

    const { agb } = await ladeHofSignale(jetzt)
    expect(kennungen(agb, [ohne, alt, zugestimmt]).sort()).toEqual([ohne, alt].sort())
    expect(agb.find((h) => h.farmId === ohne)?.seit).toEqual(approvedAt)

    await prisma.farm.update({ where: { id: ohne }, data: { agbFassung: '1.0', agbZugestimmtAm: jetzt } })
    expect(kennungen((await ladeHofSignale(jetzt)).agb, [ohne, alt, zugestimmt])).toEqual([alt])
  })
})

describe('Konto-Frist um', () => {
  it('geschlossen vor 31 Tagen → Aufgabe seit Ende der 30 Tage; vor 29 Tagen oder endgültig → keine; nie in „AGB offen“', async () => {
    const jetzt = new Date()
    const vor31 = new Date(jetzt.getTime() - 31 * TAG)
    const faellig = await hof({ geschlossenAm: vor31 })
    const frisch = await hof({ geschlossenAm: new Date(jetzt.getTime() - 29 * TAG) })
    const endgueltig = await hof({ geschlossenAm: vor31, endgueltigAm: new Date(jetzt.getTime() - TAG) })

    const { konto, agb } = await ladeHofSignale(jetzt)
    const alle = [faellig, frisch, endgueltig]
    expect(kennungen(konto, alle)).toEqual([faellig])
    expect(konto.find((h) => h.farmId === faellig)?.seit).toEqual(new Date(vor31.getTime() + 30 * TAG))
    // Ein geschlossener Hof verkauft nicht: keine Pflege-Signale (N36, Ergänzung 5.11.2026).
    expect(kennungen(agb, alle)).toEqual([])
  })
})

describe('Pausierter Hof und Testhof', () => {
  it('erscheinen in keiner der drei Quellen — auch wenn sonst alles passt', async () => {
    const jetzt = new Date()
    const pausiert = await hof({ isPaused: true })
    await mandatBeendet(pausiert, new Date(jetzt.getTime() - TAG))
    const testhof = await hof({ istTesthof: true })
    await mandatBeendet(testhof, new Date(jetzt.getTime() - TAG))
    const testhofZu = await hof({ istTesthof: true, geschlossenAm: new Date(jetzt.getTime() - 31 * TAG) })
    // Gegenprobe: derselbe Hof ohne Pause und ohne Testhof-Marke steht in Lastschrift und AGB.
    const gegenprobe = await hof()
    await mandatBeendet(gegenprobe, new Date(jetzt.getTime() - TAG))

    const signale = await ladeHofSignale(jetzt)
    const alle = [pausiert, testhof, testhofZu, gegenprobe]
    expect(kennungen(signale.lastschrift, alle)).toEqual([gegenprobe])
    expect(kennungen(signale.agb, alle)).toEqual([gegenprobe])
    expect(kennungen(signale.konto, alle)).toEqual([])
  })
})

describe('Bis „Braucht dich“', () => {
  it('die drei Höfe stehen als Aufgaben mit Akte als Ziel da, ohne Adresse — und verschwinden, wenn die Ursache weg ist', async () => {
    const jetzt = new Date()
    const mandat = await hof({ agbFassung: '1.0' })
    await mandatBeendet(mandat, new Date(jetzt.getTime() - TAG))
    const agb = await hof()
    const zu = await hof({ geschlossenAm: new Date(jetzt.getTime() - 31 * TAG) })

    const eigene = async (): Promise<string[]> =>
      (await ladeAdminAufgaben(jetzt, { mitBetrieb: false }))
        .filter((a) => [mandat, agb, zu].includes(a.bezug.kennung) && ['lastschrift_beendet', 'agb_offen', 'konto_frist_um'].includes(a.quelle))
        .map((a) => `${a.quelle}:${a.bezug.kennung}:${a.ziel}`)
        .sort()
    expect(await eigene()).toEqual([`agb_offen:${agb}:/admin/hoefe/${agb}`, `konto_frist_um:${zu}:/admin/hoefe/${zu}`, `lastschrift_beendet:${mandat}:/admin/hoefe/${mandat}`].sort())
    const texte = JSON.stringify((await ladeAdminAufgaben(jetzt, { mitBetrieb: false })).filter((a) => [mandat, agb, zu].includes(a.bezug.kennung)))
    expect(texte).not.toContain('Teststraße')
    expect(texte).not.toContain('@')

    await prisma.farm.update({ where: { id: mandat }, data: { sepaMandatAm: jetzt } })
    await prisma.farm.update({ where: { id: agb }, data: { agbFassung: '1.0', agbZugestimmtAm: jetzt } })
    await prisma.farm.update({ where: { id: zu }, data: { endgueltigAm: jetzt } })
    expect(await eigene()).toEqual([])
  })
})
