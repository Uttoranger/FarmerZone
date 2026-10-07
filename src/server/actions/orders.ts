'use server'

import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { revalidatePath } from 'next/cache'
import { sendOrderReady, sendOrderCancelled, sendOrderNotReady, type OrderForEmail } from '@/lib/email'
import { nachDerAntwort } from '@/lib/nach-der-antwort'
import * as Sentry from '@sentry/nextjs'
import type { OrderStatus } from '@prisma/client'
import {
  nachTeilerstattung,
  plattformgebuehrCents,
  restNachTeilerstattung,
  stornoBetraege,
  type RestStorno,
  type StornoBetraege,
} from '@/lib/storno'
import { alsCents } from '@/lib/order-totals'
import { zahlungNachRueckweg } from '@/lib/hof-bestellungen'
import { artikelFehltEingabeSchema, stornoEingabeSchema } from '@/schemas/hof-bestellungen'
import { meldeFehlendenArtikel } from '@/server/artikel-fehlt'
import {
  StripeStandUnklar,
  bucheVomHofZurueck,
  erstatteKundin,
  erstattungZaehlt,
  hatErstattungen,
  ladeStripeStand,
  teilstornoSumme,
  vollstornoMerkmal,
  type UnklarGrund,
} from '@/server/teilerstattung'
import { sendArtikelFehlt, sendErstattungOffen } from '@/lib/email'

export type ActionResult = { error?: string }

/**
 * Was ein Storno zurückmeldet: die Beträge aus derselben Rechnung wie im
 * Storno-Dialog (src/lib/storno.ts), sobald Stripe erstattet hat — vor Ort
 * bezahlt beide 0. Scheitert die Erstattung, `erstattungOffen` statt Beträgen.
 */
export type StornoErgebnis = ActionResult & {
  /** Was die Kundin zurückbekommen hat (Warenpreis + Servicegebühr). */
  erstattetCents?: number
  /** Was von der nächsten Auszahlung des Hofs abgezogen wird (Warenpreis). */
  vomHofCents?: number
  erstattungOffen?: boolean
}

/** Was „Artikel fehlt" zurückmeldet (E14, Nr. 19). */
export type ArtikelFehltErgebnis = StornoErgebnis & {
  /** Fehlte der letzte Artikel, wurde die ganze Bestellung storniert. */
  storniert?: boolean
  /** Bar/vor Ort: der neue Betrag zum Kassieren; online: der neue Bestellbetrag. */
  neuGesamtCents?: number
}

// Für den Fall, dass ein bedingter Statuswechsel nichts mehr trifft: Die
// Bestellung gibt es, sie hat sich nur seit dem Laden der Seite geändert
// (typisch: in einem anderen Tab storniert). „Nicht gefunden" wäre falsch.
const BESTELLUNG_INZWISCHEN_GEAENDERT =
  'Die Bestellung wurde inzwischen geändert, zum Beispiel storniert. Lade die Seite neu.'

async function getAuthFarm() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null

  return prisma.farm.findUnique({
    where: { ownerId: session.user.id },
    select: {
      id: true, name: true, slug: true, email: true, ownerName: true,
      address: true, postalCode: true, city: true, phone: true,
    },
  })
}

type DbOrder = {
  id: string
  orderNumber: string
  customerName: string
  customerEmail: string
  customerPhone: string
  totalAmount: { toString(): string }
  /** Servicegebühr-Snapshot in Cent (Order.serviceFeeCents). */
  serviceFeeCents?: number
  pickupDate: Date
  pickupTimeStart: string
  pickupTimeEnd: string
  paymentMethod: string
  stripePaymentIntentId?: string | null
  items: Array<{
    productName: string
    quantity: number
    unitPrice: { toString(): string }
    totalPrice: { toString(): string }
    product?: { unit: string; unitSize: { toString(): string } | null } | null
  }>
}

type FarmInfo = {
  id: string; name: string; slug: string; email: string; ownerName: string
  address: string; postalCode: string; city: string; phone: string
}

function toEmailOrder(order: DbOrder, farm: FarmInfo): OrderForEmail {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    totalAmount: order.totalAmount,
    serviceFeeCents: order.serviceFeeCents ?? 0,
    pickupDate: order.pickupDate,
    pickupTimeStart: order.pickupTimeStart,
    pickupTimeEnd: order.pickupTimeEnd,
    paymentMethod: order.paymentMethod,
    stripePaymentIntentId: order.stripePaymentIntentId,
    farm,
    items: order.items.map(i => ({
      productName: i.productName,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      totalPrice: i.totalPrice,
      product: i.product ?? null,
    })),
  }
}

const ORDER_EMAIL_SELECT = {
  id: true,  // order ID (needed for reorder token)
  orderNumber: true,
  customerName: true,
  customerEmail: true,
  customerPhone: true,
  totalAmount: true,
  // Provision: Teil der application_fee — der Storno gibt sie dem Hof zurück (src/lib/storno.ts)
  platformFeeAmount: true,
  // Servicegebühr-Snapshot: für die Mails (Gesamtbetrag) und den Storno-Vermerk
  serviceFeeCents: true,
  serviceFeeRefundedAt: true,
  pickupDate: true,
  pickupTimeStart: true,
  pickupTimeEnd: true,
  paymentMethod: true,
  paymentStatus: true,
  stripePaymentIntentId: true,
  items: {
    select: {
      id: true,
      productId: true,
      productName: true,
      quantity: true,
      unitPrice: true,
      totalPrice: true,
      // Fehlende Positionen (E14) gehen beim Storno nicht in den Vorrat zurück.
      fehltSeit: true,
      // Einheit nur für die E-Mail-Anzeige gejoint
      product: { select: { unit: true, unitSize: true } },
    },
  },
} as const

