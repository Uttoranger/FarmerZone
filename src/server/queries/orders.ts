import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { OPEN_STATUSES } from '@/lib/bestellstatus-offen'
import * as Sentry from '@sentry/nextjs'
import { gebuehrFuerMonatsabrechnungJeModell, geldsaetzeFuer, istHofpreisBestellung, type GebuehrEinzug } from '@/lib/plattformgebuehr'
import { positionszeile, type Positionszeile } from '@/lib/positionszeile'
import { ladeHofpreisEinstellung } from '@/server/queries/plattform-einstellung'
import { ladeGruendungBis } from '@/server/queries/admin'
import { stornoBetraege, type StornoBetraege } from '@/lib/storno'
import { alsCents } from '@/lib/order-totals'
import { artikelFehltRechnung, type ArtikelFehltErgebnis } from '@/lib/artikel-fehlt'
import {
  abholungKurz,
  bestaetigungOffenSatz,
  bestellAktionen,
  bestellKopfzeile,
  bestellMarke,
  filterChips,
  gruppiereNachAbholfenster,
  positionenText,
  vorname,
  zahlartText,
  type BestellAktionen,
} from '@/lib/hof-bestellungen'
import { formatPosition } from '@/lib/format'
import { fristVon, tagInWorten, uhrzeitInWien, zeitpunktFuerMail } from '@/lib/fristen'
import { abholtagName, abholtage, abholWhere, fensterMitBestellungen, naechsteAbholungWhere, wienerTag, type NaechstesFenster } from '@/lib/heute'
import { wienKalendertag } from '@/lib/kalender'
import { gebuehrEntfallen, gebuehrErstattungOffen, istVorOrtZahlung } from '@/lib/servicegebuehr'
import { buildOrderReminderUrl } from '@/lib/whatsapp'
import type { MarkeArt } from '@/lib/marke-art'
import type { HofBestellFilter } from '@/schemas/hof-bestellungen'

const ORDER_INCLUDE = {
  items: {
    select: {
      id: true,
      productId: true,
      productName: true,
      quantity: true,
      unitPrice: true,
      totalPrice: true,
      // „Artikel fehlt" (E14) — die Druckansicht markiert die Position.
      fehltSeit: true,
      // Einheit nur zur Anzeige gejoint (formatOrderLine) — kein Schema-Change
      product: { select: { unit: true, unitSize: true } },
    },
  },
} as const

type RawOrder = Awaited<ReturnType<typeof fetchOrders>>[number]

function serialize(order: RawOrder) {
  // Geld als ganze Cent, gewandelt über Decimal (alsCents) — nie Number(decimal)
  // (CODING_STANDARDS §2, Nr. 19b). Der Warenpreis bleibt zusätzlich als Text
  // für bestellSummen, das den Decimal-Text selbst in Cent wandelt.
  const { totalAmount, platformFeeAmount, items, ...rest } = order
  return {
    ...rest,
    totalAmount: totalAmount.toString(),
    totalAmountCents: alsCents(totalAmount),
    platformFeeAmountCents: alsCents(platformFeeAmount),
    // Servicegebühr-Snapshot: Cent bleiben Int, der Prozentsatz ist ein Decimal
    // (kein Geld) — über die Decimal-Methode wie in getHofBestellDetail, nie
    // über Number(...) (Nr. 32).
    serviceFeePercentApplied:
      order.serviceFeePercentApplied == null ? null : order.serviceFeePercentApplied.toNumber(),
    // Was ein Storno an Geld bewegt (src/lib/storno.ts) — Decimal wird hier
    // an der Servergrenze zu ganzen Cent; der Storno-Dialog zeigt es,
    // cancelOrder rechnet dasselbe.
    storno: stornoBetraege({
      stripePaymentIntentId: order.stripePaymentIntentId,
      paymentStatus: order.paymentStatus,
      warenpreisCents: alsCents(totalAmount),
      provisionCents: alsCents(platformFeeAmount),
      serviceFeeCents: order.serviceFeeCents,
    }),
    items: items.map(({ unitPrice, totalPrice, ...i }) => ({
      ...i,
      unitPriceCents: alsCents(unitPrice),
      totalPriceCents: alsCents(totalPrice),
      // Decimal → number, sonst nicht über die RSC-Grenze serialisierbar
      product: i.product
        ? { unit: i.product.unit, unitSize: i.product.unitSize == null ? null : i.product.unitSize.toNumber() }
        : null,
    })),
  }
}

