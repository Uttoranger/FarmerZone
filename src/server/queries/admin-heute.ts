import { ladePlattformgebuehrAufgaben } from '@/server/plattformgebuehr-abrechnung'
import { prisma } from '@/lib/prisma'
import { STRIPE_LIVE_AB } from '@/lib/umgebung-server'
import { ladeErstattungAufgaben, ladeHofAufgaben } from '@/server/queries/postfach'
import { ladeProbleme } from '@/server/queries/mails'
import { ladeAeltesteWichtige, ladeLaeufe } from '@/server/queries/betrieb'
import { getMeldungenFuerAdmin } from '@/server/queries/meldung'
import { ladeOffeneAbweichungen } from '@/server/queries/geld'
import { leseBestellstopp, lesePlattformEinstellung } from '@/server/queries/plattform-einstellung'
import { naechsterTermin } from '@/server/queries/startseite'
import { centAusDecimal } from '@/server/queries/umsatz'
import { MELDUNG_STATUS_OFFEN_IM_EINGANG } from '@/lib/postfach'
import { ABHOLUNG_ERLEDIGT, abholtage } from '@/lib/heute'
import { umsatzBestellungWhere, umsatzfenster } from '@/lib/umsatz'
import { ohneTestzahlungenWhere } from '@/lib/testzahlung'
import { gruendungEinstellungAus } from '@/lib/plattform-einstellung'
import type { AblaufLaufDaten } from '@/lib/betrieb'
import { sammleAufgaben, LEERER_STAND, type Aufgabe, type AufgabeHof, type AufgabenStand, type HeuteWoche, type ProtokollRoh } from '@/lib/admin-aufgaben'

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
      // Storno und Testzahlung sind keine Bestellung im Sinn des Signals.
      orders: { where: { status: { not: 'CANCELLED' }, AND: [ohneTestzahlungenWhere(STRIPE_LIVE_AB)] }, orderBy: { createdAt: 'desc' }, select: { createdAt: true }, take: 1 },
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
  const [hoefeWartend, erstattungen, mailProbleme, meldungen, hoefeAktiv, bestellstopp, plattformgebuehr, betrieb] = await Promise.all([
    ladeHofAufgaben(jetzt),
    ladeErstattungAufgaben(),
    ladeProbleme(jetzt),
    getMeldungenFuerAdmin({ status: [...MELDUNG_STATUS_OFFEN_IM_EINGANG], art: null }),
    ladeHoefeAktiv(),
    // Die Notbremse (Nr. 189) frisch, nicht aus dem Cache der Kundenseiten — gesetzt, steht sie sofort oben.
    leseBestellstopp(),
    // Monatsabrechnung der Plattformgebühr (Nr. 198): gescheitert, zurückgebucht, Rechnungsangaben, Quote.
    ladePlattformgebuehrAufgaben(jetzt),
    mitBetrieb
      ? Promise.all([
          ladeAeltesteWichtige(),
          prisma.betriebWarnung.findMany({ where: { stufe: { gt: 0 } }, select: { art: true, stufe: true, seit: true } }),
          ladeLaeufe(),
          // Der Geld-Abgleich läuft nur in der Produktion (Nr. 191) — außerhalb gibt es keine Zeilen.
          ladeOffeneAbweichungen(),
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
    bestellstopp,
    plattformgebuehr,
    ...(betrieb ? { wartendeMail: betrieb[0], warnungen: betrieb[1], laeufe: betrieb[2], geldAbweichungen: betrieb[3] } : {}),
  }
}

/** Die Aufgaben „Braucht dich“ — für Heute und die Zahl der Betriebsleiste dieselbe Quelle. */
export async function ladeAdminAufgaben(jetzt: Date, optionen: { mitBetrieb: boolean }): Promise<Aufgabe[]> {
  return sammleAufgaben(await ladeAufgabenStand(jetzt, optionen), jetzt)
}

export type HeuteRoh = {
  stand: AufgabenStand
  bestellungen: { zurAbholung: number; nichtGepackt: number; storniert: number }
  /** Die Woche aller Höfe (Umsatzregel), Beträge in Cent. */
  woche: HeuteWoche
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

/**
 * Die Woche aller Höfe nach der Umsatzregel (`umsatzBestellungWhere` ohne den
 * Hof): abgeholte Bestellungen seit Montag (Wien) ohne Testzahlungen — ihr
 * Warenwert, ihre Servicegebühr (ohne entfallene, wie die Monatsabrechnung)
 * und ihre Zahl gegen die Vorwoche bis zum selben Zeitpunkt (`umsatzfenster`).
 */
async function ladeWoche(jetzt: Date, stripeLiveAb: Date | null): Promise<HeuteRoh['woche']> {
  const fenster = umsatzfenster('woche', jetzt)
  const alleHoefe = (f: typeof fenster.aktuell) => {
    const where = umsatzBestellungWhere('', f, stripeLiveAb)
    delete where.farmId
    return where
  }
  const aktuell = alleHoefe(fenster.aktuell)
  const [summe, gebuehr, anzahlVorwoche] = await Promise.all([
    prisma.order.aggregate({ where: aktuell, _sum: { totalAmount: true }, _count: { _all: true } }),
    prisma.order.aggregate({ where: { ...aktuell, serviceFeeRefundedAt: null }, _sum: { serviceFeeCents: true } }),
    prisma.order.count({ where: alleHoefe(fenster.vergleich) }),
  ])
  return {
    umsatzCents: centAusDecimal(summe._sum.totalAmount),
    gebuehrCents: gebuehr._sum.serviceFeeCents ?? 0,
    anzahl: summe._count._all,
    anzahlVorwoche,
  }
}

/** Alles für die Seite Heute: Aufgaben-Stand, Lage, Kommt und die letzten drei Einträge im Protokoll. */
export async function ladeHeute(jetzt: Date, optionen: { mitBetrieb: boolean }, stripeLiveAb: Date | null = STRIPE_LIVE_AB): Promise<HeuteRoh> {
  const [stand, bestellungen, woche, verkaufen, naechsteFassung, einstellung, protokoll, antwortMs, laeufe] = await Promise.all([
    ladeAufgabenStand(jetzt, optionen),
    ladeBestellungenHeute(jetzt, stripeLiveAb),
    ladeWoche(jetzt, stripeLiveAb),
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
    woche,
    hoefe: { verkaufen, warten: stand.hoefeWartend.length },
    naechsteFassung,
    gruendung: { aktionBisTag: gruendung.aktionBisTag, fest: gruendung.festAm !== null },
    protokoll,
    antwortMs,
    laeufe: laeufe ?? stand.laeufe,
  }
}