/** Abholbereit melden, abholen, nicht abgeholt: aus diesen Status, sonst „inzwischen geändert". */
const PACKBAR: OrderStatus[] = ['PAID', 'CONFIRMED', 'IN_PREPARATION']
const LAUFEND: OrderStatus[] = ['PAID', 'CONFIRMED', 'IN_PREPARATION', 'READY']

/** Ein Mailfehler kippt keinen Statuswechsel — nur gemeldet, ohne Kundendaten. */
function mailNachDerAntwort(art: string, orderId: string, senden: () => Promise<void>): void {
  nachDerAntwort(async () => {
    try {
      await senden()
    } catch (err) {
      Sentry.captureException(err, { tags: { aktion: 'bestellmail', art }, extra: { orderId } })
    }
  })
}

export async function markAsReady(orderId: string): Promise<ActionResult> {
  const farm = await getAuthFarm()
  if (!farm) return { error: 'Nicht angemeldet' }

  const order = await prisma.order.findFirst({
    where: { id: orderId, farmId: farm.id, status: { in: PACKBAR } },
    select: ORDER_EMAIL_SELECT,
  })
  if (!order) return { error: 'Bestellung nicht gefunden' }

  // Bedingt (S2, ARCHITECTURE §6 Altlast): Ein Storno zwischen Lesen und
  // Schreiben darf nicht überschrieben werden — sonst stünde eine stornierte
  // Bestellung als abholbereit da.
  const { count } = await prisma.order.updateMany({
    where: { id: orderId, farmId: farm.id, status: { in: PACKBAR } },
    data: { status: 'READY' },
  })
  if (count === 0) return { error: BESTELLUNG_INZWISCHEN_GEAENDERT }

  mailNachDerAntwort('abholbereit', orderId, () => sendOrderReady(toEmailOrder(order, farm)))

  revalidatePath('/orders')
  revalidatePath(`/orders/${orderId}`)
  revalidatePath('/dashboard')
  return {}
}

export async function markAsPickedUp(orderId: string): Promise<ActionResult> {
  const farm = await getAuthFarm()
  if (!farm) return { error: 'Nicht angemeldet' }

  // Bedingt statt Lesen und blind Schreiben (S2).
  const { count } = await prisma.order.updateMany({
    where: { id: orderId, farmId: farm.id, status: 'READY' },
    data: { status: 'PICKED_UP', pickedUpAt: new Date() },
  })
  if (count === 0) return { error: BESTELLUNG_INZWISCHEN_GEAENDERT }

  revalidatePath('/orders')
  revalidatePath(`/orders/${orderId}`)
  revalidatePath('/dashboard')
  return {}
}

export async function markAsPickedUpAndPaid(orderId: string): Promise<ActionResult> {
  const farm = await getAuthFarm()
  if (!farm) return { error: 'Nicht angemeldet' }

  const jetzt = new Date()
  // Bedingt statt Lesen und blind Schreiben (S2).
  const { count } = await prisma.order.updateMany({
    where: {
      id: orderId, farmId: farm.id, status: 'READY',
      paymentMethod: { in: ['ONSITE_CASH', 'ONSITE_CARD'] },
    },
    data: {
      status: 'PICKED_UP',
      paymentStatus: 'PAID',
      pickedUpAt: jetzt,
      paidAt: jetzt,
    },
  })
  if (count === 0) return { error: BESTELLUNG_INZWISCHEN_GEAENDERT }

  revalidatePath('/orders')
  revalidatePath(`/orders/${orderId}`)
  revalidatePath('/dashboard')
  return {}
}

// Ein-Schritt-Rückweg (bestellungen-undo): heilt einen Verdrücker bei
// "Fertig melden". Nur aus READY erlaubt. Der Vorzustand wird nicht
// gespeichert — er lässt sich eindeutig herleiten: online bereits bezahlte
// Bestellungen (paymentStatus PAID) standen vor READY auf PAID, alle anderen
// auf CONFIRMED. (IN_PREPARATION geht dabei bewusst auf CONFIRMED zurück —
// ein harmloser Schritt weiter zurück statt einer gespeicherten Historie.)
export async function revertReady(
  orderId: string,
  notifyCustomer: boolean = true
): Promise<ActionResult> {
  const farm = await getAuthFarm()
  if (!farm) return { error: 'Nicht angemeldet' }

  const order = await prisma.order.findFirst({
    where: { id: orderId, farmId: farm.id, status: 'READY' },
    select: ORDER_EMAIL_SELECT,
  })
  if (!order) return { error: BESTELLUNG_INZWISCHEN_GEAENDERT }

  const previous: OrderStatus = order.paymentStatus === 'PAID' ? 'PAID' : 'CONFIRMED'

  // Bedingt geschrieben, nicht nach der Leseprüfung blind: Wird die Bestellung
  // zwischen Lesen und Schreiben storniert, holte ein unbedingtes update sie
  // zurück ins Leben — und ein zweiter Storno buchte den Bestand erneut zurück.
  const { count } = await prisma.order.updateMany({
    where: { id: orderId, farmId: farm.id, status: 'READY' },
    data: { status: previous },
  })
  if (count === 0) return { error: BESTELLUNG_INZWISCHEN_GEAENDERT }

  // Kunden-Info nur auf Wunsch (Haken im Dialog, Standard AN): neutrales
  // "Kurzes Update" — relativiert die bereits verschickte Abholbereit-Mail
  if (notifyCustomer) {
    await sendOrderNotReady(toEmailOrder(order, farm))
  }

  revalidatePath('/orders')
  revalidatePath(`/orders/${orderId}`)
  return {}
}

