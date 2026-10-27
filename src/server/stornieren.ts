import { revalidatePath } from 'next/cache'
import * as Sentry from '@sentry/nextjs'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { stelleEinOhneRisiko, stelleMailEinInTransaktion, type EinstellAuftrag } from '@/server/mail-warteschlange'
import { stornoMailAuftrag, trageStornoErstattungEin } from '@/server/mail-arten/bestellung'
import { betreiberAuftraege, betreiberKennungen, erstattungOffenBezug } from '@/server/mail-arten/betreiber'
import { erstattungOffenInhalt } from '@/lib/erstattung-offen'
import type { ErstattungOffenFall } from '@/schemas/mail-auftrag'
import { erneuereHoflisteNachStorno } from '@/server/hofliste-erneuern'
import {
  nachTeilerstattung,
  onlineBezahlt,
  plattformgebuehrCents,
  restNachTeilerstattung,
  stornoBetraege,
  type RestStorno,
  type StornoBetraege,
} from '@/lib/storno'
import { alsCents } from '@/lib/order-totals'
import { ABHOLUNG_ERLEDIGT } from '@/lib/heute'
import { MELDE_VERMERK_TYP, meldeVermerk } from '@/server/erstattung-gescheitert'
import {
  StripeStandUnklar,
  bucheVomHofZurueck,
  erstatteKundin,
  erstattungZaehlt,
  hatErstattungen,
  ladeStripeStand,
  teilstornoSumme,
  vollstornoMerkmal,
} from '@/server/teilerstattung'

/*
 * Die EINE innere Storno-Funktion (Nr. 186, herausgezogen aus
 * src/server/actions/orders.ts, Verhalten gleich). Hier und nicht in der
 * Datei der Actions: Jeder Export einer Datei mit 'use server' ist ein
 * öffentlicher Endpunkt — `storniere` prüft weder Anmeldung noch Recht und
 * darf darum nie einer werden (tests/actions-in-actions-wache.test.ts).
 * Aufrufer: cancelOrder und meldeArtikelFehlt (Hof, eigener Hof aus der
 * Sitzung) und notfallStorno (Team, Hof aus der Bestellung, Recht
 * `hof_sperren_storno`). Stripe kommt erst im Aufruf per `await import()`.
 */

/** Was der Storno vor der Sperre liest — nur für den Vermerk der Servicegebühr. */
const STORNO_LESEN = { id: true, serviceFeeCents: true, serviceFeeRefundedAt: true } as const

/**
 * Was ein Storno zurückmeldet: die Beträge aus derselben Rechnung wie im
 * Storno-Dialog (src/lib/storno.ts), sobald Stripe erstattet hat — vor Ort
 * bezahlt beide 0. Scheitert die Erstattung, `erstattungOffen` statt Beträgen.
 */
export type StornoErgebnis = { error?: string } & {
  /** Was die Kundin zurückbekommen hat (Warenpreis + Servicegebühr). */
  erstattetCents?: number
  /** Was von der nächsten Auszahlung des Hofs abgezogen wird (Warenpreis). */
  vomHofCents?: number
  erstattungOffen?: boolean
}

/**
 * Welchen Weg die Erstattung eines Stornos nimmt: `voll` (nichts vorher
 * erstattet, reverse_transfer), `rest` (nach einer Teilerstattung, feste
 * Beträge) oder `unbekannt` (Stripe war nicht zu fragen, ob schon erstattet ist).
 */
type ErstattungsPfad = 'voll' | 'rest' | 'unbekannt'

/** Welcher Fall von „Erstattung offen" beim Storno vorliegt, mit den Beträgen — Satz und Anweisung aus src/lib/erstattung-offen.ts. */
type Handbuchung = { fall: ErstattungOffenFall; kundinCents?: number; hofCents?: number }

/**
 * Was der Betreiber von Hand tun muss, wenn die Erstattung eines Stornos
 * scheitert — passend zum Weg, der wirklich genommen wurde. Die Anweisung
 * geht an Sentry und (über den Fall) in die Mail an den Betreiber.
 */