async function fetchOrders(farmId: string) {
  return prisma.order.findMany({
    where: { farmId },
    include: ORDER_INCLUDE,
    orderBy: [{ pickupDate: 'asc' }, { pickupTimeStart: 'asc' }],
  })
}

async function fetchOrder(farmId: string, orderId: string) {
  return prisma.order.findFirst({
    where: { id: orderId, farmId },
    include: ORDER_INCLUDE,
  })
}

export type FarmerOrder = ReturnType<typeof serialize>
export type FarmerOrderDetail = FarmerOrder

export async function getOrdersForFarm(farmId: string) {
  const rows = await fetchOrders(farmId)
  return rows.map(serialize)
}

export async function getOrderDetail(farmId: string, orderId: string) {
  const row = await fetchOrder(farmId, orderId)
  return row ? serialize(row) : null
}

/**
 * Offen = alles, was nicht abgeholt, storniert oder verfallen (nicht abgeholt) ist —
 * auch „Bestätigung offen“ (Register N41 e). Die Liste liegt Prisma-frei in
 * src/lib/bestellstatus-offen.ts (dort liest sie auch der Chip „Noch offen · n“);
 * hier unter demselben Namen weitergereicht, damit Aufrufer und Tests der Abfrage
 * keine zweite Liste führen.
 */
export { OPEN_STATUSES }

export async function getOpenOrdersCount(farmId: string): Promise<number> {
  return prisma.order.count({
    where: { farmId, status: { in: [...OPEN_STATUSES] } },
  })
}

// ─── Bestellungen im neuen Design (/orders, /orders/[orderId], Nachtlauf Nr. 19) ───

/*
 * Was die Seite braucht, ausdrücklich ausgewählt — kein `...order` an den
 * Browser (Bestätigungs-Token, Idempotenz-Schlüssel und PaymentIntent haben
 * dort nichts verloren). Beträge gehen als ganze Cent, Zeiten als fertiger
 * Text; was gezeigt und angeboten wird, entscheiden src/lib/hof-bestellungen.ts,
 * src/lib/artikel-fehlt.ts und src/lib/storno.ts.
 */
const LISTE_AUSWAHL = {
  id: true,
  orderNumber: true,
  status: true,
  customerName: true,
  pickupDate: true,
  pickupTimeStart: true,
  pickupTimeEnd: true,
  paymentMethod: true,
  paymentStatus: true,
  totalAmount: true,
  serviceFeeCents: true,
  items: { select: { productName: true, quantity: true, fehltSeit: true } },
} satisfies Prisma.OrderSelect

const DETAIL_AUSWAHL = {
  ...LISTE_AUSWAHL,
  customerEmail: true,
  customerPhone: true,
  customerNote: true,
  createdAt: true,
  paidAt: true,
  pickedUpAt: true,
  cancelReason: true,
  platformFeeAmount: true,
  stripePaymentIntentId: true,
  serviceFeePercentApplied: true,
  serviceFeeMinCentsApplied: true,
  // N38 (Nr. 197): im Hofpreis-Modell zieht „Artikel fehlt“ die Gebühr der Position ab.
  gebuehrModell: true,
  gebuehrEinzug: true,
  serviceFeeRefundedAt: true,
  erstattetCents: true,
  items: {
    select: {
      id: true,
      productName: true,
      quantity: true,
      totalPrice: true,
      fehltSeit: true,
      gebuehrCents: true,
      product: { select: { unit: true, unitSize: true } },
    },
    orderBy: { id: 'asc' },
  },
} satisfies Prisma.OrderSelect