// Ein-Schritt-Rückweg: heilt einen Verdrücker bei "Abgeholt". Nur aus
// PICKED_UP erlaubt, zurück auf READY, pickedUpAt wird geleert.
// paymentStatus/paidAt bleiben UNANGETASTET: die Geld-Wahrheit (z. B. bar
// kassiert bei "Abgeholt & bezahlt") wird von einem Undo nie verändert —
// bewusste Grenze dieses Rückwegs.
export async function revertPickedUp(orderId: string): Promise<ActionResult> {
  const farm = await getAuthFarm()
  if (!farm) return { error: 'Nicht angemeldet' }

  const exists = await prisma.order.findFirst({
    where: { id: orderId, farmId: farm.id, status: 'PICKED_UP' },
    select: { id: true },
  })
  if (!exists) return { error: BESTELLUNG_INZWISCHEN_GEAENDERT }

  // Bedingt geschrieben — Begründung wie bei revertReady.
  const { count } = await prisma.order.updateMany({
    where: { id: orderId, farmId: farm.id, status: 'PICKED_UP' },
    data: { status: 'READY', pickedUpAt: null },
  })
  if (count === 0) return { error: BESTELLUNG_INZWISCHEN_GEAENDERT }

  // Keine Mail: der Kunde hatte die Abholbereitschafts-Mail bereits

  revalidatePath('/orders')
  revalidatePath(`/orders/${orderId}`)
  return {}
}

export async function revertOrderStatus(orderId: string, previousStatus: string): Promise<ActionResult> {
  const REVERTABLE = ['PAID', 'CONFIRMED', 'IN_PREPARATION', 'READY']
  if (!REVERTABLE.includes(previousStatus)) return { error: 'Status kann nicht zurückgesetzt werden' }

  const farm = await getAuthFarm()
  if (!farm) return { error: 'Nicht angemeldet' }

  // Das Undo im Toast folgt nur auf „Bereit" (→ READY) und „Abgeholt"
  // (→ PICKED_UP) — und darf NUR den Schritt zurück, den der Toast meint:
  // zurück auf READY nur aus PICKED_UP, zurück auf PAID/CONFIRMED/
  // IN_PREPARATION nur aus READY. Vorher gab es hier KEINEN Statusfilter:
  // „Bereit" → Storno → „Rückgängig" holte eine stornierte Bestellung zurück
  // (zweite Rückbuchung beim zweiten Storno), und „Bereit" → „Abgeholt" →
  // „Rückgängig" im ersten Toast machte abgeholte Ware wieder stornierbar.
  const ausStatus = previousStatus === 'READY' ? 'PICKED_UP' : 'READY'

  // Zahlstatus und Zahlzeitpunkt bleiben stimmig (Nr. 19b): Vorher setzte
  // der Rückweg paidAt immer auf null und ließ paymentStatus stehen. Was er
  // an der Zahlung ändert, entscheidet zahlungNachRueckweg — online nie, bar
  // nur das Kassieren genau des zurückgenommenen Schritts.
  const bestellung = await prisma.order.findFirst({
    where: { id: orderId, farmId: farm.id, status: ausStatus },
    select: { paymentMethod: true, paymentStatus: true, paidAt: true, pickedUpAt: true },
  })
  if (!bestellung) return { error: BESTELLUNG_INZWISCHEN_GEAENDERT }
  const zahlung = zahlungNachRueckweg(bestellung, ausStatus)

  // Bedingt auf genau den gelesenen Zahlstand: Erstattet oder kassiert
  // jemand zwischen Lesen und Schreiben, gilt die Entscheidung nicht mehr.
  const { count } = await prisma.order.updateMany({
    where: {
      id: orderId,
      farmId: farm.id,
      status: ausStatus,
      paymentStatus: bestellung.paymentStatus,
      paidAt: bestellung.paidAt,
    },
    data: { status: previousStatus as OrderStatus, pickedUpAt: null, ...(zahlung ?? {}) },
  })
  if (count === 0) return { error: BESTELLUNG_INZWISCHEN_GEAENDERT }

  revalidatePath('/orders')
  revalidatePath(`/orders/${orderId}`)
  return {}
}

export async function cancelOrder(orderId: string, reason?: string): Promise<StornoErgebnis> {
  const eingabe = stornoEingabeSchema.safeParse({ orderId, grund: reason })
  if (!eingabe.success) return { error: eingabe.error.issues[0]?.message ?? 'Ungültige Eingabe.' }

  const farm = await getAuthFarm()
  if (!farm) return { error: 'Nicht angemeldet' }

  return storniere(farm, eingabe.data.orderId, eingabe.data.grund || undefined)
}

/**
 * Welchen Weg die Erstattung eines Stornos nimmt: `voll` (nichts vorher
 * erstattet, reverse_transfer), `rest` (nach einer Teilerstattung, feste
 * Beträge) oder `unbekannt` (Stripe war nicht zu fragen, ob schon erstattet ist).
 */
type ErstattungsPfad = 'voll' | 'rest' | 'unbekannt'

type Handbuchung = { anweisung: string; betraege: Array<{ label: string; cents: number }> }

/**
 * Was der Betreiber von Hand tun muss, wenn die Erstattung eines Stornos
 * scheitert — passend zum Weg, der wirklich genommen wurde. Die Anweisung
 * geht an Sentry und in die Mail an den Betreiber.
 */
