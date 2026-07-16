'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'

async function getAuthenticatedFarm() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Nicht eingeloggt')
  const farm = await prisma.farm.findUnique({
    where: { ownerId: session.user.id },
    select: {
      id: true,
      name: true,
      slug: true,
      email: true,
      stripeAccountId: true,
      stripeAccountReady: true,
    },
  })
  if (!farm) throw new Error('Kein Hof gefunden')
  return farm
}

// Stripe requires a valid https:// URL; localhost is rejected even in test mode
function getPublicUrl(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  if (appUrl.startsWith('https://')) return appUrl
  return 'https://farmerzone.at'
}

export async function createConnectAccount(): Promise<{ error?: string }> {
  const farm = await getAuthenticatedFarm()

  if (farm.stripeAccountId) {
    return { error: 'Stripe-Konto bereits verbunden' }
  }

  const publicUrl = getPublicUrl()

  const account = await stripe.accounts.create({
    type: 'express',
    country: 'AT',
    email: farm.email,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    business_type: 'individual' as any,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_profile: {
      url: `${publicUrl}/${farm.slug}`,
      mcc: '5499', // Lebensmittel-Einzelhandel (Specialty Food Stores)
      product_description: 'Regionale Hofprodukte: Milch, Eier, Fleisch, Gemüse',
    },
  })

  await prisma.farm.update({
    where: { id: farm.id },
    data: { stripeAccountId: account.id },
  })

  revalidatePath('/settings/payments')
  return {}
}

export async function createOnboardingLink(): Promise<{ url?: string; error?: string }> {
  const farm = await getAuthenticatedFarm()

  if (!farm.stripeAccountId) {
    return { error: 'Stripe-Konto noch nicht angelegt. Bitte zuerst erstellen.' }
  }

  // AccountLink return/refresh URLs are browser redirects — Stripe allows http://localhost in test mode
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const returnPath = `/api/stripe/return?account_id=${farm.stripeAccountId}`

  const link = await stripe.accountLinks.create({
    account: farm.stripeAccountId,
    refresh_url: `${appUrl}${returnPath}`,
    return_url: `${appUrl}${returnPath}`,
    type: 'account_onboarding',
  })

  return { url: link.url }
}

export async function checkConnectStatus(): Promise<{ ready: boolean; error?: string }> {
  const farm = await getAuthenticatedFarm()

  if (!farm.stripeAccountId) {
    return { ready: false }
  }

  const account = await stripe.accounts.retrieve(farm.stripeAccountId)
  const ready = !!(account.charges_enabled && account.details_submitted)

  await prisma.farm.update({
    where: { id: farm.id },
    data: { stripeAccountReady: ready },
  })

  revalidatePath('/settings/payments')
  return { ready }
}

// Sprint 19 (Verkauf-Seite): Express-Dashboard-Login-Link für Auszahlungen.
// Entscheidung gegen eine "Nächste Auszahlung"-Karte: Stripe hat keinen
// Endpoint für KOMMENDE Auszahlungen (Payout-Objekte existieren erst nach
// Erstellung); Betrag/Datum wären eine Schätzung aus Balance + Payout-Schedule.
// Für Express-Konten ist der dokumentierte Weg der Login-Link ins
// Express-Dashboard (POST /v1/accounts/{id}/login_link, nur für Express).
export async function createStripeDashboardLinkAction(): Promise<{ url?: string; error?: string }> {
  try {
    const farm = await getAuthenticatedFarm()
    if (!farm.stripeAccountId || !farm.stripeAccountReady) {
      return { error: 'Stripe ist noch nicht eingerichtet' }
    }
    const link = await stripe.accounts.createLoginLink(farm.stripeAccountId)
    return { url: link.url }
  } catch (err) {
    console.error('[Stripe] Login-Link fehlgeschlagen:', err)
    return { error: 'Stripe-Übersicht gerade nicht erreichbar' }
  }
}