export type HofListenEintrag = {
  id: string
  nummer: string
  kunde: string
  positionen: string
  gesamtCents: number
  zahlart: string
  marke: { text: string; art: MarkeArt }
}

export type HofBestellPosition = {
  id: string
  zeile: string
  /** Die Positionszeile nach G14 („**4** × Heumilch frisch (1 L)“, positionszeile) — die Anzahl fett vorn. */
  teile?: Positionszeile
  betragCents: number
  fehlt: boolean
  /** Was „Artikel fehlt" für diese Position hieße — auf dem Server gerechnet. */
  fehltVorschau: ArtikelFehltErgebnis
}

export type HofBestellDetail = {
  id: string
  nummer: string
  status: string
  marke: { text: string; art: MarkeArt }
  /** „heute, 15–18 Uhr" */
  abholung: string
  bestelltAm: string
  kunde: { name: string; vorname: string; email: string; telefon: string; notiz: string | null }
  zahlart: string
  vorOrt: boolean
  bezahltAm: string | null
  /** Abgeholt: „16:05“ (Wiener Uhrzeit aus pickedUpAt) für „· abgeholt um 16:05“ (Board s1-bestellung Bild 4). */
  abgeholtUm?: string | null
  /** Vor Ort: „bar, bezahlt wird bei Abholung“ hinter „Bestellt: …“ (Board w1-bestellung); online null. */
  zahlungBeiAbholung?: string | null
  betrag: {
    warenCents: number
    gebuehrCents: number
    gesamtCents: number
    erstattetCents: number
    gebuehrEntfallen: boolean
    gebuehrErstattungOffen: boolean
    /** Vor Ort: holt die Monatsabrechnung die Gebühr? (B1: bar vor dem SEPA-Start nicht.) */
    gebuehrFuerAbrechnung: boolean
    /** N38: Bestellung im Hofpreis-Modell — „Du bekommst … · die Kundin zahlt …“. */
    hofpreis: boolean
  }
  positionen: HofBestellPosition[]
  storno: StornoBetraege | null
  stornoGrund: string | null
  aktionen: BestellAktionen
  /** WhatsApp-Erinnerung an die Kundin, nur solange etwas abzuholen ist. */
  erinnernUrl: string | null
}

export type BestellungenSeite = {
  kopfzeile: string
  chips: Array<{ filter: HofBestellFilter; text: string }>
  gruppen: Array<{ schluessel: string; titel: string; bestellungen: HofListenEintrag[] }>
  /** Gibt es überhaupt Bestellungen (für den leeren Zustand)? */
  hatBestellungen: boolean
}

type ListenZeile = Prisma.OrderGetPayload<{ select: typeof LISTE_AUSWAHL }>

function listenEintrag(o: ListenZeile): HofListenEintrag {
  return {
    id: o.id,
    nummer: o.orderNumber,
    kunde: o.customerName,
    positionen: positionenText(o.items.filter((i) => i.fehltSeit === null)),
    gesamtCents: alsCents(o.totalAmount) + o.serviceFeeCents,
    zahlart: zahlartText(o.paymentMethod, o.paymentStatus),
    marke: bestellMarke(o.status),
  }
}

export async function getBestellungenSeite(farmId: string, filter: HofBestellFilter, jetzt: Date): Promise<BestellungenSeite> {
  const zeilen = await prisma.order.findMany({ where: { farmId }, select: LISTE_AUSWAHL })
  const gruppen = gruppiereNachAbholfenster(zeilen, filter, jetzt)
  return {
    kopfzeile: bestellKopfzeile(zeilen),
    chips: filterChips(zeilen, jetzt),
    gruppen: gruppen.map((g) => ({ schluessel: g.schluessel, titel: g.titel, bestellungen: g.bestellungen.map(listenEintrag) })),
    hatBestellungen: zeilen.length > 0,
  }
}

