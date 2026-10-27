import { prisma } from '@/lib/prisma'
import { formatDatumLang } from '@/lib/format'
import { kalendertagInWien, wienerMitternacht } from '@/lib/wiener-tag'
import { hofpreisEinstellungAus } from '@/lib/plattform-einstellung'
import { bestimmeGruendungBis } from '@/lib/gruendungshof'
import { abrechnungSperrtBar, einzugAbFuer, folgemonat, gebuehrModellFuer, monatText, satzHundertstel, satzText } from '@/lib/plattformgebuehr'
import type { PlattformgebuehrStand } from '@/lib/admin-aufgaben'
import { lesePlattformEinstellung } from '@/server/queries/plattform-einstellung'
import { ladeHoefeFuerGruendung } from '@/server/queries/admin'

/*
 * Die Lader der Monatsabrechnung (Register N38, Nr. 198) für Hof › Deine
 * Konditionen, Hof › Heute, Admin › Heute, Akte und Geld — NUR die Datenbank.
 * Stripe (Anzeige des Mandats) kommt erst per `await import(...)`: Seiten
 * ziehen das Stripe-SDK nie statisch mit (ARCHITECTURE §4, tests/schwere-module.test.ts).
 * Gerechnet wird nichts; Summen und Sperre kommen aus src/lib/plattformgebuehr.ts.
 */

/** BetriebMessung-Art, solange die Rechnungsangaben im Stripe-Dashboard fehlen (Quelle in Heute). */
export const RECHNUNGSANGABEN_FEHLEN_ART = 'rechnungsangabenFehlen'

/** Der Monat als Grenzen in Wiener Zeit und als Datumsspalte (der Erste, wie `Monatsabrechnung.monat`). */
export function monatsGrenzen(monat: string): { von: Date; bis: Date; datum: Date } {
  const von = wienerMitternacht(`${monat}-01`)
  const bis = wienerMitternacht(`${folgemonat(monat)}-01`)
  if (!von || !bis) throw new Error('Monat ungültig')
  return { von, bis, datum: new Date(`${monat}-01T00:00:00.000Z`) }
}


const NEUNZIG_TAGE_MS = 90 * 24 * 60 * 60 * 1000

/** Barbestellungen im Modell hofpreis der letzten 90 Tage je Hof: gesamt (abgeholt + nicht abgeholt) und nicht abgeholt. */
export async function ladeNichtAbgeholt(jetzt: Date, farmId?: string): Promise<Map<string, { bar: number; nicht: number }>> {
  const gruppen = await prisma.order.groupBy({
    by: ['farmId', 'status'],
    where: {
      ...(farmId ? { farmId } : {}),
      gebuehrModell: 'hofpreis',
      paymentMethod: { not: 'ONLINE' },
      status: { in: ['PICKED_UP', 'NOT_PICKED_UP'] },
      pickupDate: { gte: new Date(jetzt.getTime() - NEUNZIG_TAGE_MS), lte: jetzt },
    },
    _count: { _all: true },
  })
  const je = new Map<string, { bar: number; nicht: number }>()
  for (const g of gruppen) {
    const z = je.get(g.farmId) ?? { bar: 0, nicht: 0 }
    z.bar += g._count._all
    if (g.status === 'NOT_PICKED_UP') z.nicht += g._count._all
    je.set(g.farmId, z)
  }
  return je
}

const monatSchluessel = (d: Date): string => d.toISOString().slice(0, 7)

/** Der Stand für die Quellen in Admin › Heute (src/lib/admin-aufgaben.ts). */
export async function ladePlattformgebuehrAufgaben(jetzt: Date): Promise<PlattformgebuehrStand> {
  const [abrechnungen, angaben, quote] = await Promise.all([
    prisma.monatsabrechnung.findMany({
      where: { stand: { in: ['gescheitert', 'zurueckgebucht'] } },
      select: { id: true, farmId: true, monat: true, stand: true, offenSeit: true, zurueckgebuchtAm: true, updatedAt: true, farm: { select: { name: true } } },
    }),
    prisma.betriebMessung.findFirst({ where: { art: RECHNUNGSANGABEN_FEHLEN_ART }, orderBy: { tag: 'asc' }, select: { tag: true } }),
    ladeNichtAbgeholt(jetzt),
  ])
  const roh = (a: (typeof abrechnungen)[number], seit: Date | null) => ({ abrechnungId: a.id, farmId: a.farmId, hofName: a.farm.name, monat: monatText(monatSchluessel(a.monat)), seit: seit ?? a.updatedAt })
  const auffaellig = [...quote].filter(([, z]) => z.bar >= 10)
  const namen = auffaellig.length === 0 ? [] : await prisma.farm.findMany({ where: { id: { in: auffaellig.map(([id]) => id) } }, select: { id: true, name: true } })
  const name = new Map(namen.map((n) => [n.id, n.name]))
  return {
    gescheitert: abrechnungen.filter((a) => a.stand === 'gescheitert').map((a) => roh(a, a.offenSeit)),
    zurueckgebucht: abrechnungen.filter((a) => a.stand === 'zurueckgebucht').map((a) => roh(a, a.zurueckgebuchtAm)),
    rechnungsangabenFehlenSeit: angaben?.tag ?? null,
    nichtAbgeholt: auffaellig.map(([farmId, z]) => ({ farmId, hofName: name.get(farmId) ?? farmId, bar: z.bar, nicht: z.nicht, seit: jetzt })),
  }
}

