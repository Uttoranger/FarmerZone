import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import * as Sentry from '@sentry/nextjs'
import type { Prisma } from '@prisma/client'
import { enforceRateLimit } from '@/lib/rate-limit'
import { SHOP_PAUSED_MESSAGE } from '@/lib/shop-pause'
import { FARM_ARCHIVED_MESSAGE } from '@/lib/farm-archive'
import { FARM_NOT_APPROVED_MESSAGE } from '@/lib/farm-approval'
import { nanoid } from 'nanoid'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { sendOnsiteConfirmation } from '@/lib/email'
import { checkoutRequestSchema } from '@/schemas/checkout'
import {
  calcLineTotal,
  calcTotalAmount,
  calcPlatformFeeAmount,
  decimalZuCents,
  preisAbweichungen,
} from '@/lib/order-totals'
import { berechneServicegebuehr } from '@/lib/servicegebuehr'
import { pruefeSitzungsWarenkorb } from '@/server/warenkorb'
import { CODE_RESERVIERUNG_ABGELAUFEN } from '@/lib/reservierung'
import { nachDerAntwort } from '@/lib/nach-der-antwort'
import { bestellPositionsName } from '@/lib/eingabegrenzen'
import { fristVon } from '@/lib/fristen'
import { gibVerwaisteFreiOhneRisiko } from '@/server/verwaiste-bestellungen'
import { bestaetigungsPfad } from '@/lib/bestell-link'
import { AbholfensterVoll, imAbholfenster, pruefeAbholfenster } from '@/server/abholfenster'
import { ABHOLFENSTER_NICHT_VERFUEGBAR, CODE_ABHOLFENSTER_VOLL } from '@/lib/abholfenster'
import { storniereUnbezahlteBestellung } from '@/server/unbezahlte-bestellung'
import { CODE_ZAHLUNG_NICHT_MOEGLICH, zahlungNichtMoeglichText } from '@/lib/stripe-konto'
import { CODE_ZAHLART_NICHT_ANGEBOTEN, ZAHLART_NICHT_ANGEBOTEN, zahlartFuerNeueBestellung } from '@/lib/kasse'
import {
  pruefeBetriebsnachweis,
  betriebsnummerFuerBestellung,
  CODE_BETRIEBSNACHWEIS_FEHLT,
} from '@/lib/betriebsnachweis'

/**
 * Bestellung anlegen.
 *
 * DREI DINGE, die dieser Weg seit dem Bug-Report anders macht:
 *
 * 1. IDEMPOTENZ (Befund 4). Der Browser erzeugt beim Öffnen des Checkouts
 *    einen Schlüssel. Kommt derselbe Schlüssel zweimal — Doppelklick,
 *    Zurück-Taste, erneut gesendetes Formular, wackeliges Netz —, gibt der
 *    Server die BESTEHENDE Bestellung zurück. Der eindeutige Index auf
 *    Order.idempotencyKey ist die Durchsetzung; ein deaktivierter Knopf im
 *    Browser ist keine.
 *
 * 2. DIE RESERVIERUNGSFRIST WIRD GEPRÜFT (Befund 3), und zwar mit derselben
 *    Funktion wie Warenkorb und Checkout-Einstieg (src/server/warenkorb.ts).
 *    Eine abgelaufene Position wird NIE durchgewunken: Die Antwort nennt den
 *    Grund und liefert den berichtigten Warenkorb mit, statt eine
 *    Bestandsmeldung auszugeben, die die Ursache verschweigt.
 *
 * 3. DIE E-MAIL BLOCKIERT NICHT MEHR (Befund 4). Sie lief bisher synchron im
 *    Request — das waren die zehn bis fünfzehn Sekunden. Jetzt geht sie über
 *    `after()` raus, also nach der Antwort. Scheitert der Versand, steht die
 *    Bestellung trotzdem; der Fehler wird protokolliert, nicht zurückgerollt.
 *
 * Dazu: Der Bestand wird BEDINGT gebucht (`updateMany` mit `stock >= Menge`)
 * statt blind dekrementiert. Zwei gleichzeitige Bestellungen konnten vorher
 * beide die Prüfung bestehen und den Bestand ins Minus ziehen.
 */

function generateOrderNumber(farmSlug: string): string {
  const parts = farmSlug.split('-')
  const initials = parts
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 3)
  const now = new Date()
  const dd = String(now.getDate()).padStart(2, '0')
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const suffix = Array.from({ length: 4 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  )
    .join('')
    .toUpperCase()
  return `${initials}-${dd}${mm}-${suffix}`
}

/** Bereits gebuchte Mengen wieder gutschreiben — Ausgleich, wenn danach etwas scheitert. */
async function gibBestandZurueck(gebucht: Array<{ productId: string; quantity: number }>) {
  for (const g of gebucht) {
    try {
      await prisma.product.update({
        where: { id: g.productId },
        data: { stock: { increment: g.quantity } },
      })
    } catch (e) {
      // Der Ausgleich darf die Fehlerantwort nicht selbst zum Absturz bringen.
      console.error('[/api/checkout] Bestand-Ausgleich fehlgeschlagen', g.productId, e)
    }
  }
}

const CODE_BESTELLUNG_IN_ARBEIT = 'BESTELLUNG_IN_ARBEIT'
const CODE_BESTELLUNG_BEENDET = 'BESTELLUNG_BEENDET'