const ERINNERN_STATUS: readonly string[] = ['PAID', 'CONFIRMED', 'READY']

/** Eine Bestellung DIESES Hofs — eine fremde ID ergibt null (die Seite zeigt 404). */
export async function getHofBestellDetail(
  farm: { id: string; name: string },
  orderId: string,
  jetzt: Date
): Promise<HofBestellDetail | null> {
  const o = await prisma.order.findFirst({ where: { id: orderId, farmId: farm.id }, select: DETAIL_AUSWAHL })
  if (!o) return null

  const warenCents = alsCents(o.totalAmount)
  const rechenStand = {
    status: o.status,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    stripePaymentIntentId: o.stripePaymentIntentId,
    warenpreisCents: warenCents,
    serviceFeeCents: o.serviceFeeCents,
    serviceFeePercentApplied: o.serviceFeePercentApplied === null ? null : o.serviceFeePercentApplied.toNumber(),
    serviceFeeMinCentsApplied: o.serviceFeeMinCentsApplied,
    erstattetCents: o.erstattetCents,
    bestelltAm: o.createdAt,
    gebuehrModell: o.gebuehrModell,
    gebuehrEinzug: o.gebuehrEinzug,
    positionen: o.items.map((i) => ({ id: i.id, betragCents: alsCents(i.totalPrice), fehlt: i.fehltSeit !== null, gebuehrCents: i.gebuehrCents })),
  }
  const offenePositionen = o.items.filter((i) => i.fehltSeit === null).length

  return {
    id: o.id,
    nummer: o.orderNumber,
    status: o.status,
    // Abgeholt grün statt grau (Liste Lauf 32, bestellung Bild 4: Status fertig) — das grüne Paar der Marke ist
    // „läuft“ (Register G5 kennt keine eigene Art „fertig“); Liste, Admin und Kundendetail bleiben bei bestellMarke.
    marke: o.status === 'PICKED_UP' ? { ...bestellMarke(o.status), art: 'laeuft' } : bestellMarke(o.status),
    abholung: abholungKurz(o.pickupDate, o.pickupTimeStart, o.pickupTimeEnd, jetzt),
    bestelltAm: zeitpunktFuerMail(o.createdAt),
    kunde: {
      name: o.customerName,
      vorname: vorname(o.customerName),
      email: o.customerEmail,
      telefon: o.customerPhone,
      notiz: o.customerNote,
    },
    zahlart: zahlartText(o.paymentMethod, o.paymentStatus),
    vorOrt: istVorOrtZahlung(o.paymentMethod),
    bezahltAm: o.paidAt ? zeitpunktFuerMail(o.paidAt) : null,
    abgeholtUm: o.status === 'PICKED_UP' && o.pickedUpAt ? uhrzeitInWien(o.pickedUpAt) : null,
    zahlungBeiAbholung: ZAHLUNG_BEI_ABHOLUNG[o.paymentMethod] ?? null,
    betrag: {
      warenCents,
      gebuehrCents: o.serviceFeeCents,
      gesamtCents: warenCents + o.serviceFeeCents,
      erstattetCents: o.erstattetCents,
      gebuehrEntfallen: gebuehrEntfallen(o),
      gebuehrErstattungOffen: gebuehrErstattungOffen(o),
      // Im Hofpreis-Modell (N38) nur, was per Lastschrift oder Überweisung kommt — „erlassen“ bleibt beim Hof.
      gebuehrFuerAbrechnung: gebuehrFuerMonatsabrechnungJeModell({
        paymentMethod: o.paymentMethod,
        serviceFeeCents: o.serviceFeeCents,
        bestelltAm: o.createdAt,
        gebuehrModell: o.gebuehrModell,
        gebuehrEinzug: o.gebuehrEinzug,
      }),
      hofpreis: istHofpreisBestellung(o),
    },
    positionen: o.items.map((i) => ({
      id: i.id,
      zeile: formatPosition({
        name: i.productName,
        quantity: i.quantity,
        unit: i.product?.unit ?? null,
        unitSize: i.product?.unitSize ?? null,
      }),
      teile: positionszeile({ name: i.productName, quantity: i.quantity, unit: i.product?.unit ?? null, unitSize: i.product?.unitSize ?? null }),
      betragCents: alsCents(i.totalPrice),
      fehlt: i.fehltSeit !== null,
      fehltVorschau: artikelFehltRechnung(rechenStand, i.id),
    })),
    storno: stornoBetraege({
      stripePaymentIntentId: o.stripePaymentIntentId,
      paymentStatus: o.paymentStatus,
      warenpreisCents: warenCents,
      provisionCents: alsCents(o.platformFeeAmount),
      serviceFeeCents: o.serviceFeeCents,
    }),
    stornoGrund: o.cancelReason,
    aktionen: bestellAktionen({ status: o.status, paymentMethod: o.paymentMethod, offenePositionen }),
    erinnernUrl:
      ERINNERN_STATUS.includes(o.status) && o.customerPhone
        ? buildOrderReminderUrl(o.customerPhone, {
            customerName: o.customerName,
            orderNumber: o.orderNumber,
            farmName: farm.name,
            pickupDate: o.pickupDate,
            pickupTimeStart: o.pickupTimeStart,
            pickupTimeEnd: o.pickupTimeEnd,
          })
        : null,
  }
}

