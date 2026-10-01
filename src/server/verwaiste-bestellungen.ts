import * as Sentry from '@sentry/nextjs'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { sendBestellungVerfallen } from '@/lib/email'
import { nachDerAntwort } from '@/lib/nach-der-antwort'
import { GRUND_NICHT_BESTAETIGT, GRUND_ZAHLUNG_VERFALLEN, istVerwaist } from '@/lib/fristen'
import { storniereUnbezahlteBestellung } from '@/server/unbezahlte-bestellung'

/**
 * Verwaiste Bestellungen beenden und ihre Ware freigeben.
 *
 * Der Checkout bucht den Bestand vor der Zahlung (online) bzw. vor der
 * Bestätigung per E-Mail-Link (vor Ort). Wer nie zahlt oder nie klickt,
 * hinterlässt eine offene Bestellung, die ihre Ware festhält. Über ihrer
 * Frist (src/lib/fristen.ts) wird sie hier storniert.
 *
 * WER RUFT: alle, die Bestand lesen — `/api/reserve`, `/api/warenkorb/pruefen`,
 * `/api/checkout`, die Bestätigung per Link und die Seiten Heute,
 * Bestellungen und Produkte des Hofs (Frist gilt beim Lesen). Dazu einmal
 * täglich der Cron für alle Höfe. Im Lesepfad nur über
 * `gibVerwaisteFreiOhneRisiko`: Ein Fehler hier darf den eigentlichen Request
 * nie scheitern lassen.
 *
 * MEHRFACH UND GLEICHZEITIG UNGEFÄHRLICH: Storniert wird über
 * `storniereUnbezahlteBestellung` — bedingt auf PENDING_CONFIRMATION, mit
 * Rückbuchung in derselben Transaktion. Zwei Aufrufe für dieselbe Bestellung
 * buchen einmal zurück; die Mail schickt nur, wer storniert hat.
 *
 * ONLINE ZUERST BEI STRIPE ABBRECHEN: Sonst könnte die Kundin die verfallene
 * Bestellung noch bezahlen. Ist der PaymentIntent inzwischen bezahlt oder in
 * Bearbeitung, bleibt die Bestellung unangetastet — der Webhook gewinnt.
 */

/** Diese Zustände kann Stripe noch abbrechen (`processing` nur selten — nicht anfassen). */
const ABBRECHBAR = new Set([
  'requires_payment_method',
  'requires_confirmation',
  'requires_action',
  'requires_capture',
])

export type FreigabeErgebnis = {
  /** Von diesem Aufruf storniert. */
  storniert: number
  /** Über der Frist, aber bezahlt oder in Bearbeitung — stehen gelassen. */
  uebersprungen: number
  /** Gescheitert, an Sentry gemeldet; der nächste Aufruf versucht es erneut. */
  fehler: number
}