/** Storno-Grund, wenn Stripe den Zahlungsvorgang nicht anlegen konnte. */
const GRUND_ZAHLUNG_NICHT_GESTARTET = 'Zahlung konnte nicht gestartet werden'

/**
 * So lange darf eine Online-Bestellung ohne PaymentIntent als „wird gerade
 * angelegt" gelten. Danach ist die erste Anfrage sicher vorbei — ohne Intent
 * ist sie gescheitert, und eine Wiederholung bekäme sonst für immer 409.
 */
const INTENT_WARTEZEIT_MS = 2 * 60 * 1000

/**
 * Stripe-Idempotenz-Schlüssel je Bestellung: Eine Wiederholung bekommt
 * DENSELBEN PaymentIntent, statt einen zweiten anzulegen — auch dann, wenn
 * nur das Speichern der Intent-ID gescheitert war.
 *
 * Kurze Leine: Drei Versuche à 20 s bleiben sicher unter der Wartezeit von
 * zwei Minuten. Mit der SDK-Vorgabe (80 s je Versuch) konnte die erste
 * Anfrage ihren Intent noch speichern, nachdem eine Wiederholung die
 * Bestellung schon als gescheitert storniert hatte.
 */
const STRIPE_LEINE = { timeout: 20_000, maxNetworkRetries: 2 }
const intentOptionen = (orderId: string) => ({ idempotencyKey: `pi-${orderId}`, ...STRIPE_LEINE })

/**
 * 409 von Stripe: Eine zweite Anfrage mit demselben Schlüssel läuft gerade
 * (Doppelklick). Das ist kein Ausfall — die andere bekommt den Intent.
 * Stripe meldet das als 409, das SDK als StripeAPIError mit diesem Status.
 */
function istStripeKonflikt(err: unknown): boolean {
  return (err as { statusCode?: unknown } | null)?.statusCode === 409
}

/**
 * Die Parameter des PaymentIntents — aus den GESPEICHERTEN Werten der
 * Bestellung, damit die Wiederholung mit `pi-<id>` exakt dieselben schickt
 * (Stripe lehnt einen Schlüssel mit anderen Parametern ab).
 *
 * LADUNGSTYP: destination charge (transfer_data.destination) OHNE
 * on_behalf_of — die Zahlung entsteht auf dem PLATTFORMKONTO, Stripe zieht
 * seine Gebühren dort ab. Überwiesen wird dem Hof der VOLLE Betrag (kein
 * transfer_data.amount); die application_fee_amount geht danach vom Hof an
 * die Plattform — netto bleibt ihm amount − application_fee_amount.
 * Deshalb: amount = Warenpreis + Servicegebühr und
 * application_fee_amount = Servicegebühr (+ Plattformgebühr, im Pilot 0)
 * → dem Hof fließt exakt der Warenpreis zu, FarmerZone trägt die
 * Stripe-Kosten aus der Servicegebühr. Der Storno holt das spiegelbildlich
 * zurück — reverse_transfer UND refund_application_fee (cancelOrder). Wer
 * den Ladungstyp hier ändert, ändert ihn dort mit
 * (tests/storno-erstattung.test.ts, Ladungstyp-Wache).
 */
function intentParameter(
  bestellung: {
    id: string
    orderNumber: string
    farmId: string
    totalAmount: Prisma.Decimal
    platformFeeAmount: Prisma.Decimal
    serviceFeeCents: number
  },
  hofKonto: string
): Stripe.PaymentIntentCreateParams {
  const amountCents = decimalZuCents(bestellung.totalAmount) + bestellung.serviceFeeCents
  const feeAmountCents = decimalZuCents(bestellung.platformFeeAmount) + bestellung.serviceFeeCents
  return {
    amount: amountCents,
    currency: 'eur',
    metadata: { orderId: bestellung.id, orderNumber: bestellung.orderNumber, farmId: bestellung.farmId },
    transfer_data: { destination: hofKonto },
    ...(feeAmountCents > 0 ? { application_fee_amount: feeAmountCents } : {}),
  }
}

/**
 * Stripe konnte den Zahlungsvorgang nicht anlegen (Ausfall, Hof-Konto
 * eingeschränkt): Bestellung stornieren und Ware zurückbuchen, statt eine
 * Bestellung ohne Zahlungsweg stehen zu lassen. Scheitert auch der Storno,
 * räumt die Frist auf (src/server/verwaiste-bestellungen.ts).
 */
async function zahlungNichtMoeglich(orderId: string, barMoeglich: boolean): Promise<NextResponse> {
  try {
    await storniereUnbezahlteBestellung(orderId, GRUND_ZAHLUNG_NICHT_GESTARTET)
  } catch (err) {
    Sentry.captureException(err, { tags: { aufgabe: 'checkout', grund: 'storno_nach_zahlungsfehler' }, extra: { orderId } })
  }
  return NextResponse.json(
    { code: CODE_ZAHLUNG_NICHT_MOEGLICH, error: zahlungNichtMoeglichText(barMoeglich) },
    { status: 503 }
  )
}

const inArbeit = () =>
  NextResponse.json(
    {
      error: 'Deine Bestellung wird gerade angelegt. Bitte versuch es in ein paar Sekunden noch einmal.',
      code: CODE_BESTELLUNG_IN_ARBEIT,
    },
    { status: 409 }
  )

const beendet = () =>
  NextResponse.json(
    {
      error: 'Diese Bestellung gibt es nicht mehr. Lade die Seite neu, um noch einmal zu bestellen.',
      code: CODE_BESTELLUNG_BEENDET,
    },
    { status: 409 }
  )

