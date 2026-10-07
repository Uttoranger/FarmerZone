import * as Sentry from '@sentry/nextjs'
import { prisma } from '@/lib/prisma'
import { nachDerAntwort } from '@/lib/nach-der-antwort'
import { GRUND_NICHT_BESTAETIGT, GRUND_ZAHLUNG_VERFALLEN, fristVon, istVerwaist } from '@/lib/fristen'
import { storniereUnbezahlteBestellung } from '@/server/unbezahlte-bestellung'

/**
 * Verwaiste Bestellungen beenden und ihre Ware freigeben.
 *
 * Der Checkout bucht den Bestand vor der Zahlung (online) bzw. vor der
 * Bestätigung per E-Mail-Link (vor Ort). Wer nie zahlt oder nie klickt,
 * hinterlässt eine offene Bestellung, die ihre Ware festhält. Über ihrer
 * Frist (src/lib/fristen.ts) wird sie hier storniert.
 *
 * WER RUFT: alle, die Bestand lesen — die Hofseite, `/api/reserve`,
 * `/api/warenkorb/pruefen`, `/api/checkout`, die Bestätigung per Link, die
 * Bestellseite der Kundin und die Seiten Heute, Bestellungen und Produkte des
 * Hofs (Frist gilt beim Lesen). Dazu einmal
 * täglich der Cron für alle Höfe. Im Lesepfad nur über
 * `gibVerwaisteFreiOhneRisiko`: Ein Fehler hier darf den eigentlichen Request
 * nie scheitern lassen.
 *
 * MEHRFACH UND GLEICHZEITIG UNGEFÄHRLICH: Storniert wird über
 * `storniereUnbezahlteBestellung` — bedingt auf PENDING_CONFIRMATION, mit
 * Rückbuchung in derselben Transaktion. Zwei Aufrufe für dieselbe Bestellung
 * buchen einmal zurück; die Mail schickt nur, wer storniert hat.
 *
 * ONLINE ZUERST BEI STRIPE ABBRECHEN — Ausnahme von „erst bedingt
 * schreiben, dann Stripe" (ARCHITECTURE.md §5): Sonst könnte die Kundin die
 * verfallene Bestellung noch bezahlen. Ist der PaymentIntent inzwischen
 * bezahlt oder in Bearbeitung, bleibt die Bestellung unangetastet — der
 * Webhook gewinnt. Solche Bestellungen fragt der Lesepfad höchstens alle
 * paar Minuten erneut bei Stripe an (siehe `STRIPE_PAUSE_MS`).
 */

/** Diese Zustände kann Stripe noch abbrechen (`processing` nur selten — nicht anfassen). */
const ABBRECHBAR = new Set([
  'requires_payment_method',
  'requires_confirmation',
  'requires_action',
  'requires_capture',
])

/**
 * Eine überfällige Online-Bestellung, deren Zahlung bezahlt oder in
 * Bearbeitung ist, bleibt offen, bis der Webhook kommt — bei SEPA Tage. Ohne
 * Pause fragte JEDER Lesezugriff des Hofs Stripe erneut. Der Merker gilt je
 * Server-Instanz; ein Kaltstart fragt eben einmal mehr.
 */
const STRIPE_PAUSE_MS = 5 * 60 * 1000
const zuletztBeiStripe = new Map<string, number>()

/**
 * Die Mail nur für frisch verfallene Bestellungen — nicht für Wochen alte
 * Altfälle (Erstlauf nach dem Deploy). 48 statt 24 Stunden: Der Cron läuft
 * täglich, im Hobby-Tarif nur auf die Stunde genau; bei 24 Stunden fiele eine
 * Bestellung, deren Hof einen Tag lang niemand aufruft, knapp ohne Mail durch.
 */
const MAIL_HOECHSTENS_MS = 48 * 60 * 60 * 1000

/**
 * Stripe im Lesepfad kurz angebunden: Hofseite, Reservieren und Checkout
 * warten sonst bei einer Stripe-Störung bis zu 80 Sekunden je Versuch
 * (SDK-Vorgabe) — für eine Aufräumarbeit, die der nächste Aufruf nachholt.
 */
