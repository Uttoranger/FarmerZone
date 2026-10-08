import 'server-only'
import Stripe from 'stripe'
import * as Sentry from '@sentry/nextjs'
import { env } from '@/lib/env'
import { UMGEBUNG } from '@/lib/umgebung-server'
import { stripeGesperrtMeldung, stripeStartGesperrt } from '@/lib/stripe-modus'

/**
 * Die Modus-Wache hat gesperrt (Register Z2): Vorschau oder lokal mit
 * Live-Schlüssel. Die Meldung nennt Umgebung und Ausweg, nie den Schlüssel.
 */
export class StripeModusGesperrt extends Error {
  constructor(meldung: string) {
    super(meldung)
    this.name = 'StripeModusGesperrt'
  }
}

let client: Stripe | null = null
// Einmal je Instanz: Jeder weitere Gebrauch wirft wieder, meldet aber nicht
// noch einmal — sonst stünde dieselbe Meldung bei jedem Seitenaufruf in Sentry.
let sperreGemeldet = false

function meldeSperre(art: 'preview' | 'lokal', meldung: string): void {
  if (sperreGemeldet) return
  sperreGemeldet = true
  console.error(`[Stripe] ${meldung}`)
  try {
    // Nur Umgebung und „live" — nie der Schlüssel oder ein Stück davon.
    Sentry.captureMessage('Stripe-Client nicht gestartet: Live-Schlüssel außerhalb der Produktion', {
      level: 'error',
      tags: { aufgabe: 'stripe-modus', umgebung: art, stripe: 'live' },
    })
  } catch {
    // Telemetrie scheitert leise; die Sperre selbst gilt trotzdem.
  }
}

/**
 * Der Stripe-Server-Client — erzeugt erst beim ersten Gebrauch, nie beim
 * Import. Warum so spät: Die Kasse, der Webhook und die Rückkehr aus dem
 * Onboarding importieren dieses Modul statisch. Würfe die Wache schon beim
 * Laden, fiele mit Stripe auch jede Bar-Bestellung aus.
 *
 * MODUS-WACHE (Register Z2, Nr. 42): In Vorschau und lokal (bestimmeUmgebung)
 * startet der Client mit Live-Schlüssel nicht. Der Modus kommt aus dem
 * Präfix (UMGEBUNG.stripe), gebaut wird der Client aus demselben Schlüssel.
 *
 * apiVersion explizit statt `{} as any`. Der Wert kommt aus dem SDK selbst:
 * `Stripe.API_VERSION` ist als `typeof ApiVersion` typisiert und damit genau
 * der Typ, den `StripeConfig.apiVersion` erwartet — kein Cast nötig. Ohne
 * apiVersion nutzte das SDK denselben Wert als Vorgabe; so steht er sichtbar
 * da und wandert bei einem Paket-Update mit.
 */
export function stripeClient(): Stripe {
  if (client) return client
  const { art } = UMGEBUNG
  // Gesperrt ist nie die Produktion — der zweite Vergleich sagt das dem Typ.
  if (stripeStartGesperrt(UMGEBUNG) && art !== 'produktion') {
    const meldung = stripeGesperrtMeldung(art)
    meldeSperre(art, meldung)
    throw new StripeModusGesperrt(meldung)
  }
  client = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: Stripe.API_VERSION })
  return client
}

/**
 * `stripe.paymentIntents.create(…)` wie bisher — jede Eigenschaft holt sich
 * den Client über `stripeClient()`, erst in diesem Moment greift die Wache.
 * So bleiben alle Aufrufer und ihre Test-Mocks (`vi.mock('@/lib/stripe')`)
 * unverändert.
 *
 * `then` und Symbole beantwortet der Stellvertreter selbst mit undefined: Ein
 * async-Rückgabewert wird auf `then` geprüft (teilerstattung.ts gibt den
 * Client so zurück), und diese Frage soll weder einen Client erzeugen noch
 * die Wache auslösen.
 */
export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_ziel, name) {
    if (typeof name === 'symbol' || name === 'then') return undefined
    const echt = stripeClient()
    const wert: unknown = Reflect.get(echt, name, echt)
    return typeof wert === 'function' ? wert.bind(echt) : wert
  },
})