function handbuchungFuer(pfad: ErstattungsPfad, rest: RestStorno | null, betraege: StornoBetraege): Handbuchung {
  if (pfad === 'rest' && rest) {
    return {
      anweisung:
        'Teilerstattung, KEINE Vollerstattung: der Kundin den Rest über den Betrag erstatten (ohne reverse_transfer, ohne refund_application_fee) und vom Hof den Betrag per Rückbuchung der Überweisung holen. Vorher in Stripe prüfen, was davon schon gebucht ist.',
      betraege: [
        { label: 'An die Kundin erstatten', cents: rest.erstattungCents },
        { label: 'Vom Hof zurückbuchen', cents: rest.vomHofCents },
      ],
    }
  }
  if (pfad === 'rest') {
    return {
      anweisung:
        'Teilerstattung, KEINE Vollerstattung: Beträge erst aus den Stripe-Buchungen bestimmen – Kundin = bezahlt laut Stripe − alle Teilerstattungen, Hof = Warenpreis der Bestellung − Provision − alle Teil-Rückbuchungen. Buchungen ohne Zuordnung und einen abweichenden bezahlten Betrag vorher klären.',
      betraege: [],
    }
  }
  if (pfad === 'voll') {
    return {
      anweisung: 'Überweisung zurückbuchen und Plattformgebühr erstatten',
      betraege: [
        { label: 'An die Kundin erstatten', cents: betraege.erstattetCents },
        { label: 'Davon vom Hof (über die Rückbuchung der Überweisung)', cents: betraege.vomHofCents },
      ],
    }
  }
  return {
    anweisung:
      'Stand bei Stripe unbekannt: erst prüfen, ob es zu dieser Zahlung schon Erstattungen gibt. Keine → Überweisung zurückbuchen und Plattformgebühr erstatten; sonst Teilerstattung mit festen Beträgen (Rest).',
    betraege: [],
  }
}

/** Was der Betreiber bei „Artikel fehlt" von Hand prüft — je Grund, warum nichts gebucht wurde. */
const HANDPRUEFUNG: Record<UnklarGrund, string> = {
  mehr_als_eine_seite: 'Mehr als 100 Buchungen zu dieser Zahlung – bitte von Hand prüfen',
  ohne_zuordnung: 'Erstattung oder Rückbuchung ohne Zuordnung – bitte von Hand prüfen',
  nachtrag_unklar: 'Eine frühere Erstattung lässt sich nicht nachtragen – bitte von Hand prüfen',
  zu_viele_nachtraege: 'Zu viele Erstattungen ohne Vermerk in der App – bitte von Hand prüfen',
  erstattung_gescheitert: 'Stripe hat die Erstattung als gescheitert zurückgegeben – bitte von Hand prüfen',
  bezahlt_abweichend: 'Bezahlter Betrag laut Stripe weicht von der App ab – bitte von Hand prüfen',
  ohne_ueberweisung: 'Zahlung ohne Überweisung an den Hof – Ladungstyp bei Stripe prüfen',
}

/** Der Stand, aus dem ein Storno rechnet — frisch gelesen, NACHDEM die Sperre steht. */
const STORNO_STAND = {
  totalAmount: true,
  platformFeeAmount: true,
  serviceFeeCents: true,
  erstattetCents: true,
  paymentStatus: true,
  stripePaymentIntentId: true,
  items: { select: { productId: true, quantity: true, totalPrice: true, fehltSeit: true } },
} as const

/**
 * Der Storno des Hofs — für „Stornieren" und für „Artikel fehlt", wenn nichts
 * mehr übrig bliebe (E14: dann ein normaler Storno). Keine Server Action:
 * Aufrufer prüfen Anmeldung und Eingabe selbst.
 */
