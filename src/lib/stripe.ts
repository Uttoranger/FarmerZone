import 'server-only'
import Stripe from 'stripe'
import { env } from '@/lib/env'

// apiVersion explizit statt `{} as any`. Der Wert kommt aus dem SDK selbst:
// `Stripe.API_VERSION` ist als `typeof ApiVersion` typisiert und damit genau
// der Typ, den `StripeConfig.apiVersion` erwartet — kein Cast nötig.
//
// Verhalten unverändert: ohne apiVersion nutzt das SDK denselben Wert als
// Vorgabe (DEFAULT_API_VERSION = ApiVersion in stripe.core). Die Version steht
// jetzt nur sichtbar da, statt still aus der Paketvorgabe zu kommen — und sie
// wandert bei einem Paket-Update automatisch mit, statt hier zu driften.
export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: Stripe.API_VERSION,
})
