'use server'

import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { stelleEinOhneRisiko, stelleMailEinInTransaktion, type EinstellErgebnis } from '@/server/mail-warteschlange'
import { artikelFehltMailAuftrag, bestellMailAuftrag, verwirfOffenenAbholbereitAuftrag } from '@/server/mail-arten/bestellung'
import * as Sentry from '@sentry/nextjs'
import type { OrderStatus } from '@prisma/client'
import { zahlungNachRueckweg } from '@/lib/hof-bestellungen'
import { artikelFehltEingabeSchema, stornoEingabeSchema } from '@/schemas/hof-bestellungen'
import { meldeFehlendenArtikel } from '@/server/artikel-fehlt'
import { StripeStandUnklar, type UnklarGrund } from '@/server/teilerstattung'
// Die innere Storno-Funktion liegt ohne 'use server' daneben (Nr. 186): Hof und Team (Notfall-Storno) nutzen dieselbe.
import { storniere, type StornoErgebnis } from '@/server/stornieren'

export type ActionResult = { error?: string }

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

// Scheitert der Statuswechsel selbst, ist nichts gespeichert und der Hof
// tippt einfach noch einmal. Ein Mail-Auftrag kippt ihn nie (Nr. 168).
const STATUS_NICHT_GESPEICHERT = 'Wir konnten die Änderung nicht speichern. Versuch es bitte gleich noch einmal.'

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

/*
 * Stripe kommt erst im Aufruf per `await import()` (Nachtlauf Nr. 31,
 * ARCHITECTURE §4): Diese Actions binden die Bestellseiten ein, und ein
 * statischer Import legte das Stripe-SDK in jeden Kaltstart von /orders.
 * Mails verschickt hier keine Action mehr selbst: Sie stellen einen Auftrag
 * in die Warteschlange (Register N26, Nr. 159), der Worker verschickt.
 */

/** Eine Bestell-Kennung an der Grenze (Nr. 178): dieselbe Form wie bei Storno und „Artikel fehlt". */
const bestellKennungSchema = stornoEingabeSchema.shape.orderId

/**
 * Nach einem Rückweg aus „Gepackt“: der noch offene Auftrag `abholbereit` fällt
 * weg (Audit A4). Nachlauf — scheitert er, gilt der Rückweg trotzdem (der
 * Renderer prüft vor dem Senden ohnehin `READY`); Sentry bekommt nur die Kennung.
 */
async function verwerfeAbholbereitOhneRisiko(orderId: string): Promise<void> {
  try {
    await verwirfOffenenAbholbereitAuftrag(orderId)
  } catch (err) {
    Sentry.captureException(err, { tags: { aktion: 'abholbereit-verwerfen' }, extra: { orderId } })
  }
}

export async function markAsReady(orderId: string): Promise<ActionResult> {
  if (!bestellKennungSchema.safeParse(orderId).success) return { error: 'Bestellung nicht gefunden' }
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
  // Statuswechsel und Mail-Auftrag in EINER Transaktion; der Auftrag hält den
  // Wechsel nie auf (Register N26, Ergänzung 25.10.2026) — scheitert er, wird
  // er nach dem Commit nachgeholt. Abholbereit kann sich wiederholen (zurück
  // und wieder bereit): der Zeitpunkt macht den Schlüssel eindeutig, darum
  // wird das Objekt EINMAL gebaut, vor der Transaktion; geprüft wird es rein,
  // vor dem Schreiben (ungültig fällt weg, einmal gemeldet).
  const auftrag = bestellMailAuftrag('abholbereit', { id: orderId, farmId: farm.id }, new Date())
  let count: number
  let mail: EinstellErgebnis | null = null
  try {
    count = await prisma.$transaction(async (tx) => {
      const { count: geaendert } = await tx.order.updateMany({
        where: { id: orderId, farmId: farm.id, status: { in: PACKBAR } },
        data: { status: 'READY' },
      })
      if (geaendert > 0) mail = await stelleMailEinInTransaktion([auftrag], tx)
      return geaendert
    })
  } catch (err) {
    Sentry.captureException(err, { tags: { aktion: 'markAsReady' }, extra: { orderId } })
    return { error: STATUS_NICHT_GESPEICHERT }
  }
  if (mail === 'nachholen') await stelleEinOhneRisiko('abholbereit', orderId, auftrag)
  if (count === 0) return { error: BESTELLUNG_INZWISCHEN_GEAENDERT }

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
  // Kunden-Info nur auf Wunsch (Haken im Dialog, Standard AN): neutrales
  // "Kurzes Update" — relativiert die bereits verschickte Abholbereit-Mail.
  // Der Auftrag in derselben Transaktion wie der Rückweg (Nr. 159); er hält
  // den Rückweg nie auf (Register N26, Ergänzung 25.10.2026) — scheitert er,
  // wird er nach dem Commit mit demselben Objekt nachgeholt (der Zeitpunkt
  // steckt im Schlüssel). Verschickt wird nach der Antwort.
  const auftrag = notifyCustomer ? bestellMailAuftrag('nicht-abholbereit', { id: orderId, farmId: farm.id }, new Date()) : null
  let count: number
  let mail: EinstellErgebnis | null = null
  try {
    count = await prisma.$transaction(async (tx) => {
      const { count: geaendert } = await tx.order.updateMany({
        where: { id: orderId, farmId: farm.id, status: 'READY' },
        data: { status: previous },
      })
      if (geaendert > 0 && auftrag) mail = await stelleMailEinInTransaktion([auftrag], tx)
      return geaendert
    })
  } catch (err) {
    Sentry.captureException(err, { tags: { aktion: 'revertReady' }, extra: { orderId } })
    return { error: STATUS_NICHT_GESPEICHERT }
  }
  if (mail === 'nachholen' && auftrag) await stelleEinOhneRisiko('nicht-abholbereit', orderId, auftrag)
  if (count === 0) return { error: BESTELLUNG_INZWISCHEN_GEAENDERT }
  await verwerfeAbholbereitOhneRisiko(orderId)

  revalidatePath('/orders')
  revalidatePath(`/orders/${orderId}`)
  return {}
}