/**
 * Den Intent an die Bestellung hängen — nur, solange sie noch auf die Zahlung
 * wartet (ARCHITECTURE.md §5: der bedingte Wechsel ist die Sperre). Wurde sie
 * inzwischen storniert (Wiederholung nach der Wartezeit, Frist), wird der
 * Intent abgebrochen: Sonst bekäme die Kundin ein bezahlbares Client-Secret
 * für eine Bestellung ohne Ware. `false` heißt: Die Bestellung ist weg.
 */
async function haengeIntentAn(orderId: string, intentId: string): Promise<boolean> {
  const { count } = await prisma.order.updateMany({
    where: { id: orderId, status: 'PENDING_CONFIRMATION' },
    data: { stripePaymentIntentId: intentId },
  })
  if (count === 1) return true
  try {
    await stripe.paymentIntents.cancel(intentId, { cancellation_reason: 'abandoned' }, STRIPE_LEINE)
  } catch (err) {
    Sentry.captureException(err, { tags: { aufgabe: 'checkout', grund: 'intent_ohne_bestellung' }, extra: { orderId } })
  }
  return false
}

/**
 * Gibt es zu diesem Schlüssel schon eine Bestellung, die Antwort mit ihr —
 * sonst null. EINE Stelle für Schritt 0, den Index-Konflikt in Schritt 9 und
 * den letzten Blick vor jedem 409.
 */
async function antwortFuerBestehendeBestellung(
  idempotencyKey: string | undefined,
  sessionId: string
): Promise<NextResponse | null> {
  if (!idempotencyKey) return null
  const bestehend = await prisma.order.findUnique({
    where: { idempotencyKey },
    select: {
      id: true,
      orderNumber: true,
      farmId: true,
      paymentMethod: true,
      stripePaymentIntentId: true,
      status: true,
      createdAt: true,
      pickupDate: true,
      pickupTimeStart: true,
      totalAmount: true,
      platformFeeAmount: true,
      serviceFeeCents: true,
      farm: { select: { slug: true, stripeAccountId: true, acceptsOnsite: true } },
    },
  })
  if (!bestehend) return null
  // Inzwischen storniert — meist verfallen (src/lib/fristen.ts), weil die
  // Kundin aus dem Zahlungsschritt zurück ins Formular ging und erst nach der
  // Frist erneut abschickte. Die alte Bestellung samt abgebrochenem
  // PaymentIntent zurückzugeben, führte in eine Zahlung, die nicht mehr geht.
  if (bestehend.status === 'CANCELLED') return beendet()
  if (bestehend.paymentMethod === 'ONLINE') {
    // Noch kein PaymentIntent gespeichert. Drei Möglichkeiten: Die erste
    // Anfrage läuft noch, oder Stripe legte den Intent an und nur das
    // Speichern der ID scheiterte, oder alles scheiterte unbemerkt.
    if (!bestehend.stripePaymentIntentId) {
      // Nach zwei Minuten ist die erste Anfrage sicher vorbei: gescheitert.
      if (Date.now() - bestehend.createdAt.getTime() > INTENT_WARTEZEIT_MS) {
        return zahlungNichtMoeglich(bestehend.id, bestehend.farm.acceptsOnsite)
      }
      // Ohne Hof-Konto kein Intent — noch kein Urteil, solange die erste
      // Anfrage laufen kann; nach der Wartezeit greift oben der Storno.
      const hofKonto = bestehend.farm.stripeAccountId
      if (!hofKonto) return inArbeit()
      // Derselbe Stripe-Schlüssel liefert denselben Intent — egal, ob die
      // erste Anfrage ihn schon anlegte.
      let intent: Stripe.PaymentIntent
      const parameter = intentParameter(bestehend, hofKonto)
      try {
        intent = await stripe.paymentIntents.create(parameter, intentOptionen(bestehend.id))
      } catch (err) {
        // Konflikt: Die erste Anfrage legt den Intent gerade an — erwartbar.
        // Alles andere soll jemand sehen: Ein dauerhafter Fehler (etwa
        // abweichende Parameter) endete sonst nach zwei Minuten im stillen Storno.
        if (!istStripeKonflikt(err)) {
          Sentry.captureException(err, {
            tags: { aufgabe: 'checkout', grund: 'zahlung_wiederholung' },
            extra: { orderId: bestehend.id },
          })
        }
        return inArbeit()
      }
      if (!(await haengeIntentAn(bestehend.id, intent.id))) return beendet()
      // Die erste Anfrage kam nicht mehr dazu, die Halte der Sitzung freizugeben.
      await prisma.stockReservation.deleteMany({ where: { sessionId } })
      return NextResponse.json({
        orderId: bestehend.id,
        orderNumber: bestehend.orderNumber,
        clientSecret: intent.client_secret,
        reserviertBis: fristVon(bestehend).toISOString(),
        bestaetigung: bestaetigungsPfad(bestehend.farm.slug, bestehend.id),
        wiederholt: true,
        // Nur Anzeige: genau der Betrag, den Stripe abbucht (siehe 11a).
        amountCents: parameter.amount,
        serviceFeeCents: bestehend.serviceFeeCents,
      })
    }
    // Für die Zahlungsmaske braucht der Browser das Client-Secret erneut.
    const intent = await stripe.paymentIntents.retrieve(bestehend.stripePaymentIntentId)
    return NextResponse.json({
      orderId: bestehend.id,
      orderNumber: bestehend.orderNumber,
      clientSecret: intent.client_secret,
      reserviertBis: fristVon(bestehend).toISOString(),
      bestaetigung: bestaetigungsPfad(bestehend.farm.slug, bestehend.id),
      wiederholt: true,
      // Nur Anzeige: der Betrag des bestehenden Zahlungsvorgangs, wie Stripe ihn führt.
      amountCents: intent.amount,
      serviceFeeCents: bestehend.serviceFeeCents,
    })
  }
  return NextResponse.json({
    orderId: bestehend.id,
    orderNumber: bestehend.orderNumber,
    requiresConfirmation: true,
    bestaetigung: bestaetigungsPfad(bestehend.farm.slug, bestehend.id),
    wiederholt: true,
  })
}

