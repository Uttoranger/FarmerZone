import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { stornoBetraege, type StornoBetraege } from '@/lib/storno'
import { alsCents } from '@/lib/order-totals'
import { artikelFehltRechnung, type ArtikelFehltErgebnis } from '@/lib/artikel-fehlt'
import {
  abholungKurz,
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
import { zeitpunktFuerMail } from '@/lib/fristen'
import { gebuehrEntfallen, gebuehrErstattungOffen, gebuehrFuerMonatsabrechnung, istVorOrtZahlung } from '@/lib/servicegebuehr'
import { buildOrderReminderUrl } from '@/lib/whatsapp'
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

const OPEN_STATUSES = ['PENDING_CONFIRMATION', 'PAID', 'CONFIRMED', 'IN_PREPARATION', 'READY'] as const

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
  cancelReason: true,
  platformFeeAmount: true,
  stripePaymentIntentId: true,
  serviceFeePercentApplied: true,
  serviceFeeMinCentsApplied: true,
  serviceFeeRefundedAt: true,
  erstattetCents: true,
  items: {
    select: {
      id: true,
      productName: true,
      quantity: true,
      totalPrice: true,
      fehltSeit: true,
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
  marke: { text: string; ton: 'offen' | 'fertig' | 'neutral' }
}

export type HofBestellPosition = {
  id: string
  zeile: string
  betragCents: number
  fehlt: boolean
  /** Was „Artikel fehlt" für diese Position hieße — auf dem Server gerechnet. */
  fehltVorschau: ArtikelFehltErgebnis
}

export type HofBestellDetail = {
  id: string
  nummer: string
  status: string
  marke: { text: string; ton: 'offen' | 'fertig' | 'neutral' }
  /** „heute, 15–18 Uhr" */
  abholung: string
  bestelltAm: string
  kunde: { name: string; vorname: string; email: string; telefon: string; notiz: string | null }
  zahlart: string
  vorOrt: boolean
  bezahltAm: string | null
  betrag: {
    warenCents: number
    gebuehrCents: number
    gesamtCents: number
    erstattetCents: number
    gebuehrEntfallen: boolean
    gebuehrErstattungOffen: boolean
    /** Vor Ort: holt die Monatsabrechnung die Gebühr? (B1: bar vor dem SEPA-Start nicht.) */
    gebuehrFuerAbrechnung: boolean
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
    positionen: o.items.map((i) => ({ id: i.id, betragCents: alsCents(i.totalPrice), fehlt: i.fehltSeit !== null })),
  }
  const offenePositionen = o.items.filter((i) => i.fehltSeit === null).length

  return {
    id: o.id,
    nummer: o.orderNumber,
    status: o.status,
    marke: bestellMarke(o.status),
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
    betrag: {
      warenCents,
      gebuehrCents: o.serviceFeeCents,
      gesamtCents: warenCents + o.serviceFeeCents,
      erstattetCents: o.erstattetCents,
      gebuehrEntfallen: gebuehrEntfallen(o),
      gebuehrErstattungOffen: gebuehrErstattungOffen(o),
      gebuehrFuerAbrechnung: gebuehrFuerMonatsabrechnung({
        paymentMethod: o.paymentMethod,
        serviceFeeCents: o.serviceFeeCents,
        bestelltAm: o.createdAt,
      }),
    },
    positionen: o.items.map((i) => ({
      id: i.id,
      zeile: formatPosition({
        name: i.productName,
        quantity: i.quantity,
        unit: i.product?.unit ?? null,
        unitSize: i.product?.unitSize ?? null,
      }),
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