// ─── Kleine Leser der Hof-Bestellseiten (Nr. 222; vorher in src/app/(hof)/orders/) ───

/**
 * Bis wann die Kundin eine Bar-Bestellung bestätigen muss — der Satz für die
 * Bestellung im Hofbereich (V87: die Frist kommt immer aus fristVon, nie als
 * eigene Zahl). Nur bei „Bestätigung offen“; sonst null, ohne Abfrage. Liest
 * die vier Felder der Frist nach ID UND Hof (eine fremde ID findet nichts) —
 * die Bestellung selbst bleibt die aus getHofBestellDetail.
 */
export async function barFristSatz(farmId: string, detail: HofBestellDetail, jetzt: Date): Promise<string | null> {
  if (detail.status !== 'PENDING_CONFIRMATION' || !detail.vorOrt) return null
  const frist = await prisma.order.findFirst({
    where: { id: detail.id, farmId },
    select: { paymentMethod: true, createdAt: true, pickupDate: true, pickupTimeStart: true },
  })
  if (!frist) return null
  const bis = fristVon(frist)
  return bestaetigungOffenSatz(detail.kunde.vorname, `${tagInWorten(bis, jetzt)}, ${uhrzeitInWien(bis)} Uhr`)
}

// Hinter „Bestellt: …“ bei Zahlung vor Ort (Board w1-bestellung); Karte ist Altbestand.
const ZAHLUNG_BEI_ABHOLUNG: Record<string, string> = {
  ONSITE_CASH: 'bar, bezahlt wird bei Abholung',
  ONSITE_CARD: 'mit Karte, bezahlt wird bei Abholung',
}

/**
 * Der Geldsatz nach V1 unter dem Betrag der Bestellung (Liste Lauf 32, bestellung Bild 1/2/4): „Du bekommst die
 * vollen € … – bis <Gründungsende> zahlst du auf Barverkäufe keine Plattformgebühr.“ bzw. der Satz des Modells —
 * EINE Anzeige-Hilfe (geldsaetzeFuer, Nr. 248), nur aus dem Snapshot der Bestellung, keine Rechnung. Das Datum
 * kommt aus den heutigen Hofdaten (einzugAb bzw. wirksames Gründungsende, ladeGruendungBis — dieselben Werte wie
 * beim Einzug). null im Modell „bisher“ und bei entfallener Gebühr; dann bleibt der Satz der Seite (betragSatz).
 * Nur der eigene Hof: Bestellung nach ID UND farmId. Ein Ladefehler nimmt nur den Satz weg, nie die Seite.
 */