/**
 * 409 — außer, zu diesem Schlüssel steht inzwischen eine Bestellung.
 *
 * Zwei gleichzeitige Anfragen mit demselben Schlüssel: Die Gewinnerin legt die
 * Bestellung an und löscht danach die Halte der Sitzung. Die Verliererin sieht
 * dann „Reservierung abgelaufen" oder einen verbrauchten Bestand — beides
 * stimmt für sie nicht, denn ihre Bestellung gibt es ja. Der letzte Blick
 * macht daraus die 200 mit genau dieser Bestellung.
 */
async function konflikt(
  idempotencyKey: string | undefined,
  sessionId: string,
  inhalt: object
): Promise<NextResponse> {
  return (
    (await antwortFuerBestehendeBestellung(idempotencyKey, sessionId)) ??
    NextResponse.json(inhalt, { status: 409 })
  )
}

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit('checkout', request)
  if (limited) return limited

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Ungültiges JSON' }, { status: 400 })
  }

  const parsed = checkoutRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Ungültige Daten', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const data = parsed.data

  // Zweite Bremse je SITZUNG — siehe src/lib/rate-limit.ts. Die sessionId
  // steht erst nach dem Parsen fest, deshalb hier und nicht ganz oben.
  const sitzungsLimit = enforceRateLimit('checkout', request, data.sessionId)
  if (sitzungsLimit) return sitzungsLimit

  // 0a. FRIST GILT BEIM LESEN: Verwaiste Bestellungen dieses Hofs geben ihre
  //     Ware frei, bevor Bestand gelesen oder eine Wiederholung beantwortet
  //     wird (src/lib/fristen.ts). Ein Fehler darin bleibt gemeldet, der
  //     Checkout läuft weiter.
  await gibVerwaisteFreiOhneRisiko(data.farmId)

  // 0. IDEMPOTENZ — vor allem anderen. Kennt der Server den Schlüssel schon,
  //    ist die Bestellung bereits angelegt; sie wird zurückgegeben, nichts
  //    Zweites entsteht, kein Bestand wird ein zweites Mal gebucht.
  const wiederholung = await antwortFuerBestehendeBestellung(data.idempotencyKey, data.sessionId)
  if (wiederholung) return wiederholung

  // 1. Load farm
  const farm = await prisma.farm.findUnique({
    where: { id: data.farmId },
    include: { owner: { select: { name: true } } },
  })
  if (!farm || !farm.isActive) {
    return NextResponse.json({ error: 'Hof nicht gefunden' }, { status: 404 })
  }

  // 1b. Stilllegung — fail-closed und VOR der Pause geprüft: der dauerhafte
  // Zustand sticht den vorübergehenden, damit ein stillgelegter Hof nie die
  // Pausen-Meldung ausgibt ("bald wieder da" wäre eine falsche Zusage).
  if (farm.archivedAt) {
    return konflikt(data.idempotencyKey, data.sessionId, { error: FARM_ARCHIVED_MESSAGE })
  }

  // 1b². Freischaltung — nach der Stilllegung, aber VOR der Pause: ein noch
  // nicht freigeschalteter Hof darf keine Pausen-Meldung ausgeben, denn er
  // war nie offen (siehe src/lib/farm-approval.ts).
  if (!farm.approvedAt) {
    return konflikt(data.idempotencyKey, data.sessionId, { error: FARM_NOT_APPROVED_MESSAGE })
  }

  // 1c. Shop-Pause — fail-closed VOR jeder Bestell- und Zahlungslogik:
  // vor der Bestandsprüfung, vor prisma.order.create und vor jedem Stripe-Aufruf.
  // Eine ausgeblendete Schaltfläche ist keine Durchsetzung; die Wahrheit steht hier.
  if (farm.isPaused) {
    return konflikt(data.idempotencyKey, data.sessionId, { error: SHOP_PAUSED_MESSAGE })
  }

  // 2a. E5: Karte bei Abholung gibt es für NEUE Bestellungen nicht mehr.
  //     Erst hier, nach Schritt 0: Eine schon bestehende Bestellung mit
  //     ONSITE_CARD (alter Tab, gleicher Schlüssel) bekommt oben weiter ihre
  //     Antwort. Der Enum-Wert bleibt (Expand/Contract), bis keine offene
  //     Bestellung ihn mehr trägt (src/lib/kasse.ts).
  if (!zahlartFuerNeueBestellung(data.paymentMethod)) {
    return NextResponse.json(
      { error: ZAHLART_NICHT_ANGEBOTEN, code: CODE_ZAHLART_NICHT_ANGEBOTEN },
      { status: 400 }
    )
  }

  // 2. Validate payment method availability
  if (data.paymentMethod === 'ONLINE') {
    if (!farm.acceptsOnline || !farm.stripeAccountReady || !farm.stripeAccountId) {
      return NextResponse.json(
        { error: 'Online-Zahlung ist für diesen Hof nicht verfügbar' },
        { status: 400 }
      )
    }
  } else if (!farm.acceptsOnsite) {
    return NextResponse.json(
      { error: 'Vor-Ort-Zahlung ist für diesen Hof nicht verfügbar' },
      { status: 400 }
    )
  }

  const now = new Date()

  // 2b. ABHOLFENSTER — vor Warenkorb und Bestand. Der Server nimmt nur ein
  //     Fenster an, das der Hof jetzt anbietet (src/lib/abholfenster.ts):
  //     aktiv, dieser Wochentag, genau diese Zeiten, Bestellschluss in der
  //     Zukunft, im Zeitraum der Tageskarten — und bei einer Höchstzahl mit
  //     freiem Platz. Verbindlich zählt das Anlegen in Schritt 9.
  const abholwahl = { datum: data.pickupDate, start: data.pickupTimeStart, ende: data.pickupTimeEnd }
  const abholung = await pruefeAbholfenster(farm.id, abholwahl, now)
  if (!abholung.ok) {
    return konflikt(data.idempotencyKey, data.sessionId, { error: ABHOLFENSTER_NICHT_VERFUEGBAR, code: abholung.code })
  }

  // 3. RESERVIERUNGSFRIST UND BESTAND — eine Prüfung für beides, dieselbe
  //    Funktion wie im Warenkorb (src/server/warenkorb.ts). Eine verfallene
  //    eigene Reservierung wird hier NICHT stillschweigend hingenommen: Die
  //    Kundin bekommt den Grund und den berichtigten Warenkorb, damit sie
  //    sieht, was gilt, statt vor einer leeren Seite zu stehen.
  const pruefung = await pruefeSitzungsWarenkorb(
    data.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    data.sessionId,
    now
  )

  if (pruefung.befund.etwasAbgelaufen || pruefung.befund.etwasGeaendert) {
    return konflikt(
      data.idempotencyKey,
      data.sessionId,
      {
        error: pruefung.meldung ?? 'Dein Warenkorb hat sich geändert.',
        code: pruefung.befund.etwasAbgelaufen ? CODE_RESERVIERUNG_ABGELAUFEN : 'WARENKORB_GEAENDERT',
        items: pruefung.berichtigt,
        positionen: pruefung.befund.positionen,
      },
    )
  }

  // 3b. PREIS, ABGABE UND MWST AUS DER DATENBANK. Der Warenkorb ist nie die
  //     Wahrheit: Was ein Produkt kostet, ob es nur an Betriebe geht und
  //     welcher MwSt-Satz gilt, steht am Produkt — nicht in dem, was der
  //     Browser schickt. Nur Produkte DIESES Hofs zählen.
  const produkte = await prisma.product.findMany({
    where: { id: { in: data.items.map((i) => i.productId) }, farmId: farm.id },
    select: { id: true, name: true, price: true, vatRate: true, abgabe: true },
  })
  const produktJeId = new Map(produkte.map((p) => [p.id, p]))
  if (data.items.some((i) => !produktJeId.has(i.productId))) {
    return konflikt(
      data.idempotencyKey,
      data.sessionId,
      { error: 'Dein Warenkorb hat sich geändert. Bitte prüfe ihn noch einmal.', code: 'WARENKORB_GEAENDERT' },
    )
  }

  // Weicht ein Preis ab, entsteht KEINE Bestellung: Die Kundin soll nie einen
  // Betrag zahlen, den sie nicht gesehen hat. Die Antwort liefert die gültigen
  // Preise mit; der Checkout übernimmt sie in den Warenkorb und zeigt die neue
  // Summe (dasselbe Muster wie bei gekürzten Mengen).
  // Decimal bleibt Decimal — gerechnet wird damit, nicht mit number.
  const dbPreise = new Map(produkte.map((p) => [p.id, p.price]))
  // Die Positionen nehmen aus dem Request NUR Produkt, Menge und den
  // gesehenen Preis (für den Abgleich). Der Name kommt wie Preis, MwSt und
  // Abgabe aus der Datenbank — items.name ist Fremdtext und wird nie gelesen.
  // Vorher stand hier `{ ...i }`: So landete jeder Text aus einem gebauten
  // Request in Bestellung, Packliste, Hof-Mail und Abrechnung.
  // Das ! ist sicher: 3b hat oben jedes Produkt der Anfrage in produktJeId gefunden.
  const angefragt = data.items.map((i) => ({
    productId: i.productId,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    name: bestellPositionsName(produktJeId.get(i.productId)!.name),
  }))
  const abweichend = preisAbweichungen(angefragt, dbPreise)
  if (abweichend.length > 0) {
    const namen = abweichend.map((a) => `„${a.name}“`).join(', ')
    return konflikt(
      data.idempotencyKey,
      data.sessionId,
      {
        error:
          abweichend.length === 1
            ? `Der Preis von ${namen} hat sich geändert. Bitte prüfe deinen Warenkorb.`
            : `Die Preise von ${namen} haben sich geändert. Bitte prüfe deinen Warenkorb.`,
        code: 'WARENKORB_GEAENDERT',
        preise: abweichend.map(({ productId, price }) => ({ productId, price })),
      },
    )
  }
  // Ab hier rechnet alles mit dem Preis aus der DB — auch wenn er gleich war.
  // Das ! ist sicher: 3b hat oben jedes Produkt der Anfrage in produktJeId gefunden.
  const positionen = angefragt.map((i) => ({ ...i, unitPrice: dbPreise.get(i.productId)! }))

  // 3c. BETRIEBSNACHWEIS — serverseitig erneut, auch wenn das Formular schon
  //     geprüft hat. Vor jeder Buchung: Ein Verstoß bucht keinen Bestand und
  //     legt keine Bestellung an.
  const nachweis = pruefeBetriebsnachweis({
    nurBetriebeImKorb: produkte.some((p) => p.abgabe === 'NUR_BETRIEBE'),
    kaeuferArt: data.kaeuferArt,
    betriebsnummer: data.betriebsnummer,
  })
  if (!nachweis.ok) {
    return NextResponse.json(
      { error: nachweis.meldung, code: CODE_BETRIEBSNACHWEIS_FEHLT, feld: nachweis.feld },
      { status: 400 }
    )
  }

  // 4. KEIN KUNDENKONTO (E8, Nr. 17a). Die Kundin bestellt als Gast: kein
  //    ruhendes Konto, keine Verknüpfung mit einem Konto derselben Adresse —
  //    `customerId` bleibt null. Wer sie ist, sagt die bereinigte, klein
  //    geschriebene `customerEmail` (emailSchema); Name und Telefon stehen als
  //    Momentaufnahme auf der Bestellung. Vorher landete eine Bestellung hier
  //    am Konto, das zufällig dieselbe Adresse trug, auch an dem eines Hofs.

  // 5. Totals — totalAmount ist und bleibt der WARENPREIS (Umsatz des Hofes)
  const totalAmount = calcTotalAmount(positionen)
  const platformFeeAmount = calcPlatformFeeAmount(totalAmount, farm.platformFeePercent)

  // 5b. Servicegebühr — aus der Hofeinstellung ZUM BESTELLZEITPUNKT berechnet
  //     und im Snapshot der Bestellung eingefroren (src/lib/servicegebuehr.ts).
  //     Der Browser zeigt dieselbe Rechnung vorab; verbindlich ist diese hier.
  //     Mit der Zahlungsart (Register B1): bar vor dem SEPA-Start 0 Cent, nach
  //     der Server-Uhr dieses Requests — nie nach dem, was der Browser zeigte.
  const warenpreisCents = decimalZuCents(totalAmount)
  const servicegebuehr = berechneServicegebuehr(warenpreisCents, farm, now, data.paymentMethod)

  // 6. Order number (retry on collision — astronomically unlikely)
  let orderNumber = generateOrderNumber(data.farmSlug)
  const collision = await prisma.order.findUnique({ where: { orderNumber } })
  if (collision) orderNumber = generateOrderNumber(data.farmSlug)

  // 7. Pickup date (noon local time to avoid UTC midnight drift)
  const [y, mo, d] = data.pickupDate.split('-').map(Number)
  const pickupDate = new Date(y, mo - 1, d, 12, 0, 0)

  // 8. BESTAND BEDINGT BUCHEN — vor der Bestellung, damit im Fehlerfall keine
  //    halbe Bestellung übrig bleibt. `updateMany` mit `stock >= Menge` schlägt
  //    fehl (count 0), wenn zwischen Prüfung und Buchung jemand schneller war;
  //    ein blindes `decrement` hätte den Bestand ins Minus gezogen.
  const gebucht: Array<{ productId: string; quantity: number }> = []
  for (const item of positionen) {
    const res = await prisma.product.updateMany({
      where: { id: item.productId, stock: { gte: item.quantity } },
      data: { stock: { decrement: item.quantity } },
    })
    if (res.count === 0) {
      await gibBestandZurueck(gebucht)
      return konflikt(
        data.idempotencyKey,
        data.sessionId,
        {
          error: `"${item.name}" wurde gerade von jemand anderem gekauft. Bitte prüfe deinen Warenkorb.`,
          code: 'WARENKORB_GEAENDERT',
        },
      )
    }
    gebucht.push({ productId: item.productId, quantity: item.quantity })
  }

  // 9. Bestellung anlegen. Scheitert das, wird der Bestand wieder gutgeschrieben —
  //    sonst wäre Ware verschwunden, die nie verkauft wurde.
  // Die Geldwerte kommen so zurück, wie die Datenbank sie gespeichert hat —
  // genau daraus rechnet intentParameter, auch bei einer Wiederholung.
  let order: {
    id: string
    createdAt: Date
    orderNumber: string
    farmId: string
    totalAmount: Prisma.Decimal
    platformFeeAmount: Prisma.Decimal
    serviceFeeCents: number
  }
  try {
    // Bei einem Fenster mit Höchstzahl: zählen und anlegen in EINER
    // Transaktion unter der Sperre des Fensters (src/server/abholfenster.ts).
    order = await imAbholfenster(farm.id, abholung.fenster, (db) => db.order.create({
      data: {
        orderNumber,
        idempotencyKey: data.idempotencyKey ?? null,
        farmId: farm.id,
        customerEmail: data.customerEmail,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerNote: data.customerNote || null,
        status: 'PENDING_CONFIRMATION',
        totalAmount,
        pickupDate,
        pickupTimeStart: data.pickupTimeStart,
        pickupTimeEnd: data.pickupTimeEnd,
        paymentMethod: data.paymentMethod as 'ONLINE' | 'ONSITE_CASH' | 'ONSITE_CARD',
        paymentStatus: 'PENDING',
        platformFeeAmount,
        // Snapshot der Servicegebühr — spätere Änderungen der Hofeinstellung
        // lassen diese Bestellung unverändert (prisma/schema.prisma, Order).
        serviceFeeCents: servicegebuehr.gebuehrCents,
        serviceFeePercentApplied: servicegebuehr.prozentAngewendet,
        // Snapshot der Mindestgebühr (E14, Nr. 19): „Artikel fehlt" rechnet die
        // Gebühr auf den Rest mit genau dieser Regel neu, nie mit der heutigen
        // Hofeinstellung. null, wenn keine Gebühr gilt — wie der Prozentsatz,
        // also auch bar vor dem SEPA-Start (B1): Gebühr 0 bleibt dort 0.
        serviceFeeMinCentsApplied: servicegebuehr.prozentAngewendet === null ? null : farm.serviceFeeMinCents,
        kaeuferArt: data.kaeuferArt,
        betriebsnummer: betriebsnummerFuerBestellung(data.kaeuferArt, data.betriebsnummer),
        items: {
          create: positionen.map((i) => ({
            productId: i.productId,
            productName: i.name,
            unitPrice: i.unitPrice,
            quantity: i.quantity,
            totalPrice: calcLineTotal(i.unitPrice, i.quantity),
            // SNAPSHOT des MwSt-Satzes — im selben create wie die Bestellung,
            // also atomar mit ihr. Später nie aus Product nachlesen, nie
            // rückwirkend ändern (Invariante ARCHITECTURE.md §5). Die Map ist
            // oben vollständig geprüft (3b).
            vatRate: produktJeId.get(i.productId)!.vatRate,
          })),
        },
      },
      select: {
        id: true,
        createdAt: true,
        orderNumber: true,
        farmId: true,
        totalAmount: true,
        platformFeeAmount: true,
        serviceFeeCents: true,
      },
    }))
  } catch (e) {
    await gibBestandZurueck(gebucht)
    // Der letzte Platz im Fenster ging an eine gleichzeitige Bestellung: keine
    // Bestellung, Bestand zurück, die Kundin wählt ein anderes Fenster.
    if (e instanceof AbholfensterVoll) {
      return konflikt(data.idempotencyKey, data.sessionId, {
        error: ABHOLFENSTER_NICHT_VERFUEGBAR,
        code: CODE_ABHOLFENSTER_VOLL,
      })
    }
    // Zwei Requests mit demselben Schlüssel gleichzeitig: Der zweite läuft in
    // den eindeutigen Index. Dann gewinnt der erste, und der zweite bekommt
    // dessen Bestellung — kein Fehler für die Kundin.
    const wiederholung = await antwortFuerBestehendeBestellung(data.idempotencyKey, data.sessionId)
    if (wiederholung) return wiederholung
    console.error('[/api/checkout] Bestellung konnte nicht angelegt werden', e)
    return NextResponse.json(
      { error: 'Die Bestellung konnte nicht angelegt werden. Bitte versuche es erneut.' },
      { status: 500 }
    )
  }

  // 10. Die Halte der Sitzung werden erst frei, wenn die Bestellung steht —
  //     online also NACH dem PaymentIntent (11a). Scheitert Stripe, wird die
  //     Bestellung storniert, und die Kundin kann mit ihren Halten sofort bar
  //     bestellen, statt an „Reservierung abgelaufen" zu scheitern.
  const gibHalteFrei = () => prisma.stockReservation.deleteMany({ where: { sessionId: data.sessionId } })

  // 10b. Newsletter opt-in — only upsert if customer explicitly opted in
  if (data.optInEmail || data.optInWhatsApp) {
    const email = data.customerEmail.toLowerCase()
    const existing = await prisma.customerFarmSubscription.findUnique({
      where: { customerEmail_farmId: { customerEmail: email, farmId: farm.id } },
      select: { optInEmail: true, optInWhatsApp: true },
    })
    await prisma.customerFarmSubscription.upsert({
      where: { customerEmail_farmId: { customerEmail: email, farmId: farm.id } },
      create: {
        customerEmail: email,
        farmId: farm.id,
        optInEmail: data.optInEmail ?? false,
        optInWhatsApp: data.optInWhatsApp ?? false,
        customerPhone: data.customerPhone || null,
      },
      update: {
        // Only set to true — never overwrite an existing true with false from this checkout
        ...(data.optInEmail ? { optInEmail: true } : {}),
        ...(data.optInWhatsApp ? { optInWhatsApp: true } : {}),
        customerPhone: data.customerPhone || null,
        // Preserve existing opts if they were already true
        ...(existing?.optInEmail ? { optInEmail: true } : {}),
        ...(existing?.optInWhatsApp ? { optInWhatsApp: true } : {}),
      },
    })
  }

  // 11a. ONLINE — PaymentIntent anlegen (Ladungstyp: intentParameter oben).
  //      Mit festem Stripe-Schlüssel je Bestellung und NIE ungeschützt:
  //      Bestellung und Bestand stehen schon. Scheitert Stripe, wird storniert
  //      und zurückgebucht, statt beides ohne Zahlungsweg stehen zu lassen.
  if (data.paymentMethod === 'ONLINE') {
    let paymentIntent: Stripe.PaymentIntent
    // Das ! ist sicher: Schritt 2 lehnt ONLINE ohne stripeAccountId ab.
    const parameter = intentParameter(order, farm.stripeAccountId!)
    try {
      paymentIntent = await stripe.paymentIntents.create(parameter, intentOptionen(order.id))
    } catch (err) {
      // Doppelklick: Die zweite Anfrage legt mit demselben Schlüssel gerade
      // denselben Intent an. Kein Ausfall, kein Storno — sie bekommt ihn.
      if (istStripeKonflikt(err)) return inArbeit()
      console.error('[/api/checkout] PaymentIntent nicht angelegt', order.id)
      Sentry.captureException(err, { tags: { aufgabe: 'checkout', grund: 'zahlung_nicht_gestartet' }, extra: { orderId: order.id } })
      return zahlungNichtMoeglich(order.id, farm.acceptsOnsite)
    }

    // Bedingt: Wurde die Bestellung während des Stripe-Aufrufs storniert,
    // wird der Intent abgebrochen statt herausgegeben. Scheitert NUR das
    // Speichern (wirft), holt die Wiederholung mit demselben Schlüssel
    // denselben Intent und trägt die ID nach.
    if (!(await haengeIntentAn(order.id, paymentIntent.id))) {
      return NextResponse.json(
        { code: CODE_ZAHLUNG_NICHT_MOEGLICH, error: zahlungNichtMoeglichText(farm.acceptsOnsite) },
        { status: 503 }
      )
    }
    await gibHalteFrei()

    return NextResponse.json({
      orderId: order.id,
      orderNumber,
      clientSecret: paymentIntent.client_secret,
      // Die signierte Bestätigungsseite — Stripes return_url (src/lib/bestell-link.ts).
      bestaetigung: bestaetigungsPfad(farm.slug, order.id),
      // Bis dahin hält die Bestellung ihre Ware (src/lib/fristen.ts) — der
      // Zahlungsschritt zeigt die Uhrzeit.
      reserviertBis: fristVon({
        paymentMethod: 'ONLINE',
        createdAt: order.createdAt,
        pickupDate,
        pickupTimeStart: data.pickupTimeStart,
      }).toISOString(),
      // Nur Anzeige: Der Zahlungsschritt zeigt GENAU den Betrag, den Stripe
      // abbucht — aus denselben Parametern wie der Aufruf oben, nicht neu
      // gerechnet. Sonst rechnete der Browser mit seiner Uhr weiter und stünde
      // nach einem Wechsel der Gebühreneinstellung mit einem anderen Betrag da.
      amountCents: parameter.amount,
      serviceFeeCents: order.serviceFeeCents,
    })
  }

  // 11b. ONSITE — Bestätigungs-Token jetzt, E-Mail NACH der Antwort.
  await gibHalteFrei()
  const confirmationToken = nanoid(32)
  await prisma.order.update({
    where: { id: order.id },
    data: { confirmationToken },
  })

  // Der Versand hängt an Resend und dauert Sekunden. Er gehört nicht in die
  // Antwortzeit der Kundin: `after()` führt ihn aus, NACHDEM die Antwort
  // rausgegangen ist. Die Einheiten fürs Mail-Format werden ebenfalls erst
  // hier geladen — vorher waren es zwei zusätzliche Abfragen je Position im
  // kritischen Pfad.
  nachDerAntwort(async () => {
    try {
      const produkte = await prisma.product.findMany({
        where: { id: { in: data.items.map((i) => i.productId) } },
        select: { id: true, unit: true, unitSize: true },
      })
      const einheit = new Map(
        produkte.map((p) => [
          p.id,
          { unit: p.unit, unitSize: p.unitSize == null ? null : Number(p.unitSize) },
        ])
      )

      await sendOnsiteConfirmation(
        {
          id: order.id,
          orderNumber,
          customerName: data.customerName,
          customerEmail: data.customerEmail,
          customerPhone: data.customerPhone,
          totalAmount,
          serviceFeeCents: servicegebuehr.gebuehrCents,
          // Nur für die Frist im Mailtext (fristVon) — dieselbe Zeit, ab der die Bestellung verfällt.
          createdAt: order.createdAt,
          pickupDate,
          pickupTimeStart: data.pickupTimeStart,
          pickupTimeEnd: data.pickupTimeEnd,
          paymentMethod: data.paymentMethod,
          farm: {
            id: farm.id,
            name: farm.name,
            slug: farm.slug,
            email: farm.email,
            ownerName: farm.ownerName,
            address: farm.address,
            postalCode: farm.postalCode,
            city: farm.city,
            phone: farm.phone,
          },
          items: positionen.map((i) => ({
            productName: i.name,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            totalPrice: calcLineTotal(i.unitPrice, i.quantity),
            product: einheit.get(i.productId) ?? null,
          })),
        },
        confirmationToken
      )
    } catch (e) {
      // Die Bestellung steht. Ein gescheiterter Versand wird protokolliert und
      // NICHT zurückgerollt — sonst verlöre die Kundin eine gültige Bestellung,
      // weil ein Mailserver hakte.
      console.error('[/api/checkout] Bestätigungsmail fehlgeschlagen', orderNumber, e)
    }
  })

  return NextResponse.json({
    orderId: order.id,
    orderNumber,
    requiresConfirmation: true,
    bestaetigung: bestaetigungsPfad(farm.slug, order.id),
  })
}