/** Eine Monatsabrechnung als Zeile für Hof und Akte — nur Text und Cent, kein Date an den Browser. */
export type AbrechnungZeile = { id: string; monat: string; monatText: string; barCents: number; onlineCents: number; stand: string; rechnungBar: boolean; rechnungOnline: boolean }

function alsZeile(a: { id: string; monat: Date; servicegebuehrBarCents: number; servicegebuehrOnlineCents: number; stand: string; rechnungBarId: string | null; rechnungOnlineId: string | null }): AbrechnungZeile {
  const m = monatSchluessel(a.monat)
  return { id: a.id, monat: m, monatText: monatText(m), barCents: a.servicegebuehrBarCents, onlineCents: a.servicegebuehrOnlineCents, stand: a.stand, rechnungBar: a.rechnungBarId !== null, rechnungOnline: a.rechnungOnlineId !== null }
}

const ZEILE_SELECT = { id: true, monat: true, servicegebuehrBarCents: true, servicegebuehrOnlineCents: true, stand: true, rechnungBarId: true, rechnungOnlineId: true } as const

export type BarzahlungDaten = {
  modellAktiv: boolean
  satzText: string
  einzugAbText: string
  einzugBegonnen: boolean
  mandat: boolean
  mandatPflicht: boolean
  bank: string | null
  letzte4: string | null
  gesperrt: boolean
  abrechnungen: AbrechnungZeile[]
}

/** Hof › Deine Konditionen: Barzahlung (Mandat, Einzug ab, Satz) und die Monatsabrechnungen. */
export async function ladeBarzahlung(farmId: string, jetzt: Date): Promise<BarzahlungDaten | null> {
  const [hof, einstellung, abrechnungen] = await Promise.all([
    prisma.farm.findUnique({
      where: { id: farmId },
      select: { id: true, gruendungBis: true, einzugAb: true, plattformgebuehrProzent: true, barMandatPflicht: true, barSperreNachTagen: true, sepaMandatAm: true, sepaZahlungsmittelId: true },
    }),
    lesePlattformEinstellung(),
    prisma.monatsabrechnung.findMany({ where: { farmId }, orderBy: { monat: 'desc' }, take: 12, select: { ...ZEILE_SELECT, offenSeit: true } }),
  ])
  if (!hof) return null
  const e = hofpreisEinstellungAus(einstellung)
  const gruendungBis = hof.einzugAb ? null : bestimmeGruendungBis(hof, await ladeHoefeFuerGruendung())
  const ab = einzugAbFuer(hof, e, gruendungBis)
  // Bank und letzte 4 Stellen LIVE von Stripe — erst hier geladen, nie gespeichert.
  const anzeige = hof.sepaMandatAm
    ? await (await import('@/server/plattformgebuehr-abrechnung')).ladeMandatAnzeige(hof.sepaZahlungsmittelId)
    : { bank: null, letzte4: null }
  return {
    modellAktiv: gebuehrModellFuer(e, jetzt) === 'hofpreis',
    satzText: satzText(satzHundertstel(hof)),
    einzugAbText: formatDatumLang(ab),
    einzugBegonnen: jetzt.getTime() >= ab.getTime(),
    mandat: hof.sepaMandatAm !== null,
    mandatPflicht: hof.barMandatPflicht,
    ...anzeige,
    gesperrt: abrechnungSperrtBar(abrechnungen, hof.barSperreNachTagen, jetzt),
    abrechnungen: abrechnungen.map(alsZeile),
  }
}

