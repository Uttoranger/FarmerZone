import { prisma } from '@/lib/prisma'
import { STRIPE_LIVE_AB } from '@/lib/umgebung-server'
import { ladeErstattungAufgaben, ladeHofAufgaben } from '@/server/queries/postfach'
import { ladeProbleme } from '@/server/queries/mails'
import { ladeAeltesteWichtige, ladeLaeufe } from '@/server/queries/betrieb'
import { getMeldungenFuerAdmin } from '@/server/queries/meldung'
import { lesePlattformEinstellung } from '@/server/queries/plattform-einstellung'
import { naechsterTermin } from '@/server/queries/startseite'
import { centAusDecimal } from '@/server/queries/umsatz'
import { MELDUNG_STATUS_OFFEN_IM_EINGANG } from '@/lib/postfach'
import { ABHOLUNG_ERLEDIGT, abholtage } from '@/lib/heute'
import { umsatzBestellungWhere, umsatzfenster } from '@/lib/umsatz'
import { ohneTestzahlungenWhere } from '@/lib/testzahlung'
import { gruendungEinstellungAus } from '@/lib/plattform-einstellung'
import type { AblaufLaufDaten } from '@/lib/betrieb'
import { sammleAufgaben, LEERER_STAND, type Aufgabe, type AufgabeHof, type AufgabenStand, type ProtokollRoh } from '@/lib/admin-aufgaben'

/*
 * Die Daten von Admin › Heute (Register N32, Nr. 185). Die Aufgaben kommen
 * aus den bestehenden Abfragen — Postfach-Eingang (wartende Höfe, offene
 * Erstattungen, Meldungen), Mail-Probleme und `ladeAeltesteWichtige`,
 * Warnungen und Herzschlag des Betriebs —, die Regel steht rein in
 * src/lib/admin-aufgaben.ts. Neu ist nur die Abfrage der Signale (verkaufende
 * Höfe mit Abholzeit und letzter Bestellung).
 *
 * Keine Adresse, kein Name einer Person, kein Inhalt: gelesen werden nur
 * Kennungen, Zeiten, Hofnamen und Zahlen.
 */

/** Was die Kundin als Absender einer Meldung zeigt — nie ihre Adresse (wie im Eingang). */
function meldungVon(m: { hofName: string | null; customerEmail: string | null }): string {
  return m.hofName ?? (m.customerEmail ? 'Kundin (ohne Konto)' : 'Anonym')
}

/** Verkaufende Höfe: freigeschaltet, nicht stillgelegt, nicht pausiert, kein Testhof — je Hof nur, ob es eine Abholzeit gibt, und die letzte Bestellung. */
async function ladeHoefeAktiv(): Promise<AufgabeHof[]> {
  const hoefe = await prisma.farm.findMany({
    where: { approvedAt: { not: null }, archivedAt: null, isPaused: false, istTesthof: false },
    select: {
      id: true,
      name: true,
      approvedAt: true,
      pickupSlots: { where: { isActive: true }, select: { id: true }, take: 1 },
      orders: { orderBy: { createdAt: 'desc' }, select: { createdAt: true }, take: 1 },
    },
  })
  return hoefe.flatMap((h) =>
    h.approvedAt
      ? [{ id: h.id, name: h.name, approvedAt: h.approvedAt, abholzeitAktiv: h.pickupSlots.length > 0, letzteBestellungAm: h.orders[0]?.createdAt ?? null }]
      : []
  )
}

/**
 * Der Stand aller Quellen. `mitBetrieb`: Warnungen, Abläufe und die wartende
 * Mail nur in der Produktion — außerhalb laufen die Abläufe nicht, jede Zeile
 * wäre ein Fehlalarm (dieselbe Regel wie bisher Punkt und Betriebsleiste).
 */
export async function ladeAufgabenStand(jetzt: Date, { mitBetrieb }: { mitBetrieb: boolean }): Promise<AufgabenStand> {
  const [hoefeWartend, erstattungen, mailProbleme, meldungen, hoefeAktiv, betrieb] = await Promise.all([
    ladeHofAufgaben(jetzt),
    ladeErstattungAufgaben(),
    ladeProbleme(jetzt),
    getMeldungenFuerAdmin({ status: [...MELDUNG_STATUS_OFFEN_IM_EINGANG], art: null }),
    ladeHoefeAktiv(),
    mitBetrieb
      ? Promise.all([
          ladeAeltesteWichtige(),
          prisma.betriebWarnung.findMany({ where: { stufe: { gt: 0 } }, select: { art: true, stufe: true, seit: true } }),
          ladeLaeufe(),
        ])
      : null,
  ])
  return {
    ...LEERER_STAND,
    hoefeWartend,
    erstattungen,
    mailProbleme,
    meldungen: meldungen.map((m) => ({ id: m.id, art: m.art, createdAt: m.createdAt, ersteZeile: m.ersteZeile, von: meldungVon(m) })),
    hoefeAktiv,
    ...(betrieb ? { wartendeMail: betrieb[0], warnungen: betrieb[1], laeufe: betrieb[2] } : {}),
  }
}