// Ein-Schritt-Rückweg (Dialog „Abholung rückgängig"): heilt einen Verdrücker
// bei "Abgeholt". Nur aus PICKED_UP erlaubt, zurück auf READY, pickedUpAt wird
// geleert. Die Zahlung behandelt er wie das Rückgängig im Hinweis
// (revertOrderStatus, Nr. 19b): Vorher blieben paymentStatus/paidAt immer
// stehen — eine bar kassierte Bestellung stand danach „gepackt, bezahlt",
// obwohl das Kassieren zu genau dem zurückgenommenen Schritt gehörte (Nr. 32).
// Was sich an der Zahlung ändert, entscheidet allein zahlungNachRueckweg —
// online nie (das Geld liegt bei Stripe; hier kein Stripe-Aufruf, keine
// Erstattung), bar nur das Kassieren genau dieses Schritts.
export async function revertPickedUp(orderId: string): Promise<ActionResult> {
  const farm = await getAuthFarm()
  if (!farm) return { error: 'Nicht angemeldet' }

  const bestellung = await prisma.order.findFirst({
    where: { id: orderId, farmId: farm.id, status: 'PICKED_UP' },
    select: { paymentMethod: true, paymentStatus: true, paidAt: true, pickedUpAt: true },
  })
  if (!bestellung) return { error: BESTELLUNG_INZWISCHEN_GEAENDERT }
  const zahlung = zahlungNachRueckweg(bestellung, 'PICKED_UP')

  // Bedingt auf Besitz, Ausgangsstatus und genau den gelesenen Zahlstand:
  // Storniert, erstattet oder kassiert jemand zwischen Lesen und Schreiben,
  // gilt die Entscheidung nicht mehr (Begründung wie bei revertReady).
  const { count } = await prisma.order.updateMany({
    where: {
      id: orderId,
      farmId: farm.id,
      status: 'PICKED_UP',
      paymentStatus: bestellung.paymentStatus,
      paidAt: bestellung.paidAt,
    },
    data: { status: 'READY', pickedUpAt: null, ...(zahlung ?? {}) },
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
  // „Rückgängig“ nach „Gepackt“: die Abholbereit-Mail, die noch wartet, geht nicht mehr hinaus (A4).
  if (ausStatus === 'READY') await verwerfeAbholbereitOhneRisiko(orderId)

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
  // Der Auftrag trägt die Beträge der Rechnung beim Speichern — nie neu
  // gerechnet; Bestellung und Position lädt der Renderer nach dem Schreiben
  // frisch, Mail und Datenbank zeigen denselben Stand.
  await stelleEinOhneRisiko('artikel-fehlt', orderId, async () =>
    artikelFehltMailAuftrag(
      { id: orderId, farmId: farm.id },
      {
        itemId,
        bisherCents: rechnung.bisherWarenCents + rechnung.bisherGebuehrCents,
        neuCents: rechnung.neuGesamtCents,
        erstattetCents: rechnung.zahlung === 'online' ? ausgang.erstattetCents : null,
      }
    )
  )

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
      const { stripe } = await import('@/lib/stripe')
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
