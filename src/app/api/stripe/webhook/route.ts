import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { Prisma } from '@prisma/client'
import * as Sentry from '@sentry/nextjs'
import { stripe } from '@/lib/stripe'
import { env } from '@/lib/env'
import { prisma } from '@/lib/prisma'
import { nachDerAntwort } from '@/lib/nach-der-antwort'
import { stelleEinOhneRisiko, stelleMailEinInTransaktion, type EinstellAuftrag } from '@/server/mail-warteschlange'
import { bestellMailAuftrag, zahlungZuSpaetMailAuftrag } from '@/server/mail-arten/bestellung'
import { betreiberAuftraege, betreiberKennungen, erstattungOffenBezug } from '@/server/mail-arten/betreiber'
import { erstattungOffenInhalt } from '@/lib/erstattung-offen'
import type { ErstattungOffenFall } from '@/schemas/mail-auftrag'
import { storniereUnbezahlteBestellung } from '@/server/unbezahlte-bestellung'
import { ANLASS_VOLLSTORNO } from '@/server/teilerstattung'
import {
  MELDE_VERMERK_TYP,
  meldeVermerk,
  nimmGescheiterteErstattungZurueck,
  type GescheitertAusgang,
} from '@/server/erstattung-gescheitert'
import { stripeKontoBereit } from '@/lib/stripe-konto'
import { istModusSperre } from '@/lib/stripe-modus'
import { istVerarbeiteterStripeTyp, pruefeStripeObjekt, type VerarbeiteterStripeTyp } from '@/schemas/stripe-ereignis'
import {
  behandleMandatEingerichtet,
  behandleMandatGeaendert,
  behandleRechnungBezahlt,
  behandleRechnungGescheitert,
  behandleRueckbuchung,
} from '@/server/plattformgebuehr-abrechnung'