/** Die Aufgaben „Braucht dich“ — für Heute und die Zahl der Betriebsleiste dieselbe Quelle. */
export async function ladeAdminAufgaben(jetzt: Date, optionen: { mitBetrieb: boolean }): Promise<Aufgabe[]> {
  return sammleAufgaben(await ladeAufgabenStand(jetzt, optionen), jetzt)
}

export type HeuteRoh = {
  stand: AufgabenStand
  bestellungen: { zurAbholung: number; nichtGepackt: number; storniert: number }
  umsatzWocheCents: number
  hoefe: { verkaufen: number; warten: number }
  naechsteFassung: Date | null
  gruendung: { aktionBisTag: string | null; fest: boolean }
  protokoll: ProtokollRoh[]
  /** Die Antwortzeit von `SELECT 1` beim Aufbau, null wenn sie scheiterte (Karte Dienste). */
  antwortMs: number | null
  /** Der Herzschlag der Abläufe für „Läuft von selbst“ — auch außerhalb der Produktion (wie Admin › Betrieb). */
  laeufe: ReadonlyMap<string, AblaufLaufDaten>
}

async function messeAntwort(): Promise<number | null> {
  const start = performance.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    return Math.round(performance.now() - start)
  } catch {
    return null
  }
}

/** Bestellungen mit Abholtag heute (Wien), ohne Testzahlungen: offen, davon nicht gepackt, und storniert. */
async function ladeBestellungenHeute(jetzt: Date, stripeLiveAb: Date | null): Promise<HeuteRoh['bestellungen']> {
  const { heute } = abholtage(jetzt)
  const zeilen = await prisma.order.groupBy({
    by: ['status'],
    where: { pickupDate: { gte: heute.von, lte: heute.bis }, AND: [ohneTestzahlungenWhere(stripeLiveAb)] },
    _count: { _all: true },
  })
  const erledigt: readonly string[] = ABHOLUNG_ERLEDIGT
  const zahl = (bedingung: (status: string) => boolean): number => zeilen.filter((z) => bedingung(z.status)).reduce((s, z) => s + z._count._all, 0)
  return {
    zurAbholung: zahl((s) => !erledigt.includes(s)),
    nichtGepackt: zahl((s) => !erledigt.includes(s) && s !== 'READY'),
    storniert: zahl((s) => s === 'CANCELLED'),
  }
}

/** Warenwert der seit Montag (Wien) abgeholten Bestellungen aller Höfe — die Umsatzregel (`umsatzBestellungWhere`) ohne den Hof. */
async function ladeUmsatzWoche(jetzt: Date, stripeLiveAb: Date | null): Promise<number> {
  const alleHoefe = umsatzBestellungWhere('', umsatzfenster('woche', jetzt).aktuell, stripeLiveAb)
  delete alleHoefe.farmId
  const summe = await prisma.order.aggregate({ where: alleHoefe, _sum: { totalAmount: true } })
  return centAusDecimal(summe._sum.totalAmount)
}

/** Alles für die Seite Heute: Aufgaben-Stand, Lage, Kommt und die letzten drei Einträge im Protokoll. */
export async function ladeHeute(jetzt: Date, optionen: { mitBetrieb: boolean }, stripeLiveAb: Date | null = STRIPE_LIVE_AB): Promise<HeuteRoh> {
  const [stand, bestellungen, umsatzWocheCents, verkaufen, naechsteFassung, einstellung, protokoll, antwortMs, laeufe] = await Promise.all([
    ladeAufgabenStand(jetzt, optionen),
    ladeBestellungenHeute(jetzt, stripeLiveAb),
    ladeUmsatzWoche(jetzt, stripeLiveAb),
    prisma.farm.count({ where: { approvedAt: { not: null }, archivedAt: null, isPaused: false, istTesthof: false } }),
    naechsterTermin(jetzt),
    lesePlattformEinstellung(),
    prisma.adminAktion.findMany({ orderBy: { wann: 'desc' }, take: 3, select: { wann: true, wer: true, art: true } }),
    messeAntwort(),
    // In der Produktion stehen die Läufe schon im Stand; sonst nur für die Anzeige, ohne Aufgaben daraus.
    optionen.mitBetrieb ? null : ladeLaeufe(),
  ])
  const gruendung = gruendungEinstellungAus(einstellung)
  return {
    stand,
    bestellungen,
    umsatzWocheCents,
    hoefe: { verkaufen, warten: stand.hoefeWartend.length },
    naechsteFassung,
    gruendung: { aktionBisTag: gruendung.aktionBisTag, fest: gruendung.festAm !== null },
    protokoll,
    antwortMs,
    laeufe: laeufe ?? stand.laeufe,
  }
}
