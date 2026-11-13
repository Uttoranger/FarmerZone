import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { HOF_SICHTBAR_WO } from '@/lib/hof-sichtbar'
import { brauchtAgbZustimmung } from '@/lib/agb-zustimmung'
import { AGB_NEUESTE } from '@/lib/rechtstexte/agb-fassung'
import { endgueltigGrenze, wiederOeffnenBis } from '@/lib/konto-anfragen'
import type { HofSignalRoh, HofSignaleStand } from '@/lib/admin-aufgaben'

/*
 * Stille Ereignisse eines Hofs für Admin › Heute (Nr. 304, F047 Nr. 11 und
 * 14): Was ohne eigene Nachricht an das Team geschieht, wird eine Aufgabe —
 * Lastschrift beendet, AGB offen, Konto-Frist um. Die Regel (Titel, Satz,
 * Frist) steht rein in src/lib/admin-aufgaben.ts; hier nur das Lesen.
 *
 * Nur Kennung, Hofname und Zeitpunkt — nie Adresse oder Name einer Person
 * (Register N33). Nur lesen: Kein Zustand, keine Mail, keine Sperre (N32:
 * erledigt verschwindet von selbst). Höchstens zwei Abfragen je Quelle, je
 * höchstens SIGNALE_HOECHSTENS Zeilen.
 */

/** Mehr Höfe je Quelle liest Heute nicht — eine Liste dieser Länge ist selbst das Signal. */
export const SIGNALE_HOECHSTENS = 200

/** Verkaufender Hof: dieselbe Bedingung wie `ladeHoefeAktiv` (freigeschaltet, sichtbar, nicht pausiert, kein Testhof). */
const VERKAUFENDER_HOF_WO = { approvedAt: { not: null }, ...HOF_SICHTBAR_WO, isPaused: false, istTesthof: false } as const satisfies Prisma.FarmWhereInput

/**
 * Lastschrift beendet: verkaufender Hof, der bar annimmt und dafür ein Mandat
 * braucht, aber keines mehr hat — und dessen Mandat laut Protokoll beendet
 * wurde (ein Hof, der nie eines hatte, ist kein Ereignis). Seit = der jüngste
 * Eintrag 'lastschrift_mandat_beendet'. Erst das Protokoll (selten), dann die Höfe.
 */
async function ladeLastschriftBeendet(): Promise<HofSignalRoh[]> {
  const beendet = await prisma.adminAktion.groupBy({
    by: ['bezugId'],
    where: { art: 'lastschrift_mandat_beendet', bezugArt: 'hof' },
    _max: { wann: true },
    orderBy: { _max: { wann: 'desc' } },
    take: SIGNALE_HOECHSTENS,
  })
  const seit = new Map(beendet.flatMap((b) => (b._max.wann ? [[b.bezugId, b._max.wann] as const] : [])))
  if (seit.size === 0) return []
  const hoefe = await prisma.farm.findMany({
    where: { id: { in: [...seit.keys()] }, ...VERKAUFENDER_HOF_WO, acceptsOnsite: true, barMandatPflicht: true, sepaMandatAm: null },
    select: { id: true, name: true },
    take: SIGNALE_HOECHSTENS,
  })
  return hoefe.flatMap((h) => {
    const am = seit.get(h.id)
    return am ? [{ farmId: h.id, hofName: h.name, seit: am }] : []
  })
}

/** AGB offen: verkaufender Hof ohne Zustimmung zur neuesten Fassung (`brauchtAgbZustimmung`); seit = Freischaltung. */
async function ladeAgbOffen(): Promise<HofSignalRoh[]> {
  const hoefe = await prisma.farm.findMany({
    where: { ...VERKAUFENDER_HOF_WO, OR: [{ agbFassung: null }, { agbFassung: { not: AGB_NEUESTE } }] },
    select: { id: true, name: true, approvedAt: true, agbFassung: true },
    orderBy: { approvedAt: 'asc' },
    take: SIGNALE_HOECHSTENS,
  })
  return hoefe.flatMap((h) => (h.approvedAt && brauchtAgbZustimmung(h) ? [{ farmId: h.id, hofName: h.name, seit: h.approvedAt }] : []))
}

/**
 * Konto-Frist um: seit über 30 Tagen geschlossen (`endgueltigGrenze`, Frist
 * beim Lesen) und Stufe 2 nicht gelaufen (`endgueltigAm` null); kein Testhof.
 * Seit = Ende der 30 Tage. Auch ein pausierter Hof — die Löschpflicht hängt
 * nicht am Verkauf.
 */
async function ladeKontoFristUm(jetzt: Date): Promise<HofSignalRoh[]> {
  const hoefe = await prisma.farm.findMany({
    where: { istTesthof: false, geschlossenAm: { lte: endgueltigGrenze(jetzt) }, endgueltigAm: null },
    select: { id: true, name: true, geschlossenAm: true },
    orderBy: { geschlossenAm: 'asc' },
    take: SIGNALE_HOECHSTENS,
  })
  return hoefe.flatMap((h) => {
    const bis = wiederOeffnenBis(h.geschlossenAm)
    return bis ? [{ farmId: h.id, hofName: h.name, seit: bis }] : []
  })
}

/** Die drei Quellen für `ladeAufgabenStand` — nebeneinander gelesen. */
export async function ladeHofSignale(jetzt: Date): Promise<HofSignaleStand> {
  const [lastschrift, agb, konto] = await Promise.all([ladeLastschriftBeendet(), ladeAgbOffen(), ladeKontoFristUm(jetzt)])
  return { lastschrift, agb, konto }
}
