'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { stripeKontoBereit } from '@/lib/stripe-konto'
import { APP_URL } from '@/lib/umgebung-server'
import { onlineZahlungEinschaltenSchema } from '@/schemas/online-zahlung'

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
  if (APP_URL.startsWith('https://')) return APP_URL
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
    business_type: 'individual',
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

  // Wer Stripe einrichtet, will online kassieren (Register Z1): Ein
  // Bestandshof mit acceptsOnline false aus der Zeit vor Z1 bliebe sonst
  // trotz fertigem Konto ohne Online-Zahlung (der Checkout fragt das Feld).
  await prisma.farm.update({
    where: { id: farm.id },
    data: { stripeAccountId: account.id, acceptsOnline: true },
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
  const returnPath = `/api/stripe/return?account_id=${farm.stripeAccountId}`

  const link = await stripe.accountLinks.create({
    account: farm.stripeAccountId,
    refresh_url: `${APP_URL}${returnPath}`,
    return_url: `${APP_URL}${returnPath}`,
    type: 'account_onboarding',
  })

  // Einrichtung fortsetzen heißt online kassieren wollen (Z1) — auch für ein
  // Konto, das vor Z1 angelegt wurde. Nur auf true, nur der eigene Hof.
  await prisma.farm.updateMany({ where: { id: farm.id }, data: { acceptsOnline: true } })

  return { url: link.url }
}

export async function checkConnectStatus(): Promise<{ ready: boolean; error?: string }> {
  const farm = await getAuthenticatedFarm()

  if (!farm.stripeAccountId) {
    return { ready: false }
  }

  const account = await stripe.accounts.retrieve(farm.stripeAccountId)
  // Dieselbe Regel wie account.updated (src/lib/stripe-konto.ts).
  const ready = stripeKontoBereit(account)

  await prisma.farm.update({
    where: { id: farm.id },
    data: { stripeAccountReady: ready },
  })

  revalidatePath('/settings/payments')
  return { ready }
}

/**
 * „Online-Zahlung einschalten" (Register Z1, Nachbesserung Nr. 24): für
 * Bestandshöfe, deren Stripe schon fertig ist, die aber noch
 * `acceptsOnline = false` tragen — sie richten Stripe nie wieder ein und
 * kämen sonst nie zur Online-Zahlung. Setzt NUR `acceptsOnline: true`, nur
 * für den Hof aus der Sitzung; einen Weg zurück auf false gibt es nicht.
 * Kein Stripe-Aufruf.
 */
export async function schalteOnlineZahlungEin(input: unknown): Promise<{ ok: true } | { error: string }> {
  const v = onlineZahlungEinschaltenSchema.safeParse(input)
  if (!v.success) return { error: 'Ungültige Eingabe.' }

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: 'Bitte melde dich neu an.' }

  const farm = await prisma.farm.findUnique({ where: { ownerId: session.user.id }, select: { id: true, slug: true } })
  if (!farm) return { error: 'Kein Hof gefunden.' }

  // Besitz in der WHERE-Klausel, nicht nur im Lesen davor.
  const { count } = await prisma.farm.updateMany({
    where: { id: farm.id, ownerId: session.user.id },
    data: { acceptsOnline: true },
  })
  if (count === 0) return { error: 'Wir konnten die Online-Zahlung gerade nicht einschalten. Lade die Seite neu und versuch es noch einmal.' }

  revalidatePath('/settings/payments')
  revalidatePath('/settings')
  revalidatePath('/dashboard')
  revalidatePath(`/${farm.slug}`)
  return { ok: true }
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