function handbuchungFuer(pfad: ErstattungsPfad, rest: RestStorno | null, betraege: StornoBetraege): Handbuchung {
  if (pfad === 'rest' && rest) return { fall: 'storno_rest', kundinCents: rest.erstattungCents, hofCents: rest.vomHofCents }
  if (pfad === 'rest') return { fall: 'storno_rest_ohne_betraege' }
  if (pfad === 'voll') return { fall: 'storno_voll', kundinCents: betraege.erstattetCents, hofCents: betraege.vomHofCents }
  return { fall: 'storno_unbekannt' }
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
 * Der Storno einer Bestellung des Hofs `farm` — für „Stornieren" und für
 * „Artikel fehlt", wenn nichts mehr übrig bliebe (E14: dann ein normaler
 * Storno), und für den Notfall-Storno des Teams (N34,
 * src/server/actions/admin-bestellung.ts). Keine Server Action: Aufrufer
 * prüfen Anmeldung, Recht und Eingabe selbst; der Hof steht in jeder
 * WHERE-Klausel, eine fremde Bestellung ergibt „nicht gefunden".
 */
export async function storniere(farm: { id: string }, orderId: string, reason?: string): Promise<StornoErgebnis> {
  // Nur LESEN — die Daten für die Mail. Die Entscheidung, ob storniert werden
  // darf, fällt NICHT hier: eine Leseprüfung lassen zwei gleichzeitige Aufrufe
  // (Doppeltipp) beide passieren.
  const order = await prisma.order.findFirst({
    where: { id: orderId, farmId: farm.id },
    select: STORNO_LESEN,
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
  let storno: (Prisma.OrderGetPayload<{ select: typeof STORNO_STAND }> & { nachholen: EinstellAuftrag | null }) | null
  try {
    storno = await prisma.$transaction(async (tx) => {
      const { count } = await tx.order.updateMany({
        where: {
          id: orderId,
          farmId: farm.id,
          // Dieselbe Liste wie die Knöpfe des Hofs und des Teams (bestellAktionen, notfallStornoStand).
          status: { notIn: [...ABHOLUNG_ERLEDIGT] },
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
      // Die Storno-Mail als Auftrag in DERSELBEN Transaktion (Nr. 159, Punkt
      // 1). Online bezahlt steht der Betrag erst nach Stripe fest — dann
      // trägt der Auftrag `ausstehend`, der Betrag kommt unten nach
      // (trageStornoErstattungEin). Der Bezug hängt am Stand unter der Sperre,
      // geprüft wird darum erst hier. Der Auftrag kippt den Storno nie
      // (Register N26, Ergänzung 25.10.2026): Scheitert er, wird er direkt
      // nach dem Commit nachgeholt.
      const auftrag = stornoMailAuftrag({ id: orderId, farmId: farm.id }, onlineBezahlt(stand))
      const mail = await stelleMailEinInTransaktion(auftrag, tx)
      return { ...stand, nachholen: mail === 'nachholen' ? auftrag : null }
    })
  } catch (err) {
    // Zurückgerollt: nichts storniert, nichts zurückgebucht, kein Auftrag.
    Sentry.captureException(err, { tags: { aktion: 'cancelOrder', grund: 'nicht_gespeichert' }, extra: { orderId } })
    return { error: 'Wir konnten die Bestellung nicht stornieren. Versuch es bitte gleich noch einmal.' }
  }

  if (!storno) return { error: 'Diese Bestellung ist schon storniert oder abgeholt.' }
  // Direkt nach dem Commit, VOR Hofliste, Stripe und trageStornoErstattungEin:
  // Das Nachtragen schreibt nur in einen schon vorhandenen Auftrag — fehlte
  // er dann noch, bekäme die Kundin keine Storno-Mail.
  if (storno.nachholen) await stelleEinOhneRisiko('storniert', orderId, storno.nachholen)
  // Nach dem Commit: ein volles Abholfenster kann frei werden (Register N19, Ergänzung 21.10.2026).
  erneuereHoflisteNachStorno(orderId)

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
  // Was Stripe der Kundin erstattet hat, in Cent — null = keine Erstattung (bar, unbezahlt) oder offen.
  let erstattetStripeCents: number | null = null
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
        erstattetStripeCents = erstattet
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
        const { stripe } = await import('@/lib/stripe')
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
          throw new StripeStandUnklar('erstattung_gescheitert', { orderId: order.id, status: refund.status ?? 'unbekannt', refundId: refund.id })
        }
        erstattetStripeCents = refund.amount
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
          handerstattung: erstattungOffenInhalt(handbuchungOffen.fall, handbuchungOffen).handanweisung,
          ...(rest ? { erstattungCents: rest.erstattungCents, vomHofCents: rest.vomHofCents } : {}),
        },
      })
      erstattungOffen = true
      // Hat Stripe die Erstattung sofort als gescheitert zurückgegeben, ist
      // sie gebucht und gleich gemeldet (Sentry + Betreiber-Mail unten). Ein
      // späteres refund.failed derselben Erstattung fände „schon erledigt"
      // und meldete ein zweites Mal — der Vermerk hält es still
      // (src/server/erstattung-gescheitert.ts). Scheitert nur der Vermerk,
      // kommt die Meldung schlimmstenfalls doppelt.
      if (err instanceof StripeStandUnklar && err.grund === 'erstattung_gescheitert' && typeof err.extra.refundId === 'string') {
        try {
          await prisma.webhookEvent.createMany({
            data: [{ stripeEventId: meldeVermerk(err.extra.refundId), type: MELDE_VERMERK_TYP }],
            skipDuplicates: true,
          })
        } catch (vermerkFehler) {
          console.error('[cancelOrder] Meldevermerk nicht gesetzt:', vermerkFehler instanceof Error ? vermerkFehler.name : 'unbekannt')
        }
      }
    }

    // Die Aufgabe „Erstattung offen" im Admin-Postfach (Register N14):
    // bedingt gesetzt, die erste Zeit bleibt. Ein Nachlauf — scheitert er,
    // bleibt die Stornierung gültig, Sentry und Mail melden das Geld trotzdem.
    if (erstattungOffen) {
      try {
        await prisma.order.updateMany({ where: { id: orderId, erstattungOffenSeit: null }, data: { erstattungOffenSeit: new Date() } })
      } catch (err) {
        Sentry.captureException(err, { tags: { aktion: 'cancelOrder', grund: 'erstattung_offen_vermerk' }, extra: { orderId } })
      }
    }

    // Der Vermerk getrennt von der Erstattung: Scheitert NUR er, ist das
    // Geld trotzdem zurück — dann Erfolg an den Hof und Mail mit Betrag,
    // nur paymentStatus steht falsch auf PAID. Das bekommt der Betreiber
    // über Sentry zu sehen, nicht der Hof als „Erstattung fehlgeschlagen".
    // Mit dem Erstatten ist auch die Aufgabe „Erstattung offen" erledigt.
    if (erstattetStripeCents !== null) {
      try {
        await prisma.order.update({
          where: { id: orderId },
          data: { paymentStatus: 'REFUNDED', erstattungOffenSeit: null },
        })
      } catch (err) {
        Sentry.captureException(err, {
          tags: { aktion: 'cancelOrder', grund: 'vermerk_fehlgeschlagen' },
          extra: { orderId },
        })
      }
    }
  }

  // Was aus der Erstattung wurde, in den Storno-Auftrag (eingestellt schon in
  // der Transaktion oben): der Betrag, den Stripe gebucht hat, oder „offen" —
  // dann geht keine Storno-Mail, der Betreiber meldet sich mit der Erstattung.
  // Ein Fehler hier kippt den Storno nicht; der Auftrag bleibt `ausstehend`
  // und endet nach den Wiederholungen sichtbar als gescheitert.
  if (storno.stripePaymentIntentId && betraege) {
    const ausgang = erstattungOffen || erstattetStripeCents === null ? ('offen' as const) : { erstattetCents: erstattetStripeCents }
    try {
      await trageStornoErstattungEin(orderId, ausgang)
    } catch (err) {
      Sentry.captureException(err, { tags: { aktion: 'bestellmail', art: 'storniert', grund: 'erstattung_eintragen' }, extra: { orderId } })
    }
  }

  // Offenes Geld meldet sich auch beim Betreiber per Mail — der Hof kann
  // nicht erstatten (kein Zugang zum Plattformkonto). Je Empfänger ein
  // Auftrag; ein Fehler rollt nichts zurück. Ohne Daten der Kundin: Der
  // Auftrag trägt nur Fall, Beträge und die Bestellung.
  if (handbuchungOffen) {
    const hand = handbuchungOffen
    // Empfänger aus der Zustellung (Register N14): „Erstattung offen" geht immer, auch bei Regel „aus".
    await stelleEinOhneRisiko('erstattung-offen', orderId, async () =>
      betreiberAuftraege(
        'erstattung-offen',
        `storno-${orderId}`,
        await betreiberKennungen('erstattungOffen'),
        erstattungOffenBezug({ fall: hand.fall, orderId, refundId: null, kundinCents: hand.kundinCents, hofCents: hand.hofCents }),
        { bestellungId: orderId, farmId: farm.id }
      )
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
  return betraege && erstattetStripeCents !== null
    ? { erstattetCents: betraege.erstattetCents, vomHofCents: betraege.vomHofCents }
    : { erstattetCents: 0, vomHofCents: 0 }
}