// Next.js App Router does not pre-parse the body — raw text needed for Stripe sig verification
export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  const webhookSecret = env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('[Webhook] STRIPE_WEBHOOK_SECRET not set')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  // Zwei Endpunkte in Stripe, eine Route: Plattform-Events (Zahlungen) und
  // Connect-Events der verbundenen Höfe (account.updated) kommen mit je
  // eigenem Signatur-Secret. Gültig ist, was gegen eines davon passt.
  const secrets = [webhookSecret, env.STRIPE_CONNECT_WEBHOOK_SECRET].filter(
    (s): s is string => typeof s === 'string' && s.length > 0
  )

  // Modus-Wache (Register Z2, Nr. 42): Sperrt sie den Stripe-Client, ist das
  // keine ungültige Signatur — sonst sucht jemand den Fehler im Secret. Eine
  // eigene Antwort (503) ändert die Diagnose, nicht das Wiederholen: Stripe
  // stellt bei jeder Antwort außer 2xx erneut zu (live bis zu drei Tage).
  // Nach außen ein neutraler Satz, denn diese Antwort kommt VOR der
  // Signaturprüfung und ginge an jeden Aufrufer. Die Einzelheiten stehen nur
  // im Protokoll — die Meldung nennt Umgebung und Ausweg, nie den Schlüssel.
  let webhooks: typeof stripe.webhooks
  try {
    webhooks = stripe.webhooks
  } catch (err) {
    if (!istModusSperre(err)) throw err
    console.error(`[Webhook] ${err.message}`)
    return NextResponse.json({ error: 'Zahlungsdienst vorübergehend nicht verfügbar.' }, { status: 503 })
  }

  let event: Stripe.Event | null = null
  let letzterFehler = 'Unknown error'
  for (const secret of secrets) {
    try {
      event = webhooks.constructEvent(rawBody, sig, secret)
      break
    } catch (err) {
      letzterFehler = err instanceof Error ? err.message : 'Unknown error'
    }
  }
  if (!event) {
    // Die Meldung von Stripe nur ins Protokoll (sie nennt nie das Secret):
    // Nach außen verrät die Antwort nichts darüber, woran die Prüfung scheiterte (Nr. 203).
    console.error('[Webhook] Signature verification failed:', letzterFehler)
    return NextResponse.json({ error: 'Signatur ungültig' }, { status: 400 })
  }

  // Vor jeder Verarbeitung die Form (Nr. 203, src/schemas/stripe-ereignis.ts).
  // Geprüft wird genau, was verarbeitet wird: von einem verbundenen Konto nur
  // account.updated, sonst die Typen der Liste. Ungültig → 200 ohne
  // Verarbeitung und ohne Vermerk: Eine andere Antwort ließe Stripe tagelang
  // dasselbe kaputte Ereignis zustellen, und das Ergebnis wäre jedes Mal gleich.
  const verarbeitet = event.account ? event.type === 'account.updated' : istVerarbeiteterStripeTyp(event.type)
  const typ: VerarbeiteterStripeTyp | null = verarbeitet && istVerarbeiteterStripeTyp(event.type) ? event.type : null
  if (typ) {
    const pruefung = pruefeStripeObjekt(typ, event.data.object)
    if (!pruefung.ok) {
      console.error(`[Webhook] ${typ}: Aufbau unerwartet, nicht verarbeitet (Felder: ${pruefung.felder.join(', ')})`)
      // Nachlauf: Stripe wartet nicht auf Sentry und die Zeile in BetriebMessung.
      nachDerAntwort(() => meldeUngueltigEinmalJeTag(typ, event.id, pruefung.felder))
      return NextResponse.json({ received: true, skipped: true })
    }
  }

  // Idempotency: skip already-processed events
  const existing = await prisma.webhookEvent.findUnique({
    where: { stripeEventId: event.id },
  })
  if (existing) {
    return NextResponse.json({ received: true, skipped: true })
  }

  try {
    // Ereignisse verbundener Hof-Konten (Connect-Endpunkt, `event.account`
    // gesetzt) betreffen nur das Konto selbst — Zahlungen laufen als
    // Destination Charge auf der Plattform und kommen ohne `account`.
    if (event.account) {
      if (event.type === 'account.updated') {
        await handleKontoAktualisiert(event.data.object as Stripe.Account)
      }
    } else if (event.type === 'payment_intent.succeeded') {
      await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent)
    } else if (event.type === 'payment_intent.payment_failed') {
      await handlePaymentFailed(event.data.object as Stripe.PaymentIntent)
    } else if (event.type === 'payment_intent.canceled') {
      await handlePaymentCanceled(event.data.object as Stripe.PaymentIntent)
    } else if (event.type === 'account.updated') {
      // Auch über den Plattform-Endpunkt möglich (abonniert); dieselbe Regel.
      await handleKontoAktualisiert(event.data.object as Stripe.Account)
    } else if (event.type === 'refund.failed' || event.type === 'charge.refund.updated') {
      // Beide Ereignisse können für DIESELBE Erstattung kommen — die
      // Zurücknahme ist je Erstattung idempotent (src/server/erstattung-gescheitert.ts).
      await handleErstattungGescheitert(event.data.object as Stripe.Refund, event.type)
    } else if (event.type === 'invoice.paid') {
      // Monatsabrechnung der Plattformgebühr (N38, Nr. 198) — Rechnungen und Mandat des Hofs bei der Plattform.
      await behandleRechnungBezahlt(event.data.object as Stripe.Invoice)
    } else if (event.type === 'invoice.payment_failed') {
      await behandleRechnungGescheitert(event.data.object as Stripe.Invoice)
    } else if (event.type === 'charge.dispute.created') {
      await behandleRueckbuchung(event.data.object as Stripe.Dispute)
    } else if (event.type === 'setup_intent.succeeded') {
      await behandleMandatEingerichtet(event.data.object as Stripe.SetupIntent)
    } else if (event.type === 'mandate.updated') {
      await behandleMandatGeaendert(event.data.object as Stripe.Mandate)
    }
  } catch (err) {
    // 500 → Stripe retried das Event; es wurde noch nicht persistiert und gilt als unverarbeitet
    console.error(`[Webhook] Error handling ${event.type}:`, err)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }

  // Erst nach erfolgreicher Verarbeitung als erledigt markieren
  try {
    await prisma.webhookEvent.create({
      data: { stripeEventId: event.id, type: event.type },
    })
  } catch (err) {
    // P2002 = paralleler Request hat dasselbe Event bereits persistiert — kein Fehler
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json({ received: true, skipped: true })
    }
    console.error('[Webhook] Event verarbeitet, aber Persistierung fehlgeschlagen:', err)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