async function storniere(farm: FarmInfo, orderId: string, reason?: string): Promise<StornoErgebnis> {
  // Nur LESEN — die Daten für die Mail. Die Entscheidung, ob storniert werden
  // darf, fällt NICHT hier: eine Leseprüfung lassen zwei gleichzeitige Aufrufe
  // (Doppeltipp) beide passieren.
  const order = await prisma.order.findFirst({
    where: { id: orderId, farmId: farm.id },
    select: ORDER_EMAIL_SELECT,
  })
  if (!order) return { error: 'Bestellung nicht gefunden' }

  // Der bedingte Statuswechsel IST die Sperre: updateMany mit Statusbedingung
  // gewinnt genau einmal, der zweite Aufruf trifft count 0 und bucht nichts
  // zurück. Rückbuchung in DERSELBEN Transaktion wie der Statuswechsel —
  // ganz oder gar nicht. (Die Transaktion ist dem Stripe-Webhook entlehnt;
  // die Sperre geht darüber hinaus — der Webhook prüft nur lesend.)
  //
  // NOT_PICKED_UP ist ebenfalls gesperrt: Bei „nicht abgeholt" bleibt der
  // Warenpreis beim Hof (markAsNotPickedUp); ein Storno danach erstattete ihn
  // voll und buchte Ware zurück, die nie zurückkam. Die Oberfläche bietet es
  // dort schon nicht an — der Server muss es genauso sehen.
  const storno = await prisma.$transaction(async (tx) => {
    const { count } = await tx.order.updateMany({
      where: {
        id: orderId,
        farmId: farm.id,
        status: { notIn: ['CANCELLED', 'PICKED_UP', 'NOT_PICKED_UP'] },
      },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: reason ?? null,
        // Der Vermerk hängt am Stand VOR der Sperre — unbedenklich: „Artikel
        // fehlt" senkt eine Gebühr nie auf 0 (Mindestgebühr), und
        // serviceFeeRefundedAt setzen nur Status-gesperrte Wege.
        // Servicegebühr entfällt auch bei Storno: online steckt sie in der vollen
        // Erstattung unten (Stripe erstattet den ganzen Zahlungsbetrag), bar wurde
        // sie nie kassiert. Der Vermerk hält den Snapshot ehrlich — Admin-Spalte
        // „entfallen" heute, Monatsabrechnung (Sprint 3) später.
        ...(order.serviceFeeCents > 0 && !order.serviceFeeRefundedAt
          ? { serviceFeeRefundedAt: new Date() }
          : {}),
      },
    })
    if (count === 0) return null

    // Beträge und Positionen FRISCH, unter der Zeilensperre des Statuswechsels:
    // Hat „Artikel fehlt" (src/server/artikel-fehlt.ts) kurz davor Warenpreis,
    // Gebühr und Erstattung geändert, rechnet der Storno mit dem neuen Stand —
    // nie mit dem Stand vor dem Warten auf die Sperre.
    const stand = await tx.order.findFirst({ where: { id: orderId }, select: STORNO_STAND })
    if (!stand) throw new Error('Storno: Bestellung nach der Sperre nicht lesbar')

    // Fehlende Artikel (E14) gehen nicht zurück in den Vorrat — sie waren nie da.
    for (const item of stand.items) {
      if (item.fehltSeit) continue
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      })
    }
    return stand
  })

  if (!storno) return { error: 'Diese Bestellung ist schon storniert oder abgeholt.' }

  // Dieselbe Rechnung wie im Storno-Dialog (src/lib/storno.ts) — aus dem Stand
  // unter der Sperre. Nur online bezahlt gibt es Beträge, sonst null.
  const betraege = stornoBetraege({
    stripePaymentIntentId: storno.stripePaymentIntentId,
    paymentStatus: storno.paymentStatus,
    warenpreisCents: alsCents(storno.totalAmount),
    provisionCents: alsCents(storno.platformFeeAmount),
    serviceFeeCents: storno.serviceFeeCents,
  })
  const teilweiseErstattet = nachTeilerstattung({
    erstattetCents: storno.erstattetCents ?? 0,
    fehlendePositionen: storno.items.filter((i) => i.fehltSeit).length,
  })

  // Erstattung erst NACH der Transaktion. Scheitert Stripe, bleibt die
  // Bestellung storniert und die Ware zurückgebucht — das ist der richtige
  // Zustand, nur das Geld steht noch aus. paymentStatus bleibt dann PAID:
  // das Enum kennt kein „Erstattung ausstehend" (Vorschlag: REFUND_PENDING,
  // nicht eigenmächtig angelegt — Schema-Änderung nur mit Freigabe).
  let refundAmount: number | null = null
  let erstattungOffen = false
  let festeBetraege: RestStorno | null = null
  // Für die Handbuchung, falls Stripe scheitert: welcher Weg genommen wurde
  // und mit welchen Beträgen. Nach einer Teilerstattung wäre eine
  // Vollerstattung von Hand falsch (Stripe kehrte Überweisung und Gebühr
  // anteilig um, der Hof gäbe nicht genau seinen Warenpreis zurück).
  let pfad: ErstattungsPfad = teilweiseErstattet ? 'rest' : 'unbekannt'
  let rest: RestStorno | null = null
  let handbuchungOffen: Handbuchung | null = null
  if (storno.stripePaymentIntentId && betraege) {
    const pi = storno.stripePaymentIntentId
    try {
      // Nach „Artikel fehlt" — oder wenn Stripe schon Erstattungen kennt, die
      // die Datenbank nicht hat (verlorene Antwort): den Rest mit festen
      // Beträgen aus dem, was Stripe gebucht hat (restNachTeilerstattung).
      // Die Vollerstattung mit reverse_transfer stimmt nur, solange noch
      // nichts erstattet ist.
      if (!teilweiseErstattet) pfad = (await hatErstattungen(pi)) ? 'rest' : 'voll'
      if (pfad === 'rest') {
        const stand = await ladeStripeStand(pi, order.id)
        const bezahltDatenbankCents = alsCents(storno.totalAmount) + storno.serviceFeeCents + (storno.erstattetCents ?? 0)
        rest = restNachTeilerstattung({
          bezahltStripeCents: stand.bezahltCents,
          bezahltDatenbankCents,
          warenOriginalCents: storno.items.reduce((summe, i) => summe + alsCents(i.totalPrice), 0),
          provisionCents: alsCents(storno.platformFeeAmount),
          teilErstattetCents: teilstornoSumme(stand.erstattungen),
          teilZurueckgebuchtCents: teilstornoSumme(stand.rueckbuchungen),
        })
        if (!rest) {
          // Im Zweifel nichts buchen: Stripe und Datenbank sind sich über den
          // bezahlten Betrag nicht einig — die Kundin bekäme still zu wenig
          // oder zu viel. Der Betreiber erstattet von Hand.
          throw new StripeStandUnklar('bezahlt_abweichend', {
            orderId: order.id,
            bezahltStripeCents: stand.bezahltCents ?? 'unbekannt',
            bezahltDatenbankCents,
          })
        }
        const { erstattungCents, vomHofCents } = rest
        const erstattet =
          erstattungCents > 0
            ? (
                await erstatteKundin(stand, {
                  paymentIntentId: pi,
                  orderId: order.id,
                  anlass: 'reststorno',
                  positionId: null,
                  betragCents: erstattungCents,
                  schluessel: `storno-${order.id}`,
                })
              ).erstattetCents
            : 0
        await bucheVomHofZurueck(stand, {
          orderId: order.id,
          anlass: 'reststorno',
          positionId: null,
          betragCents: vomHofCents,
          schluessel: `storno-hof-${order.id}`,
          onFehler: (err) => {
            Sentry.captureException(err, {
              tags: { aktion: 'cancelOrder', grund: 'rueckbuchung_offen' },
              extra: { orderId, vomHofCents, handbuchung: 'Überweisung mit diesem Betrag zurückbuchen' },
            })
          },
        })
        refundAmount = erstattet / 100
        festeBetraege = { erstattungCents: erstattet, vomHofCents }
        try {
          // Alles, was Stripe erstattet hat — auch eine Teilerstattung, deren
          // Antwort damals verloren ging.
          await prisma.order.updateMany({
            where: { id: orderId, status: 'CANCELLED' },
            data: { erstattetCents: teilstornoSumme(stand.erstattungen) + erstattet },
          })
        } catch (err) {
          Sentry.captureException(err, {
            tags: { aktion: 'cancelOrder', grund: 'erstattet_vermerk_fehlgeschlagen' },
            extra: { orderId },
          })
        }
      } else {
        // Läuft NACH der Transaktion, nicht in einer Sperre — deshalb ohne die
        // kurzen STRIPE_OPTIONEN (die SDK-Wiederholung ist hier erwünscht,
        // der Schlüssel verhindert eine zweite Erstattung).
        const refund = await stripe.refunds.create(
          {
            payment_intent: pi,
            // LADUNGSTYP destination charge mit application_fee_amount
            // (/api/checkout): Der Hof bekam den VOLLEN Betrag überwiesen und gab
            // Provision + Servicegebühr als application_fee an die Plattform ab.
            // reverse_transfer holt die ganze Überweisung vom Hof zurück,
            // refund_application_fee gibt ihm die ganze Gebühr zurück — zusammen
            // gibt der Hof genau seinen Warenpreis zurück, und die Servicegebühr
            // erstattet die Plattform aus der einbehaltenen Gebühr. Ohne
            // reverse_transfer zahlte die Plattform die ganze Erstattung aus
            // ihrem Saldo; ohne refund_application_fee zahlte der Hof die
            // Servicegebühr mit. Anders die Gebühren-Teilerstattung in
            // lasseServicegebuehrEntfallen: dort bewusst ohne beides.
            reverse_transfer: true,
            // Wie im Checkout: eine application_fee gibt es nur bei Gebühr > 0.
            ...(plattformgebuehrCents(betraege) > 0 ? { refund_application_fee: true } : {}),
            // Merkmale wie bei der Teilerstattung (Nr. 27): Scheitert die
            // Erstattung später, erkennt der Webhook sie als unsere Buchung
            // und öffnet die Zahlung wieder (src/server/erstattung-gescheitert.ts).
            metadata: vollstornoMerkmal(order.id),
          },
          // Idempotenz: Erreicht ein zweiter Storno Stripe (Vermerk gescheitert
          // und Bestellung wieder geöffnet), liefert Stripe dieselbe Erstattung
          // statt einer zweiten.
          { idempotencyKey: `storno-${order.id}` }
        )
        // Wie bei der Teilerstattung (erstatteKundin): Eine gescheiterte oder
        // abgebrochene Erstattung hat kein Geld bewegt — nie REFUNDED
        // vermerken und der Kundin keine Erstattung zusagen.
        if (!erstattungZaehlt(refund.status)) {
          throw new StripeStandUnklar('erstattung_gescheitert', { orderId: order.id, status: refund.status ?? 'unbekannt' })
        }
        refundAmount = refund.amount / 100
      }
    } catch (err) {
      console.error('[cancelOrder] Stripe refund failed:', err)
      // Offenes Geld darf nicht nur im Log stehen: Die Bestellung ist
      // storniert, ein zweiter Anlauf in der App ist durch die Sperre
      // ausgeschlossen — erstatten kann nur der Betreiber über das
      // Plattformkonto (Destination Charge). Die Anweisung folgt dem Weg, der
      // wirklich genommen wurde, mit den Beträgen aus `rest`. Nur die
      // Bestell-ID, keine Kundendaten (sentry-hygiene.ts filtert zusätzlich).
      handbuchungOffen = handbuchungFuer(pfad, rest, betraege)
      Sentry.captureException(err, {
        tags: { aktion: 'cancelOrder', grund: err instanceof StripeStandUnklar ? `stripe_unklar_${err.grund}` : 'erstattung_offen' },
        extra: {
          ...(err instanceof StripeStandUnklar ? err.extra : {}),
          orderId,
          handerstattung: handbuchungOffen.anweisung,
          ...(rest ? { erstattungCents: rest.erstattungCents, vomHofCents: rest.vomHofCents } : {}),
        },
      })
      erstattungOffen = true
    }

    // Der Vermerk getrennt von der Erstattung: Scheitert NUR er, ist das
    // Geld trotzdem zurück — dann Erfolg an den Hof und Mail mit Betrag,
    // nur paymentStatus steht falsch auf PAID. Das bekommt der Betreiber
    // über Sentry zu sehen, nicht der Hof als „Erstattung fehlgeschlagen".
    if (refundAmount !== null) {
      try {
        await prisma.order.update({
          where: { id: orderId },
          data: { paymentStatus: 'REFUNDED' },
        })
      } catch (err) {
        Sentry.captureException(err, {
          tags: { aktion: 'cancelOrder', grund: 'vermerk_fehlgeschlagen' },
          extra: { orderId },
        })
      }
    }
  }

  // Nichts Langsames im Antwortpfad, und ein Mailfehler kippt keine gültige
  // Stornierung. Bei OFFENER Erstattung keine Mail: Die Vorlage liest „keine
  // Erstattung" als Vor-Ort-Zahlung und schriebe „Da du vor Ort bezahlst,
  // entstehen dir keine Kosten" — an eine Kundin, die online bezahlt hat und
  // noch nichts zurückbekam. Wie vor diesem Fix: gescheiterte Erstattung →
  // keine Storno-Mail; der Betreiber meldet sich mit der Erstattung.
  if (!erstattungOffen) {
    nachDerAntwort(async () => {
      // Frisch gelesen: Hat „Artikel fehlt" kurz vor dem Storno Beträge
      // geändert, zeigt die Mail den Stand, aus dem storniert wurde.
      const fuerMail =
        (await prisma.order.findFirst({ where: { id: orderId, farmId: farm.id }, select: ORDER_EMAIL_SELECT })) ?? order
      await sendOrderCancelled(toEmailOrder(fuerMail, farm), refundAmount, reason)
    })
  }

  // Offenes Geld meldet sich auch beim Betreiber per Mail — der Hof kann
  // nicht erstatten (kein Zugang zum Plattformkonto). Nach der Antwort; ein
  // Mailfehler rollt nichts zurück. Ohne Daten der Kundin.
  if (handbuchungOffen) {
    const hand = handbuchungOffen
    mailNachDerAntwort('erstattung_offen', orderId, () =>
      sendErstattungOffen({
        was: 'Der Hof hat die Bestellung storniert, die Erstattung über Stripe hat aber nicht geklappt. Die Bestellung ist storniert, das Geld steht noch aus.',
        bestellId: orderId,
        bestellnummer: order.orderNumber,
        hofName: farm.name,
        betraege: hand.betraege,
        handanweisung: hand.anweisung,
        stripeKennung: null,
      })
    )
  }

  revalidatePath('/orders')
  revalidatePath(`/orders/${orderId}`)
  revalidatePath('/dashboard')
  if (erstattungOffen) {
    return {
      // Der Hof hat keinen Zugang zum Plattformkonto — erstatten kann nur der
      // Betreiber, und der bekommt die Meldung (Sentry + Mail oben).
      error: 'Rückerstattung fehlgeschlagen. Wir kümmern uns um die Erstattung und melden uns.',
      erstattungOffen: true,
    }
  }
  // Vor Ort bezahlt (oder online nie bezahlt): nichts erstattet, nichts vom Hof abgezogen.
  if (festeBetraege) return { erstattetCents: festeBetraege.erstattungCents, vomHofCents: festeBetraege.vomHofCents }
  return betraege && refundAmount !== null
    ? { erstattetCents: betraege.erstattetCents, vomHofCents: betraege.vomHofCents }
    : { erstattetCents: 0, vomHofCents: 0 }
}