export async function gibVerwaisteBestellungenFrei(jetzt: Date, farmId?: string): Promise<FreigabeErgebnis> {
  const ergebnis: FreigabeErgebnis = { storniert: 0, uebersprungen: 0, fehler: 0 }

  // Alle offenen Bestellungen des Hofs — wenige Zeilen. Die Frist hängt bei
  // vor Ort auch am Abholfenster und wird deshalb hier gerechnet, nicht in SQL.
  const offene = await prisma.order.findMany({
    where: { status: 'PENDING_CONFIRMATION', ...(farmId ? { farmId } : {}) },
    select: {
      id: true,
      paymentMethod: true,
      createdAt: true,
      pickupDate: true,
      pickupTimeStart: true,
      stripePaymentIntentId: true,
      orderNumber: true,
      customerName: true,
      customerEmail: true,
      farm: { select: { name: true } },
    },
  })

  for (const bestellung of offene) {
    if (!istVerwaist(bestellung, jetzt)) continue
    try {
      if (bestellung.paymentMethod === 'ONLINE') {
        if (!(await brichZahlungAb(bestellung.stripePaymentIntentId))) {
          ergebnis.uebersprungen += 1
          continue
        }
        if (await storniereUnbezahlteBestellung(bestellung.id, GRUND_ZAHLUNG_VERFALLEN)) {
          ergebnis.storniert += 1
        }
        continue
      }

      if (await storniereUnbezahlteBestellung(bestellung.id, GRUND_NICHT_BESTAETIGT)) {
        ergebnis.storniert += 1
        nachDerAntwort(async () => {
          try {
            await sendBestellungVerfallen(bestellung)
          } catch (err) {
            Sentry.captureException(err, {
              tags: { aufgabe: 'verwaiste-bestellungen', mail: 'bestellung_verfallen' },
              extra: { orderId: bestellung.id },
            })
          }
        })
      }
    } catch (err) {
      ergebnis.fehler += 1
      // Nur die Bestell-ID — keine Kundendaten (sentry-hygiene.ts filtert zusätzlich).
      Sentry.captureException(err, {
        tags: { aufgabe: 'verwaiste-bestellungen' },
        extra: { orderId: bestellung.id },
      })
    }
  }

  return ergebnis
}

/**
 * Bricht den PaymentIntent ab. `true`: Die Bestellung darf storniert werden
 * (abgebrochen, schon abgebrochen oder nie entstanden). `false`: Stripe hat
 * bezahlt oder bearbeitet gerade — stehen lassen.
 */
async function brichZahlungAb(paymentIntentId: string | null): Promise<boolean> {
  // Kein Intent: Der Checkout scheiterte nach dem Anlegen der Bestellung.
  // Es gibt nichts, womit die Kundin noch zahlen könnte.
  if (!paymentIntentId) return true

  const intent = await stripe.paymentIntents.retrieve(paymentIntentId)
  if (intent.status === 'canceled') return true
  if (!ABBRECHBAR.has(intent.status)) return false

  try {
    await stripe.paymentIntents.cancel(paymentIntentId, { cancellation_reason: 'abandoned' })
    return true
  } catch (err) {
    // Zwischen Abfrage und Abbruch kann die Zahlung durchgegangen oder ein
    // zweiter Aufruf schneller gewesen sein. Nachsehen statt raten.
    const jetzt = await stripe.paymentIntents.retrieve(paymentIntentId)
    if (jetzt.status === 'canceled') return true
    if (!ABBRECHBAR.has(jetzt.status)) return false
    throw err
  }
}

/**
 * Für den Lesepfad: freigeben, aber nie den eigentlichen Request scheitern
 * lassen. Ein Fehler wird gemeldet; der nächste Aufruf versucht es erneut.
 */
export async function gibVerwaisteFreiOhneRisiko(farmId: string, jetzt: Date = new Date()): Promise<void> {
  try {
    await gibVerwaisteBestellungenFrei(jetzt, farmId)
  } catch (err) {
    console.error('[verwaiste-bestellungen] Freigabe fehlgeschlagen für Hof', farmId)
    Sentry.captureException(err, { tags: { aufgabe: 'verwaiste-bestellungen' }, extra: { farmId } })
  }
}

/** Wie oben, für Requests, die nur Produkte kennen (Reservieren, Warenkorb prüfen). */
export async function gibVerwaisteFreiFuerProdukte(productIds: readonly string[], jetzt: Date = new Date()): Promise<void> {
  if (productIds.length === 0) return
  try {
    const hoefe = await prisma.product.findMany({
      where: { id: { in: [...productIds] } },
      select: { farmId: true },
      distinct: ['farmId'],
    })
    for (const { farmId } of hoefe) {
      await gibVerwaisteFreiOhneRisiko(farmId, jetzt)
    }
  } catch (err) {
    console.error('[verwaiste-bestellungen] Höfe der Produkte nicht lesbar')
    Sentry.captureException(err, { tags: { aufgabe: 'verwaiste-bestellungen' } })
  }
}