/**
 * Ein ungültiges Ereignis an Sentry — höchstens einmal je Typ und UTC-Tag,
 * nach dem Muster von `erstmalsHeute` (src/lib/umgebung-server.ts): über alle
 * Instanzen entscheidet EINE Anweisung auf BetriebMessung (Art
 * `sentry:stripe-schema:<typ>`, Zeile je Tag), nur wer sie anlegt, meldet.
 * Ohne Deploy in der Art: Ein neuer Deploy behebt ein Ereignis von Stripe
 * nicht. Nur Typ, Ereignis-Kennung und Feldpfade — nie Werte. Scheitert die
 * Datenbank oder Sentry, bleibt es still; das Protokoll hat die Zeile schon.
 * Anders als dort kein Gedächtnis je Instanz: Ungültige Ereignisse sind
 * selten, eine Anweisung je Zustellung kostet nichts.
 */
async function meldeUngueltigEinmalJeTag(typ: VerarbeiteterStripeTyp, eventId: string, felder: string[]): Promise<void> {
  const jetzt = new Date()
  const tag = jetzt.toISOString().slice(0, 10)
  try {
    const art = `sentry:stripe-schema:${typ}`
    const angelegt = await prisma.$queryRaw<Array<{ art: string }>>`
      INSERT INTO "BetriebMessung" ("tag", "art", "wert", "gemessenAm")
      VALUES (${tag}::date, ${art}, 1, ${jetzt}::timestamp(3))
      ON CONFLICT ("tag", "art") DO NOTHING
      RETURNING "art"`
    if (angelegt.length === 0) return
    Sentry.captureMessage('Stripe-Ereignis mit unerwartetem Aufbau — nicht verarbeitet', {
      level: 'error',
      tags: { webhook: typ, grund: 'schema_ungueltig' },
      extra: { eventId, felder },
    })
  } catch {
    // Telemetrie scheitert leise.
  }
}

/** Was die Behandlung einer Zahlung von der Bestellung liest — die Mails laden ihre Daten selbst (Renderer, Nr. 159). */
const BESTELLUNG_STAND = { id: true, farmId: true, status: true, paymentStatus: true } satisfies Prisma.OrderSelect
type BestellungStand = Prisma.OrderGetPayload<{ select: typeof BESTELLUNG_STAND }>

/**
 * Bezahlt wird NUR aus „wartet auf Zahlung" heraus — der bedingte Wechsel ist
 * die Sperre (ARCHITECTURE.md §5). Vorher schrieb der Handler blind PAID und
 * belebte damit eine stornierte Bestellung wieder, deren Ware schon
 * zurückgebucht war.
 *
 * Die beiden Mails (Kundin, Hof) sind seit Nr. 159 Aufträge der
 * Warteschlange — in DERSELBEN Transaktion wie der Statuswechsel, erst der
 * Status, dann die Aufträge. Ein Auftrag hält die Zahlung nie auf (Register
 * N26, Ergänzung 25.10.2026): Ein ungültiger Bezug fällt mit Meldung weg,
 * ein Datenbankfehler beim Einstellen setzt nur den Savepoint zurück — PAID
 * bleibt, und die Aufträge werden nach dem Commit nachgeholt. Ein zweites
 * Ereignis trifft count 0 und stellt nichts ein; der Schlüssel
 * `<art>:<orderId>` hielte es ohnehin auf.
 */