/**
 * „Artikel fehlt" (E14, Nachtlauf Nr. 19): Der Hof meldet EINE Position als
 * fehlend. Rechnung in src/lib/artikel-fehlt.ts, Sperre, Stripe und Schreiben
 * in src/server/artikel-fehlt.ts (dort steht, warum Stripe innerhalb der
 * Sperre läuft). Fehlt danach nichts mehr zum Übergeben, ist es ein normaler
 * Storno. Die Kundin bekommt sofort eine Mail mit dem neuen Betrag — nach der
 * Antwort; ein Mailfehler rollt nichts zurück.
 */
export async function meldeArtikelFehlt(input: unknown): Promise<ArtikelFehltErgebnis> {
  const eingabe = artikelFehltEingabeSchema.safeParse(input)
  if (!eingabe.success) return { error: 'Ungültige Eingabe.' }
  const { orderId, itemId } = eingabe.data

  const farm = await getAuthFarm()
  if (!farm) return { error: 'Nicht angemeldet' }

  let ausgang: Awaited<ReturnType<typeof meldeFehlendenArtikel>>
  try {
    ausgang = await meldeFehlendenArtikel({ farmId: farm.id, orderId, itemId, jetzt: new Date() })
  } catch (err) {
    if (err instanceof StripeStandUnklar) {
      // Im Zweifel nicht buchen: Bei Stripe gibt es etwas, das wir keiner
      // Position zuordnen können (von Hand erstattet, mehr als eine Seite,
      // gescheiterte Erstattung …). Nichts ist geschrieben; der Betreiber
      // prüft von Hand.
      Sentry.captureException(err, {
        tags: { aktion: 'artikelFehlt', grund: `stripe_unklar_${err.grund}` },
        extra: { orderId, itemId, ...err.extra, handpruefung: HANDPRUEFUNG[err.grund] },
      })
      return {
        error: 'Bei der Zahlung dieser Bestellung gibt es etwas, das wir erst prüfen müssen. Wir haben nichts gebucht – bitte melde dich bei uns.',
      }
    }
    // Stripe hat nicht bestätigt, oder das Schreiben danach ist gescheitert:
    // Die Transaktion ist zurückgerollt. Hat Stripe trotzdem schon erstattet
    // (Antwort verloren), findet der nächste Versuch die Erstattung über ihre
    // Merkmale und trägt sie nach (src/server/teilerstattung.ts) — doppelt
    // erstattet wird nie. Deshalb sagt der Text nicht „nichts erstattet".
    Sentry.captureException(err, {
      tags: { aktion: 'artikelFehlt', grund: 'nicht_gespeichert' },
      extra: { orderId, itemId },
    })
    return {
      error: 'Wir konnten die Änderung nicht speichern. Versuch es bitte gleich noch einmal – es wird nichts doppelt erstattet.',
    }
  }

  if (ausgang.art === 'abgelehnt') {
    const text: Record<typeof ausgang.grund, string> = {
      nicht_gefunden: 'Bestellung nicht gefunden',
      position_unbekannt: 'Diesen Artikel gibt es in der Bestellung nicht.',
      schon_fehlend: 'Dieser Artikel ist schon als fehlend gespeichert.',
      status: 'Diese Bestellung ist schon abgeholt, storniert oder noch nicht bestätigt.',
      nicht_bezahlt: 'Diese Bestellung ist noch nicht bezahlt. Storniere sie, wenn etwas fehlt.',
    }
    return { error: text[ausgang.grund] }
  }

  if (ausgang.art === 'storno') {
    const storno = await storniere(farm, orderId, 'Die bestellte Ware fehlt leider.')
    return { ...storno, storniert: !storno.error || storno.erstattungOffen === true }
  }

  const { rechnung } = ausgang
  // Daten für die Mail erst NACH dem Schreiben gelesen: Mail und Datenbank
  // zeigen denselben Stand.
  const fuerMail = await prisma.order.findFirst({ where: { id: orderId, farmId: farm.id }, select: ORDER_EMAIL_SELECT })
  const position = fuerMail?.items.find((i) => i.id === itemId)
  if (fuerMail && position) {
    mailNachDerAntwort('artikel_fehlt', orderId, () =>
      sendArtikelFehlt(toEmailOrder(fuerMail, farm), {
        position: {
          productName: position.productName,
          quantity: position.quantity,
          unitPrice: position.unitPrice,
          totalPrice: position.totalPrice,
          product: position.product ?? null,
        },
        zahlung: rechnung.zahlung,
        bisherCents: rechnung.bisherWarenCents + rechnung.bisherGebuehrCents,
        neuCents: rechnung.neuGesamtCents,
        erstattetCents: rechnung.zahlung === 'online' ? ausgang.erstattetCents : null,
      })
    )
  }

  revalidatePath('/orders')
  revalidatePath(`/orders/${orderId}`)
  revalidatePath('/dashboard')
  return {
    erstattetCents: ausgang.erstattetCents,
    vomHofCents: rechnung.vomHofCents,
    neuGesamtCents: rechnung.neuGesamtCents,
  }
}