export async function ladeBestellGeldsatz(farmId: string, orderId: string, jetzt: Date): Promise<string | null> {
  try {
    const [o, hof, einstellung] = await Promise.all([
      prisma.order.findFirst({
        where: { id: orderId, farmId },
        select: { totalAmount: true, serviceFeeCents: true, serviceFeeRefundedAt: true, paymentMethod: true, gebuehrModell: true, gebuehrEinzug: true },
      }),
      prisma.farm.findUnique({ where: { id: farmId }, select: { id: true, einzugAb: true, plattformgebuehrProzent: true } }),
      ladeHofpreisEinstellung(),
    ])
    if (!o || !hof) return null
    const gruendungBis = hof.einzugAb ? null : await ladeGruendungBis({ id: hof.id })
    const satz = geldsaetzeFuer(
      { art: 'bestellung', bestellung: { ...o, gebuehrEinzug: gebuehrEinzugAus(o.gebuehrEinzug) } },
      hof,
      einstellung,
      gruendungBis,
      jetzt
    )
    return satz?.satz ?? null
  } catch (err) {
    Sentry.captureException(err, { tags: { bereich: 'bestellung-geldsatz' }, extra: { farmId, orderId } })
    return null
  }
}

/** `Order.gebuehrEinzug` ist in der DB ein Text — nur die vier Wege gehen an den Geldsatz, alles andere ist null. */
function gebuehrEinzugAus(wert: string | null): GebuehrEinzug | null {
  return wert === 'stripe' || wert === 'sepa' || wert === 'ueberweisung' || wert === 'erlassen' ? wert : null
}

/**
 * Wartet der Hof noch auf die Freischaltung? Für den Leerzustand von Bestellungen (Board s1-bestellungen Bild 3):
 * Vor der Freischaltung kann er seine Hofseite noch nicht teilen, der Weg führt zu dem, was noch fehlt.
 */
export async function hofWartetAufFreigabe(farmId: string): Promise<boolean> {
  const hof = await prisma.farm.findUnique({ where: { id: farmId }, select: { approvedAt: true } })
  return hof?.approvedAt == null
}

/**
 * Das nächste Abholfenster laut Abholzeiten samt der Zahl seiner Bestellungen —
 * für die leeren Zustände von „Heute abholen" (Bestellungen) und der Packliste
 * auf Papier (Boards s1-bestellungen, s2-druck). Gezählt über abholWhere,
 * dieselbe Bedingung wie die Packliste; ohne aktive Abholzeit null.
 */
export async function naechstesFensterMitZahl(farmId: string, jetzt: Date): Promise<{ fenster: NaechstesFenster; anzahl: number } | null> {
  const slots = await prisma.pickupSlot.findMany({
    where: { farmId, isActive: true },
    select: { dayOfWeek: true, startTime: true, endTime: true },
  })
  if (slots.length === 0) return null
  // Liste Lauf 32 (bestellungen Bild 2, druck Bild 3): ohne Bestellung im nächsten Fenster das nächste Fenster mit
  // Bestellungen (fensterMitBestellungen) — gezählt über dieselbe Bedingung wie die Packliste (abholWhere).
  const [anzahlHeute, naechste] = await Promise.all([
    prisma.order.count({ where: abholWhere(farmId, abholtage(jetzt).heute) }),
    prisma.order.findFirst({ where: naechsteAbholungWhere(farmId, jetzt), orderBy: { pickupDate: 'asc' }, select: { pickupDate: true } }),
  ])
  let naechsteAbholung = null
  if (naechste) {
    const tag = wienKalendertag(naechste.pickupDate)
    const anzahl = await prisma.order.count({ where: abholWhere(farmId, wienerTag(tag)) })
    naechsteAbholung = { tag, name: abholtagName(wienKalendertag(jetzt), tag), anzahl }
  }
  return fensterMitBestellungen(slots, jetzt, anzahlHeute, naechsteAbholung)
}