async function handlePaymentSucceeded(pi: Stripe.PaymentIntent) {
  const { count, nachholen } = await prisma.$transaction(async (tx) => {
    const { count: bezahlt } = await tx.order.updateMany({
      where: { stripePaymentIntentId: pi.id, status: 'PENDING_CONFIRMATION' },
      data: { status: 'PAID', paymentStatus: 'PAID', paidAt: new Date() },
    })
    if (bezahlt !== 1) return { count: bezahlt, nachholen: null }
    // Die Bestellung steht erst unter der Sperre fest — gelesen wird nach dem Wechsel, nie davor.
    const bestellung = await tx.order.findUnique({ where: { stripePaymentIntentId: pi.id }, select: { id: true, farmId: true } })
    if (!bestellung) return { count: bezahlt, nachholen: null }
    const auftraege: EinstellAuftrag[] = [bestellMailAuftrag('bestellung-bestaetigung', bestellung), bestellMailAuftrag('bestellung-bezahlt-hof', bestellung)]
    const ergebnis = await stelleMailEinInTransaktion(auftraege, tx)
    return { count: bezahlt, nachholen: ergebnis === 'nachholen' ? { bestellungId: bestellung.id, auftraege } : null }
  })
  // Nach dem Commit, mit demselben Auftragsobjekt (derselbe Schlüssel).
  if (nachholen) await stelleEinOhneRisiko('bestellung-bestaetigung', nachholen.bestellungId, nachholen.auftraege)
  if (count === 1) return

  const order = await prisma.order.findUnique({
    where: { stripePaymentIntentId: pi.id },
    select: BESTELLUNG_STAND,
  })

  if (!order) {
    console.error('[Webhook] Order not found for PaymentIntent:', pi.id)
    return
  }

  // Storniert, OHNE dass je eine Zahlung vermerkt wurde: Das Geld kam zu spät.
  // Hat dagegen der Hof eine bezahlte Bestellung storniert (paymentStatus PAID
  // oder REFUNDED), ist die Erstattung Sache von cancelOrder — dann ist dies
  // nur eine Wiederholung des Ereignisses. (Bekannte Lücke dort: DEVELOPMENT.md,
  // „payment_failed stornierte endgültig", Offen.)
  if (order.status === 'CANCELLED' && (order.paymentStatus === 'PENDING' || order.paymentStatus === 'FAILED')) {
    await erstatteSpaeteZahlung(pi, order)
  }
  // Sonst schon bezahlt (PAID oder weiter im Ablauf): nichts zu tun.
}

/**
 * Nur vermerken. `payment_failed` ist bei Stripe KEIN Endzustand: Der
 * PaymentIntent bleibt bezahlbar, die Kundin kann es mit einer anderen Karte
 * gleich noch einmal versuchen. Bestellung und Bestand bleiben deshalb stehen;
 * endgültig beendet erst `payment_intent.canceled`.
 */
async function handlePaymentFailed(pi: Stripe.PaymentIntent) {
  await prisma.order.updateMany({
    where: { stripePaymentIntentId: pi.id, status: 'PENDING_CONFIRMATION' },
    data: { paymentStatus: 'FAILED' },
  })
}

/**
 * Stripe hat das Konto eines Hofs geändert — etwa gesperrt, weil Angaben
 * fehlen, oder wieder freigegeben. Vorher setzte nur das Onboarding
 * `stripeAccountReady`; eine spätere Sperre blieb unbemerkt, der Checkout bot
 * Online weiter an, und jede Zahlung scheiterte erst bei Stripe. Kein Hof mit
 * dieser Konto-ID (fremdes Konto, das Plattformkonto selbst): nichts zu tun.
 */
async function handleKontoAktualisiert(konto: Stripe.Account) {
  const hof = await prisma.farm.findFirst({ where: { stripeAccountId: konto.id }, select: { id: true } })
  if (!hof) return
  // Stripe liefert Ereignisse nicht garantiert in der richtigen Reihenfolge.
  // Ein verspätetes, älteres account.updated überschriebe sonst einen
  // neueren Stand — also den aktuellen nachlesen. Scheitert das: 500, Stripe
  // stellt erneut zu.
  // Kurze Leine: Hängt Stripe, bricht die Zustellung sonst ab und kommt erneut.
  const aktuell = await stripe.accounts.retrieve(konto.id, {}, { timeout: 10_000, maxNetworkRetries: 1 })
  await prisma.farm.update({
    where: { id: hof.id },
    data: { stripeAccountReady: stripeKontoBereit(aktuell) },
  })
}

