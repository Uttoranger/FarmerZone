import 'server-only'
import Stripe from 'stripe'
import { env } from '@/lib/env'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {} as any)
