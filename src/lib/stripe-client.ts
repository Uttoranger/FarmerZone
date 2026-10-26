import { loadStripe } from '@stripe/stripe-js/pure'
import type { Stripe } from '@stripe/stripe-js'

// Ein Promise je Seite (Memo). Der Eingang `/pure` lädt Stripe.js nicht schon beim Import, sondern erst
// beim ersten Aufruf von loadStripe() — also erst, wenn die Kasse die Zahlung online zeigt.
let stripePromise: Promise<Stripe | null> | null = null

export function getStripePromise(): Promise<Stripe | null> {
  if (!stripePromise) {
    stripePromise = loadStripe(
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''
    )
  }
  return stripePromise
}