/** Der PaymentIntent ist endgültig abgebrochen — jetzt erst stornieren und die Ware freigeben. */
async function handlePaymentCanceled(pi: Stripe.PaymentIntent) {
  const order = await prisma.order.findUnique({
    where: { stripePaymentIntentId: pi.id },
    select: { id: true },
  })
  if (!order) return

  await storniereUnbezahlteBestellung(order.id, 'Zahlung abgebrochen')
}

/**
 * Die Zahlung kam, als die Bestellung schon storniert und ihre Ware
 * freigegeben war: sofort voll erstatten. Wie beim Vollstorno
 * (ARCHITECTURE.md §5) mit reverse_transfer und — sobald die Zahlung eine
 * Gebühr trägt — refund_application_fee, sonst trüge die Plattform den
 * Warenpreis bzw. der Hof die Servicegebühr.
 *
 * Scheitert die Erstattung, wirft sie: 500, das Ereignis bleibt unverarbeitet
 * und Stripe stellt es erneut zu — derselbe Idempotenz-Schlüssel verhindert
 * dabei eine zweite Erstattung.
 *
 * AUSNAHME von „erst bedingt schreiben, dann Stripe" (ARCHITECTURE.md §5): Der
 * Vermerk REFUNDED darf erst stehen, wenn das Geld zurück ist — sonst sperrte
 * er die Wiederholung nach einer gescheiterten Erstattung aus. Vor doppelter
 * Erstattung schützt der Schlüssel, der Vermerk sperrt nur die Mail.
 */
async function erstatteSpaeteZahlung(pi: Stripe.PaymentIntent, order: BestellungStand) {
  // Alarm vor dem Geld: Der Betreiber soll den Fall sehen, auch wenn die
  // Erstattung scheitert. Nur die Bestell-ID, keine Kundendaten.
  Sentry.captureMessage('Zahlung nach dem Storno eingegangen — wird voll erstattet', {
    level: 'error',
    tags: { webhook: 'payment_intent.succeeded', grund: 'spaet_bezahlt' },
    extra: { orderId: order.id },
  })

  let erstattetCents: number
  try {
    const refund = await stripe.refunds.create(
      {
        payment_intent: pi.id,
        reverse_transfer: true,
        ...((pi.application_fee_amount ?? 0) > 0 ? { refund_application_fee: true } : {}),
      },
      { idempotencyKey: `spaet-bezahlt-${order.id}` }
    )
    erstattetCents = refund.amount
  } catch (err) {
    // Jeder Fehler hier heißt: Das Geld ist (noch) nicht zurück. Einen
    // 409 durch eine gleichzeitige Zustellung mit demselben Schlüssel
    // wiederholt das Stripe-SDK schon selbst; was danach noch übrig ist,
    // soll alarmieren.
    Sentry.captureException(err, {
      tags: { webhook: 'payment_intent.succeeded', grund: 'erstattung_offen' },
      extra: { orderId: order.id, handerstattung: 'Überweisung zurückbuchen und Plattformgebühr erstatten' },
    })
    throw err
  }

  // Der Vermerk ist die Sperre für die Mail: Zwei gleichzeitige Zustellungen
  // desselben Ereignisses erstatten beide (Stripe liefert über den Schlüssel
  // dieselbe Erstattung), aber nur wer den Vermerk setzt, schreibt der Kundin.
  // Vermerk und Auftrag der Mail in EINER Transaktion (Nr. 159), erst der
  // Vermerk. Der Auftrag kippt den Vermerk nie (Register N26, Ergänzung
  // 25.10.2026): Scheitert nur er, wird er nach dem Commit nachgeholt.
  // Getrennt abgefangen bleibt ein Fehler des Vermerks selbst: Das Geld ist
  // trotzdem zurück — dann wie bisher die Mail ohne Vermerk (der Schlüssel
  // `zahlung-zu-spaet:<orderId>` hält eine zweite auf). Ein Wurf hier hieße
  // 500 und eine Wiederholung, die nach Ablauf des Idempotenz-Schlüssels an
  // „schon erstattet" scheiterte.
  const auftrag = zahlungZuSpaetMailAuftrag(order, erstattetCents)
  let nachholen = false
  try {
    nachholen = await prisma.$transaction(async (tx) => {
      const { count } = await tx.order.updateMany({
        where: { id: order.id, status: 'CANCELLED', paymentStatus: { in: ['PENDING', 'FAILED'] } },
        data: { paymentStatus: 'REFUNDED' },
      })
      return count === 1 && (await stelleMailEinInTransaktion(auftrag, tx)) === 'nachholen'
    })
  } catch (err) {
    Sentry.captureException(err, {
      tags: { webhook: 'payment_intent.succeeded', grund: 'vermerk_fehlgeschlagen' },
      extra: { orderId: order.id },
    })
    nachholen = true
  }
  if (nachholen) await stelleEinOhneRisiko('zahlung-zu-spaet', order.id, auftrag)
}