/**
 * „Nicht abgeholt" (Sprint servicegebuehr, Teil D). Der Status NOT_PICKED_UP
 * existiert seit dem ersten Schema (Enum, Beschriftung, Filter), wurde aber von
 * keinem Codepfad gesetzt (bestellstatus.ts:17–19) — dies ist der erste.
 * Erlaubt aus jedem laufenden Status außer der offenen Kunden-Bestätigung:
 * PAID, CONFIRMED, IN_PREPARATION, READY. Kein Rückweg: Eine Erstattung lässt
 * sich nicht zurücknehmen, deshalb fragt die Oberfläche vorher.
 *
 * WARENPREIS: bleibt exakt wie bisher — und bisher gab es bei Nichtabholung
 * keinerlei Geldbewegung: keine Erstattung (online bleibt der Warenpreis beim
 * Hof, paymentStatus bleibt PAID), keine Bestandsrückbuchung, keine Mail.
 * Dieser Sprint ändert NUR die Gebühr.
 *
 * GEBÜHR: Nicht abgeholte Bestellungen kosten keine Gebühr.
 *   bar    → als entfallen vermerkt (serviceFeeRefundedAt), damit die spätere
 *            Monatsabrechnung sie nicht einzieht.
 *   online → Teilerstattung in Höhe der Gebühr über Stripe, danach der Vermerk.
 *            Ein Fehler beim Erstatten blockiert den Statuswechsel NICHT: Der
 *            Status ist dann gesetzt, die Erstattung steht aus — sichtbar im
 *            Bauern-Bereich (gebuehrErstattungOffen) und im Log.
 */
