import { NextRequest, NextResponse } from 'next/server'
import { enforceRateLimit } from '@/lib/rate-limit'
import { SHOP_PAUSED_MESSAGE } from '@/lib/shop-pause'
import { FARM_ARCHIVED_MESSAGE } from '@/lib/farm-archive'
import { FARM_NOT_APPROVED_MESSAGE } from '@/lib/farm-approval'
import { nanoid } from 'nanoid'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { sendOnsiteConfirmation } from '@/lib/email'
import { checkoutRequestSchema } from '@/schemas/checkout'
import { calcTotalAmount, calcPlatformFeeAmount, eurosToCents } from '@/lib/order-totals'
import { berechneServicegebuehr } from '@/lib/servicegebuehr'
import { pruefeSitzungsWarenkorb } from '@/server/warenkorb'
import { CODE_RESERVIERUNG_ABGELAUFEN } from '@/lib/reservierung'
import { nachDerAntwort } from '@/lib/nach-der-antwort'
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

  // 0. IDEMPOTENZ — vor allem anderen. Kennt der Server den Schlüssel schon,
  //    ist die Bestellung bereits angelegt; sie wird zurückgegeben, nichts
  //    Zweites entsteht, kein Bestand wird ein zweites Mal gebucht.
  if (data.idempotencyKey) {
    const bestehend = await prisma.order.findUnique({
      where: { idempotencyKey: data.idempotencyKey },
      select: { id: true, orderNumber: true, paymentMethod: true, stripePaymentIntentId: true },
    })
    if (bestehend) {
      if (bestehend.paymentMethod === 'ONLINE' && bestehend.stripePaymentIntentId) {
        // Für die Zahlungsmaske braucht der Browser das Client-Secret erneut.
        const intent = await stripe.paymentIntents.retrieve(bestehend.stripePaymentIntentId)
        return NextResponse.json({
          orderId: bestehend.id,
          orderNumber: bestehend.orderNumber,
          clientSecret: intent.client_secret,
          wiederholt: true,
        })
      }
      return NextResponse.json({
        orderId: bestehend.id,
        orderNumber: bestehend.orderNumber,
        requiresConfirmation: true,
        wiederholt: true,
      })
    }
  }

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
    return NextResponse.json({ error: FARM_ARCHIVED_MESSAGE }, { status: 409 })
  }

  // 1b². Freischaltung — nach der Stilllegung, aber VOR der Pause: ein noch
  // nicht freigeschalteter Hof darf keine Pausen-Meldung ausgeben, denn er
  // war nie offen (siehe src/lib/farm-approval.ts).
  if (!farm.approvedAt) {
    return NextResponse.json({ error: FARM_NOT_APPROVED_MESSAGE }, { status: 409 })
  }

  // 1c. Shop-Pause — fail-closed VOR jeder Bestell- und Zahlungslogik:
  // vor der Bestandsprüfung, vor prisma.order.create und vor jedem Stripe-Aufruf.
  // Eine ausgeblendete Schaltfläche ist keine Durchsetzung; die Wahrheit steht hier.
  if (farm.isPaused) {
    return NextResponse.json({ error: SHOP_PAUSED_MESSAGE }, { status: 409 })
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
    return NextResponse.json(
      {
        error: pruefung.meldung ?? 'Dein Warenkorb hat sich geändert.',
        code: pruefung.befund.etwasAbgelaufen ? CODE_RESERVIERUNG_ABGELAUFEN : 'WARENKORB_GEAENDERT',
        items: pruefung.berichtigt,
        positionen: pruefung.befund.positionen,
      },
      { status: 409 }
    )
  }

  // 3b. ABGABE UND MWST AUS DER DATENBANK (Sprint Bereiche 1). Der Warenkorb
  //     ist nie die Wahrheit: Ob ein Futtermittel nur an Betriebe geht und
  //     welcher MwSt-Satz gilt, steht am Produkt — nicht in dem, was der
  //     Browser schickt. Nur Produkte DIESES Hofs zählen.
  const produkte = await prisma.product.findMany({
    where: { id: { in: data.items.map((i) => i.productId) }, farmId: farm.id },
    select: { id: true, vatRate: true, abgabe: true },
  })
  const produktJeId = new Map(produkte.map((p) => [p.id, p]))
  if (data.items.some((i) => !produktJeId.has(i.productId))) {
    return NextResponse.json(
      { error: 'Dein Warenkorb hat sich geändert. Bitte prüfe ihn noch einmal.', code: 'WARENKORB_GEAENDERT' },
      { status: 409 }
    )
  }

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

  // 4. Find or create customer account (dormant — no password)
  let customer = await prisma.user.findUnique({
    where: { email: data.customerEmail },
    select: { id: true },
  })

  if (!customer) {
    customer = await prisma.user.create({
      data: {
        id: nanoid(),
        email: data.customerEmail,
        name: data.customerName,
        phone: data.customerPhone,
        role: 'CUSTOMER',
        emailVerified: false,
      },
      select: { id: true },
    })
  }

  // 5. Totals — totalAmount ist und bleibt der WARENPREIS (Umsatz des Hofes)
  const totalAmount = calcTotalAmount(data.items)
  const platformFeeAmount = calcPlatformFeeAmount(totalAmount, Number(farm.platformFeePercent))

  // 5b. Servicegebühr — aus der Hofeinstellung ZUM BESTELLZEITPUNKT berechnet
  //     und im Snapshot der Bestellung eingefroren (src/lib/servicegebuehr.ts).
  //     Der Browser zeigt dieselbe Rechnung vorab; verbindlich ist diese hier.
  const warenpreisCents = eurosToCents(totalAmount)
  const servicegebuehr = berechneServicegebuehr(warenpreisCents, farm, now)

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
  for (const item of data.items) {
    const res = await prisma.product.updateMany({
      where: { id: item.productId, stock: { gte: item.quantity } },
      data: { stock: { decrement: item.quantity } },
    })
    if (res.count === 0) {
      await gibBestandZurueck(gebucht)
      return NextResponse.json(
        {
          error: `"${item.name}" wurde gerade von jemand anderem gekauft. Bitte prüfe deinen Warenkorb.`,
          code: 'WARENKORB_GEAENDERT',
        },
        { status: 409 }
      )
    }
    gebucht.push({ productId: item.productId, quantity: item.quantity })
  }

  // 9. Bestellung anlegen. Scheitert das, wird der Bestand wieder gutgeschrieben —
  //    sonst wäre Ware verschwunden, die nie verkauft wurde.
  let order: { id: string; createdAt: Date }
  try {
    order = await prisma.order.create({
      data: {
        orderNumber,
        idempotencyKey: data.idempotencyKey ?? null,
        farmId: farm.id,
        customerId: customer.id,
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
        kaeuferArt: data.kaeuferArt,
        betriebsnummer: betriebsnummerFuerBestellung(data.kaeuferArt, data.betriebsnummer),
        items: {
          create: data.items.map((i) => ({
            productId: i.productId,
            productName: i.name,
            unitPrice: i.unitPrice,
            quantity: i.quantity,
            totalPrice: i.unitPrice * i.quantity,
            // SNAPSHOT des MwSt-Satzes — im selben create wie die Bestellung,
            // also atomar mit ihr. Später nie aus Product nachlesen, nie
            // rückwirkend ändern (Invariante ARCHITECTURE.md §5). Die Map ist
            // oben vollständig geprüft (3b).
            vatRate: produktJeId.get(i.productId)!.vatRate,
          })),
        },
      },
      select: { id: true, createdAt: true },
    })
  } catch (e) {
    await gibBestandZurueck(gebucht)
    // Zwei Requests mit demselben Schlüssel gleichzeitig: Der zweite läuft in
    // den eindeutigen Index. Dann gewinnt der erste, und der zweite bekommt
    // dessen Bestellung — kein Fehler für die Kundin.
    if (data.idempotencyKey) {
      const bestehend = await prisma.order.findUnique({
        where: { idempotencyKey: data.idempotencyKey },
        select: { id: true, orderNumber: true, paymentMethod: true, stripePaymentIntentId: true },
      })
      if (bestehend) {
        return NextResponse.json({
          orderId: bestehend.id,
          orderNumber: bestehend.orderNumber,
          requiresConfirmation: bestehend.paymentMethod !== 'ONLINE',
          wiederholt: true,
        })
      }
    }
    console.error('[/api/checkout] Bestellung konnte nicht angelegt werden', e)
    return NextResponse.json(
      { error: 'Die Bestellung konnte nicht angelegt werden. Bitte versuche es erneut.' },
      { status: 500 }
    )
  }

  // 10. Release session reservations
  await prisma.stockReservation.deleteMany({
    where: { sessionId: data.sessionId },
  })

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

  // 11a. ONLINE — create Stripe PaymentIntent
  if (data.paymentMethod === 'ONLINE') {
    // LADUNGSTYP: destination charge (transfer_data.destination) OHNE
    // on_behalf_of — die Zahlung entsteht auf dem PLATTFORMKONTO, Stripe zieht
    // seine Gebühren dort ab, der Hof bekommt amount − application_fee_amount
    // überwiesen. Deshalb: amount = Warenpreis + Servicegebühr und
    // application_fee_amount = Servicegebühr (+ Plattformgebühr, im Pilot 0)
    // → dem Hof fließt exakt der Warenpreis zu, FarmerZone trägt die
    // Stripe-Kosten aus der Servicegebühr.
    const amountCents = warenpreisCents + servicegebuehr.gebuehrCents
    const feeAmountCents = eurosToCents(platformFeeAmount) + servicegebuehr.gebuehrCents

    const intentParams: Parameters<typeof stripe.paymentIntents.create>[0] = {
      amount: amountCents,
      currency: 'eur',
      metadata: { orderId: order.id, orderNumber, farmId: farm.id },
      transfer_data: { destination: farm.stripeAccountId! },
    }
    if (feeAmountCents > 0) {
      intentParams.application_fee_amount = feeAmountCents
    }

    const paymentIntent = await stripe.paymentIntents.create(intentParams)

    await prisma.order.update({
      where: { id: order.id },
      data: { stripePaymentIntentId: paymentIntent.id },
    })

    return NextResponse.json({
      orderId: order.id,
      orderNumber,
      clientSecret: paymentIntent.client_secret,
    })
  }

  // 11b. ONSITE — Bestätigungs-Token jetzt, E-Mail NACH der Antwort.
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
          items: data.items.map((i) => ({
            productName: i.name,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            totalPrice: i.unitPrice * i.quantity,
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

  return NextResponse.json({ orderId: order.id, orderNumber, requiresConfirmation: true })
}