/**
 * Eine Erstattung ist nach dem Buchen gescheitert (Nr. 19c): zurücknehmen,
 * was nachweislich unsere Buchung ist, und den Betreiber benachrichtigen
 * (Sentry + Mail) — einmal je Erstattung, auch wenn beide Ereignisse kommen.
 * Die Kundin bekommt keine Mail: Der Betreiber klärt die Erstattung erst.
 */
async function handleErstattungGescheitert(refund: Stripe.Refund, typ: 'refund.failed' | 'charge.refund.updated') {
  if (refund.status === 'succeeded') await loescheErstattungOffen(refund)
  const ausgang = await nimmGescheiterteErstattungZurueck(refund)
  if (ausgang.art === 'nicht_gescheitert') return
  // Die Aufgabe „Erstattung offen" im Admin-Postfach (Register N14), vor der
  // Meldesperre: auch ein zweites Ereignis derselben Erstattung setzt sie,
  // falls das erste Setzen scheiterte — die erste Zeit bleibt.
  if (ausgang.bestellung) await setzeErstattungOffen(ausgang.bestellung.id)
  // Genau eine Meldung je Erstattung, über einen Vermerk in der
  // Idempotenz-Tabelle der Ereignisse. Die Zurücknahme gelingt nur einmal und
  // legt den Vermerk in ihrer eigenen Transaktion an — sie meldet immer.
  // Alles andere meldet nur, wer den Vermerk als Erster anlegt; „schon
  // erledigt" nach einer Zurücknahme findet ihn also immer und bleibt still.
  // Ohne Vermerk meldet sich „schon erledigt" einmal: Die Datenbank zählt die
  // Erstattung nicht (mehr), das Geld steht trotzdem aus.
  if (ausgang.art !== 'zurueckgenommen' && !(await ersteMeldung(refund.id))) return

  const meldung = gescheitertMeldung(ausgang)
  const orderId = ausgang.bestellung?.id ?? null
  const handanweisung = erstattungOffenInhalt(meldung.fall, { kundinCents: refund.amount }).handanweisung
  // Nur Kennungen und Beträge — keine Daten der Kundin.
  Sentry.captureMessage(meldung.titel, {
    level: 'error',
    tags: { webhook: typ, grund: meldung.grund },
    extra: {
      orderId,
      refundId: refund.id,
      betragCents: refund.amount,
      failureReason: refund.failure_reason ?? null,
      ...(ausgang.art === 'zurueckgenommen'
        ? { anlass: ausgang.anlass, erstattetCentsVorher: ausgang.vorherCents, erstattetCentsNachher: ausgang.nachherCents, zahlungWiederOffen: ausgang.zahlungWiederOffen }
        : {}),
      ...(ausgang.art === 'unklar' ? { unklarGrund: ausgang.grund } : {}),
      handerstattung: handanweisung,
    },
  })
  // Je Empfänger ein Auftrag (Nr. 159); Satz und Anweisung wählt der Fall
  // beim Versand (src/lib/erstattung-offen.ts). Empfänger aus der Zustellung
  // (Register N14): „Erstattung offen" geht immer, auch bei Regel „aus".
  // Nach der Antwort und abgesichert wie bisher: ein Fehler kippt das Ereignis nicht.
  nachDerAntwort(async () => {
    await stelleEinOhneRisiko('erstattung-offen', orderId, async () => {
      const bezug = erstattungOffenBezug({ fall: meldung.fall, orderId, refundId: refund.id, kundinCents: refund.amount })
      return betreiberAuftraege('erstattung-offen', refund.id, await betreiberKennungen('erstattungOffen'), bezug, orderId ? { bestellungId: orderId } : {})
    })
  })
}