/** Hof › Heute: die offene Abrechnung, die bar sperrt — für die Karte „Jetzt bezahlen“; sonst null. */
export async function ladeSperrKarte(farmId: string, jetzt: Date): Promise<{ abrechnungId: string; monatText: string } | null> {
  const [hof, abrechnungen] = await Promise.all([
    prisma.farm.findUnique({ where: { id: farmId }, select: { barSperreNachTagen: true } }),
    prisma.monatsabrechnung.findMany({ where: { farmId, stand: { in: ['offen', 'gescheitert', 'zurueckgebucht'] } }, orderBy: { monat: 'asc' }, select: { id: true, monat: true, stand: true, offenSeit: true, rechnungBarId: true } }),
  ])
  if (!hof) return null
  const sperrend = abrechnungen.find((a) => a.rechnungBarId && abrechnungSperrtBar([a], hof.barSperreNachTagen, jetzt))
  return sperrend ? { abrechnungId: sperrend.id, monatText: monatText(monatSchluessel(sperrend.monat)) } : null
}

export type AkteDaten = {
  mandat: boolean
  abrechnungen: AbrechnungZeile[]
  nichtAbgeholt: { bar: number; nicht: number }
  einstellungen: { satz: string; mandatPflicht: boolean; sperreTage: number; abrechnungsTag: number; einzugAb: string; vorgabeEinzugAb: string }
}

/** Admin › Hof-Akte, Abschnitt „Plattformgebühr“ (Nr. 187 → 198). */
export async function ladePlattformgebuehrAkte(farmId: string, jetzt: Date): Promise<AkteDaten | null> {
  const [hof, einstellung, abrechnungen, quote] = await Promise.all([
    prisma.farm.findUnique({
      where: { id: farmId },
      select: { id: true, gruendungBis: true, einzugAb: true, plattformgebuehrProzent: true, barMandatPflicht: true, barSperreNachTagen: true, abrechnungsTag: true, sepaMandatAm: true },
    }),
    lesePlattformEinstellung(),
    prisma.monatsabrechnung.findMany({ where: { farmId }, orderBy: { monat: 'desc' }, take: 3, select: ZEILE_SELECT }),
    ladeNichtAbgeholt(jetzt, farmId),
  ])
  if (!hof) return null
  const e = hofpreisEinstellungAus(einstellung)
  // Die Vorgabe ohne eigenen Tag: Stichtag bzw. Tag nach dem Gründungs-Ende.
  const vorgabe = einzugAbFuer({ einzugAb: null }, e, bestimmeGruendungBis(hof, await ladeHoefeFuerGruendung()))
  return {
    mandat: hof.sepaMandatAm !== null,
    abrechnungen: abrechnungen.map(alsZeile),
    nichtAbgeholt: quote.get(farmId) ?? { bar: 0, nicht: 0 },
    einstellungen: {
      satz: satzText(satzHundertstel(hof)),
      mandatPflicht: hof.barMandatPflicht,
      sperreTage: hof.barSperreNachTagen,
      abrechnungsTag: hof.abrechnungsTag,
      einzugAb: hof.einzugAb ? kalendertagInWien(hof.einzugAb) : '',
      vorgabeEinzugAb: kalendertagInWien(vorgabe),
    },
  }
}

/** Admin › Geld: Plattformgebühr bar und online des Monats, offene und gescheiterte Einzüge, Rückbuchungen. */
export async function ladePlattformgebuehrGeld(monat: string): Promise<{ barCents: number; onlineCents: number; offen: number; gescheitert: number; zurueckgebucht: number }> {
  const { datum } = monatsGrenzen(monat)
  const [imMonat, staende] = await Promise.all([
    prisma.monatsabrechnung.aggregate({ where: { monat: datum }, _sum: { servicegebuehrBarCents: true, servicegebuehrOnlineCents: true } }),
    prisma.monatsabrechnung.groupBy({ by: ['stand'], where: { stand: { in: ['offen', 'gescheitert', 'zurueckgebucht'] } }, _count: { _all: true } }),
  ])
  const zahl = (stand: string): number => staende.find((s) => s.stand === stand)?._count._all ?? 0
  return {
    barCents: imMonat._sum.servicegebuehrBarCents ?? 0,
    onlineCents: imMonat._sum.servicegebuehrOnlineCents ?? 0,
    offen: zahl('offen'),
    gescheitert: zahl('gescheitert'),
    zurueckgebucht: zahl('zurueckgebucht'),
  }
}