export async function markAsNotPickedUp(
  orderId: string
): Promise<ActionResult & { gebuehrErstattungOffen?: boolean }> {
  const farm = await getAuthFarm()
  if (!farm) return { error: 'Nicht angemeldet' }

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      farmId: farm.id,
      status: { in: ['PAID', 'CONFIRMED', 'IN_PREPARATION', 'READY'] },
    },
    select: {
      id: true,
      paymentMethod: true,
      paymentStatus: true,
      stripePaymentIntentId: true,
      serviceFeeCents: true,
      serviceFeeRefundedAt: true,
    },
  })
  if (!order) return { error: 'Bestellung nicht gefunden' }

  // 1. Der Statuswechsel ZUERST und für sich — er darf an nichts hängen, was
  //    danach kommt (Stripe, Netz). Bedingt (S2): Wer zwischen Lesen und
  //    Schreiben storniert, gewinnt — sonst erstattete der Schritt danach die
  //    Gebühr einer schon voll erstatteten Bestellung ein zweites Mal.
  const { count } = await prisma.order.updateMany({
    where: { id: orderId, farmId: farm.id, status: { in: LAUFEND } },
    data: { status: 'NOT_PICKED_UP' },
  })
  if (count === 0) return { error: BESTELLUNG_INZWISCHEN_GEAENDERT }

  // 2. Die Gebühr entfällt.
  const gebuehr = await lasseServicegebuehrEntfallen(order)

  revalidatePath('/orders')
  revalidatePath(`/orders/${orderId}`)
  revalidatePath('/dashboard')
  return gebuehr.offen ? { gebuehrErstattungOffen: true } : {}
}

async function lasseServicegebuehrEntfallen(order: {
  id: string
  paymentMethod: string
  paymentStatus: string
  stripePaymentIntentId: string | null
  serviceFeeCents: number
  serviceFeeRefundedAt: Date | null
}): Promise<{ offen: boolean }> {
  // Ohne Gebühr oder bereits entfallen: nichts zu tun (auch bei Wiederholung).
  if (order.serviceFeeCents <= 0 || order.serviceFeeRefundedAt) return { offen: false }

  // Online UND bezahlt: Teilerstattung in Höhe der Gebühr.
  if (order.paymentMethod === 'ONLINE' && order.paymentStatus === 'PAID' && order.stripePaymentIntentId) {
    try {
      await stripe.refunds.create(
        {
          payment_intent: order.stripePaymentIntentId,
          amount: order.serviceFeeCents,
          // LADUNGSTYP destination charge (/api/checkout): Die Erstattung wird
          // vom PLATTFORM-Saldo abgebucht — genau dort liegt die einbehaltene
          // Gebühr. Deshalb bewusst OHNE reverse_transfer (würde anteilig vom
          // Hof zurückholen, der behält 100 % Warenpreis) und OHNE
          // refund_application_fee (das gäbe einen Anteil der Application Fee
          // an den HOF zurück, nicht an die Kundin — der Hof bekäme mehr als
          // den Warenpreis). Die Kundin bekommt die Gebühr, sonst bewegt sich
          // nichts.
          metadata: { orderId: order.id, grund: 'servicegebuehr_nicht_abgeholt' },
        },
        // Idempotenz: Gelingt die Erstattung, scheitert aber das Vermerken,
        // liefert ein zweiter Anlauf DIESELBE Erstattung statt einer zweiten.
        { idempotencyKey: `servicegebuehr-nicht-abgeholt-${order.id}` }
      )
    } catch (err) {
      console.error(
        `[markAsNotPickedUp] Servicegebühr-Erstattung fehlgeschlagen (Bestellung ${order.id}):`,
        err instanceof Error ? err.message : err
      )
      return { offen: true }
    }
  }

  // Bar (oder online nie bezahlt): nichts zu erstatten — nur als entfallen vermerken.
  await prisma.order.update({
    where: { id: order.id },
    data: { serviceFeeRefundedAt: new Date() },
  })
  return { offen: false }
}