/**
 * Erstattung offen vermerken (Order.erstattungOffenSeit, Register N14) —
 * bedingt, die erste Zeit bleibt. Ein Nachlauf: Scheitert er, stehen Sentry
 * und Mail trotzdem, und die Verarbeitung des Ereignisses läuft weiter.
 */
async function setzeErstattungOffen(orderId: string): Promise<void> {
  try {
    await prisma.order.updateMany({ where: { id: orderId, erstattungOffenSeit: null }, data: { erstattungOffenSeit: new Date() } })
  } catch (err) {
    Sentry.captureException(err, { tags: { webhook: 'erstattung', grund: 'erstattung_offen_vermerk' }, extra: { orderId } })
  }
}

/**
 * Stripe meldet eine erfolgreiche Erstattung (charge.refund.updated) — der
 * bestehende Weg, auf dem der Betreiber eine offene Erstattung im
 * Plattformkonto nachholt. Gelöscht wird die Aufgabe nur, wenn die
 * Erstattung NACH dem Vermerk entstand: Eine ältere Teilerstattung derselben
 * Zahlung erledigt das offene Geld nicht. Nachlauf wie beim Setzen.
 */
async function loescheErstattungOffen(refund: Stripe.Refund): Promise<void> {
  const zahlung = typeof refund.payment_intent === 'string' ? refund.payment_intent : (refund.payment_intent?.id ?? null)
  // Fremddaten (Webhook): ohne Zahlung oder lesbaren Zeitpunkt nichts löschen.
  const erstellt = new Date(refund.created * 1000)
  if (!zahlung || Number.isNaN(erstellt.getTime())) return
  try {
    await prisma.order.updateMany({
      where: { stripePaymentIntentId: zahlung, erstattungOffenSeit: { lte: erstellt } },
      data: { erstattungOffenSeit: null },
    })
  } catch (err) {
    Sentry.captureException(err, { tags: { webhook: 'erstattung', grund: 'erstattung_offen_loeschen' }, extra: { refundId: refund.id } })
  }
}

/** Vermerkt, dass diese gescheiterte Erstattung gemeldet ist — false, wenn schon geschehen. */
async function ersteMeldung(refundId: string): Promise<boolean> {
  try {
    await prisma.webhookEvent.create({
      data: { stripeEventId: meldeVermerk(refundId), type: MELDE_VERMERK_TYP },
    })
    return true
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return false
    throw err
  }
}

/**
 * Titel und Grund für Sentry und der Fall für Satz und Anweisung
 * (src/lib/erstattung-offen.ts) — eine Quelle für Sentry und Mail.
 */
function gescheitertMeldung(ausgang: Exclude<GescheitertAusgang, { art: 'nicht_gescheitert' }>): {
  titel: string
  grund: string
  fall: ErstattungOffenFall
} {
  if (ausgang.art === 'schon_erledigt') {
    return { titel: 'Erstattung gescheitert — in der Datenbank nicht (mehr) gezählt', grund: 'erstattung_gescheitert_nicht_gezaehlt', fall: 'schon_erledigt' }
  }
  if (ausgang.art === 'zurueckgenommen' && ausgang.anlass === ANLASS_VOLLSTORNO) {
    return { titel: 'Vollerstattung gescheitert — Zahlung in der App wieder offen', grund: 'erstattung_gescheitert_zurueckgenommen', fall: 'vollstorno_zurueckgenommen' }
  }
  if (ausgang.art === 'zurueckgenommen') {
    return { titel: 'Erstattung gescheitert — in der Datenbank zurückgenommen', grund: 'erstattung_gescheitert_zurueckgenommen', fall: 'zurueckgenommen' }
  }
  if (ausgang.art === 'unklar') {
    return { titel: 'Erstattung gescheitert — Stand unklar, nichts geändert', grund: 'erstattung_gescheitert_unklar', fall: 'unklar' }
  }
  return { titel: 'Erstattung gescheitert — keiner Buchung der App zuzuordnen', grund: 'erstattung_gescheitert_fremd', fall: 'fremd' }
}