const STRIPE_KURZ = { timeout: 5000, maxNetworkRetries: 0 }

export type FreigabeErgebnis = {
  /** Von diesem Aufruf storniert. */
  storniert: number
  /** Über der Frist, aber bezahlt oder in Bearbeitung — stehen gelassen. */
  uebersprungen: number
  /** Ihre IDs — der Cron meldet sie: Bleiben sie stehen, fehlt vermutlich ein Webhook. */
  uebersprungenIds: string[]
  /** Gescheitert, an Sentry gemeldet; der nächste Aufruf versucht es erneut. */
  fehler: number
}

export async function gibVerwaisteBestellungenFrei(jetzt: Date, farmId?: string): Promise<FreigabeErgebnis> {
  const ergebnis: FreigabeErgebnis = { storniert: 0, uebersprungen: 0, uebersprungenIds: [], fehler: 0 }

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
        const zuletzt = zuletztBeiStripe.get(bestellung.id)
        const inPause = zuletzt !== undefined && jetzt.getTime() - zuletzt < STRIPE_PAUSE_MS
        if (inPause || !(await brichZahlungAb(bestellung.stripePaymentIntentId))) {
          if (!inPause) zuletztBeiStripe.set(bestellung.id, jetzt.getTime())
          ergebnis.uebersprungen += 1
          ergebnis.uebersprungenIds.push(bestellung.id)
          continue
        }
        zuletztBeiStripe.delete(bestellung.id)
        if (await storniereUnbezahlteBestellung(bestellung.id, GRUND_ZAHLUNG_VERFALLEN)) {
          ergebnis.storniert += 1
        }
        continue
      }

      if (await storniereUnbezahlteBestellung(bestellung.id, GRUND_NICHT_BESTAETIGT)) {
        ergebnis.storniert += 1
        // Lag die Frist lange zurück (Altfall vor diesem Fix), keine Mail:
        // Eine Nachricht zu einer Wochen alten Bestellung verwirrt mehr, als sie hilft.
        if (jetzt.getTime() - fristVon(bestellung).getTime() > MAIL_HOECHSTENS_MS) continue
        nachDerAntwort(async () => {
          try {
            // Erst hier geladen (Nr. 31): Die Seiten, die freigeben, ziehen den
            // E-Mail-Versand sonst bei jedem Kaltstart mit.
            const { sendBestellungVerfallen } = await import('@/lib/email')
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
      // Auch nach einem Fehler (Stripe gestört, Zeitüberschreitung) Pause —
      // sonst wartete jeder Lesezugriff des Hofs erneut auf Stripe.
      if (bestellung.paymentMethod === 'ONLINE') zuletztBeiStripe.set(bestellung.id, jetzt.getTime())
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

  // Stripe erst, wenn wirklich gefragt wird (Nr. 31) — die meisten Aufrufe
  // finden keine überfällige Online-Bestellung und brauchen das SDK nie.
  const { stripe } = await import('@/lib/stripe')
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {}, STRIPE_KURZ)
  if (intent.status === 'canceled') return true
  if (!ABBRECHBAR.has(intent.status)) return false

  try {
    await stripe.paymentIntents.cancel(paymentIntentId, { cancellation_reason: 'abandoned' }, STRIPE_KURZ)
    return true
  } catch (err) {
    // Zwischen Abfrage und Abbruch kann die Zahlung durchgegangen oder ein
    // zweiter Aufruf schneller gewesen sein. Nachsehen statt raten.
    const jetzt = await stripe.paymentIntents.retrieve(paymentIntentId, {}, STRIPE_KURZ)
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

/** Wie oben, für die Hofseite — sie kennt nur den Slug. */
export async function gibVerwaisteFreiFuerSlug(farmSlug: string, jetzt: Date = new Date()): Promise<void> {
  try {
    const hof = await prisma.farm.findUnique({ where: { slug: farmSlug }, select: { id: true } })
    if (hof) await gibVerwaisteFreiOhneRisiko(hof.id, jetzt)
  } catch (err) {
    console.error('[verwaiste-bestellungen] Hof zum Slug nicht lesbar')
    Sentry.captureException(err, { tags: { aufgabe: 'verwaiste-bestellungen' } })
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
