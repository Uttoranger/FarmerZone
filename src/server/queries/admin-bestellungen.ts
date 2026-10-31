import type { OrderStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { MAIL_PROTOKOLL_AUFBEWAHREN_TAGE } from '@/lib/betrieb'
import { maskiereAdresse, zeitraumAb, type SuchMail } from '@/lib/betrieb-mails'
import { STAND_STATUS, type BestellProtokoll } from '@/lib/admin-bestellung'
import type { BestellFilter } from '@/schemas/admin-bestellung'
import type { MailSuche } from '@/schemas/betrieb-mails'
import { sucheMails } from '@/server/queries/mails'
import { ladeWiderrufeZurBestellung, type AdminWiderruf } from '@/server/widerruf'

/*
 * Lesen für Admin › Bestellungen (Register N32, N34; Nr. 186). Gerechnet
 * wird in src/lib/admin-bestellung.ts; hier nur Abfragen.
 *
 * Die Suche ist DIESELBE Abfrage wie Admin › Betrieb › E-Mails
 * (`sucheMails`, Nr. 161/167 — eine Quelle): Bestellnummer genau oder ganze
 * Adresse genau, nie eine Teilsuche. Ihre Treffer werden hier nur noch mit
 * dem Filter geschnitten.
 *
 * Die Adresse der Kundin verlässt diese Datei nur gekürzt
 * (`maskiereAdresse`); voll liest sie allein die Aktion „Kundin schreiben …“
 * nach Grund und mit Protokoll (src/server/actions/admin-bestellung.ts).
 */

const TAG_MS = 86_400_000
/** So viele Bestellungen zeigt die Liste höchstens — die Suche ist für den Einzelfall, nicht zum Blättern. */
export const BESTELL_LISTE_HOECHSTENS = 50

const ZEILE_FELDER = {
  id: true,
  orderNumber: true,
  createdAt: true,
  status: true,
  paymentMethod: true,
  paymentStatus: true,
  erstattungOffenSeit: true,
  farm: { select: { name: true } },
} as const satisfies Prisma.OrderSelect

/** Eine Zeile der Liste — ohne Adresse, ohne Namen der Kundin. */
export type BestellZeile = {
  id: string
  orderNumber: string
  createdAt: Date
  status: string
  paymentMethod: string
  paymentStatus: string
  erstattungOffenSeit: Date | null
  hofName: string
}

/** Die Bedingung des Filters (Stand, Hof, Zeitraum, offene Erstattung). */
export function bestellFilterBedingung(f: BestellFilter, jetzt: Date): Prisma.OrderWhereInput {
  return {
    createdAt: { gte: zeitraumAb(f.zeitraum, jetzt) },
    // STAND_STATUS hält die Status als Text (wie OFFEN_STATUS des Hofs); es sind Werte des Enums.
    ...(f.stand ? { status: { in: [...STAND_STATUS[f.stand]] as OrderStatus[] } } : {}),
    ...(f.hof ? { farmId: f.hof } : {}),
    ...(f.erstattungOffen ? { erstattungOffenSeit: { not: null } } : {}),
  }
}

/**
 * Die Liste: ohne Suche die neuesten Bestellungen im Filter, mit Suche die
 * Treffer von `sucheMails` im Filter. Eine ungültige oder leere Suche kommt
 * als `leer` bzw. `ungueltig` (`mailSucheAus`) — dann ohne Suche bzw. nichts.
 */
export async function ladeBestellListe(suche: MailSuche, f: BestellFilter, jetzt: Date): Promise<BestellZeile[]> {
  if (suche.art === 'ungueltig') return []
  let nurIds: string[] | null = null
  if (suche.art === 'bestellung' || suche.art === 'adresse') {
    nurIds = (await sucheMails(suche, jetzt)).bestellungen.map((b) => b.id)
    if (nurIds.length === 0) return []
  }
  const zeilen = await prisma.order.findMany({
    where: { ...bestellFilterBedingung(f, jetzt), ...(nurIds ? { id: { in: nurIds } } : {}) },
    orderBy: { createdAt: 'desc' },
    take: BESTELL_LISTE_HOECHSTENS,
    select: ZEILE_FELDER,
  })
  return zeilen.map(({ farm, ...z }) => ({ ...z, hofName: farm.name }))
}

const DETAIL_FELDER = {
  id: true,
  orderNumber: true,
  farmId: true,
  customerEmail: true,
  status: true,
  totalAmount: true,
  serviceFeeCents: true,
  erstattetCents: true,
  pickupDate: true,
  pickupTimeStart: true,
  pickupTimeEnd: true,
  paymentMethod: true,
  paymentStatus: true,
  stripePaymentIntentId: true,
  createdAt: true,
  paidAt: true,
  confirmedAt: true,
  pickedUpAt: true,
  cancelledAt: true,
  cancelReason: true,
  erstattungOffenSeit: true,
  farm: { select: { name: true } },
  items: {
    orderBy: { id: 'asc' },
    select: { id: true, productName: true, quantity: true, totalPrice: true, fehltSeit: true, product: { select: { unit: true, unitSize: true } } },
  },
} as const satisfies Prisma.OrderSelect

type DetailRoh = Prisma.OrderGetPayload<{ select: typeof DETAIL_FELDER }>

/** Das Detail einer Bestellung — die Adresse nur gekürzt, dazu Protokoll, Mails und der neueste Faden des Hofs. */
export type BestellDetail = Omit<DetailRoh, 'customerEmail' | 'farm'> & {
  hofName: string
  kundinGekuerzt: string
  kundinBestellungen90: number
  protokoll: BestellProtokoll[]
  mails: SuchMail[]
  hofFadenId: string | null
  /** Die Widerrufe dieser Bestellung (Nr. 200, Nachbesserung Runde 2) — mit Text der Kundin, nur hier im Detail. */
  widerrufe: AdminWiderruf[]
}

export async function ladeBestellDetail(id: string, jetzt: Date): Promise<BestellDetail | null> {
  const roh = await prisma.order.findUnique({ where: { id }, select: DETAIL_FELDER })
  if (!roh) return null
  const ab = new Date(jetzt.getTime() - MAIL_PROTOKOLL_AUFBEWAHREN_TAGE * TAG_MS)
  const [kundinBestellungen90, protokoll, gefunden, faden, widerrufe] = await Promise.all([
    prisma.order.count({ where: { customerEmail: roh.customerEmail, createdAt: { gte: ab } } }),
    prisma.adminAktion.findMany({
      where: { bezugArt: 'bestellung', bezugId: roh.id },
      orderBy: { wann: 'asc' },
      take: 100,
      select: { wann: true, art: true, grund: true, mitPasskey: true },
    }),
    // Die Mails zur Bestellung: dieselbe Suche wie Admin › Betrieb › E-Mails (Nr. 167).
    sucheMails({ art: 'bestellung', nummer: roh.orderNumber }, jetzt),
    prisma.unterhaltung.findFirst({ where: { farmId: roh.farmId }, orderBy: { letzteNachrichtAm: 'desc' }, select: { id: true } }),
    ladeWiderrufeZurBestellung(roh.id, roh.items),
  ])
  const { customerEmail, farm, ...rest } = roh
  return {
    ...rest,
    hofName: farm.name,
    kundinGekuerzt: maskiereAdresse(customerEmail),
    kundinBestellungen90,
    protokoll,
    mails: gefunden.mails,
    hofFadenId: faden?.id ?? null,
    widerrufe,
  }
}
