'use server'

import { headers } from 'next/headers'
import type Stripe from 'stripe'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NEU_EINRICHTEN_KURZ, istUnbekanntesStripeKonto, stripeKontoBereit } from '@/lib/stripe-konto'
import { vermerkeUnbekanntesHofKonto } from '@/server/hofkonto-unbekannt'
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

/**
 * Stripe-Konto anlegen — und „Online-Zahlung neu einrichten" (Register Z2,
 * Nr. 42): Steht schon eine Kennung da, wird sie NUR ersetzt, wenn Stripe das
 * alte Konto in diesem Moment nachweislich nicht kennt (etwa ein Test-Konto
 * nach der Live-Umstellung). Das ist nie automatisch, sondern nur dieser
 * Knopfdruck des Hofs; kennt Stripe das Konto, bleibt alles, wie es war.
 * Ersetzt wird bedingt auf die alte Kennung — ein zweiter Tab, der schon neu
 * eingerichtet hat, wird nicht überschrieben.
 */
export async function createConnectAccount(): Promise<{ error?: string }> {
  const farm = await getAuthenticatedFarm()

  // Stripe erst im Aufruf (Nr. 31): /settings/payments und /sales binden
  // diese Actions ein und zögen das SDK sonst in jeden Kaltstart.
  const { stripe } = await import('@/lib/stripe')

  if (farm.stripeAccountId) {
    try {
      await stripe.accounts.retrieve(farm.stripeAccountId)
      return { error: 'Stripe-Konto bereits verbunden' }
    } catch (err) {
      // Nur „Stripe kennt es nicht" öffnet den Weg; jeder andere Fehler
      // (Ausfall, Sperre) ersetzt nichts.
      if (!istUnbekanntesStripeKonto(err)) throw err
    }
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
  if (farm.stripeAccountId) {
    const { count } = await prisma.farm.updateMany({
      where: { id: farm.id, stripeAccountId: farm.stripeAccountId },
      data: { stripeAccountId: account.id, stripeAccountReady: false, acceptsOnline: true },
    })
    if (count === 0) {
      return { error: 'Deine Online-Zahlung wurde gerade schon neu eingerichtet. Lade die Seite neu.' }
    }
  } else {
    await prisma.farm.update({
      where: { id: farm.id },
      data: { stripeAccountId: account.id, acceptsOnline: true },
    })
  }

  revalidatePath('/settings/payments')
  return {}
}

export async function createOnboardingLink(): Promise<{ url?: string; error?: string; kontoUnbekannt?: true }> {
  const farm = await getAuthenticatedFarm()

  if (!farm.stripeAccountId) {
    return { error: 'Stripe-Konto noch nicht angelegt. Bitte zuerst erstellen.' }
  }

  // AccountLink return/refresh URLs are browser redirects — Stripe allows http://localhost in test mode
  const returnPath = `/api/stripe/return?account_id=${farm.stripeAccountId}`

  const { stripe } = await import('@/lib/stripe')
  let link: { url: string }
  try {
    link = await stripe.accountLinks.create({
      account: farm.stripeAccountId,
      refresh_url: `${APP_URL}${returnPath}`,
      return_url: `${APP_URL}${returnPath}`,
      type: 'account_onboarding',
    })
  } catch (err) {
    // Stripe kennt das Konto nicht (Register Z2): Fortsetzen geht nicht,
    // der Hof richtet neu ein — die Seite zeigt ihm den Weg (?stripe=neu).
    if (!istUnbekanntesStripeKonto(err)) throw err
    await vermerkeUnbekanntesHofKonto(farm.id, farm.stripeAccountId)
    revalidatePath('/settings/payments')
    return { error: NEU_EINRICHTEN_KURZ, kontoUnbekannt: true }
  }

  // Einrichtung fortsetzen heißt online kassieren wollen (Z1) — auch für ein
  // Konto, das vor Z1 angelegt wurde. Nur auf true, nur der eigene Hof.
  await prisma.farm.updateMany({ where: { id: farm.id }, data: { acceptsOnline: true } })

  return { url: link.url }
}

export async function checkConnectStatus(): Promise<{ ready: boolean; error?: string; kontoUnbekannt?: true }> {
  const farm = await getAuthenticatedFarm()

  if (!farm.stripeAccountId) {
    return { ready: false }
  }

  const { stripe } = await import('@/lib/stripe')
  let account: Stripe.Account
  try {
    account = await stripe.accounts.retrieve(farm.stripeAccountId)
  } catch (err) {
    // Stripe kennt das Konto nicht (Register Z2): nicht bereit vermerken —
    // bedingt, die Kennung bleibt — und den Weg zum Neu-Einrichten zeigen.
    if (!istUnbekanntesStripeKonto(err)) throw err
    await vermerkeUnbekanntesHofKonto(farm.id, farm.stripeAccountId)
    revalidatePath('/settings/payments')
    return { ready: false, kontoUnbekannt: true }
  }
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
  let hof: { id: string; konto: string } | null = null
  try {
    const farm = await getAuthenticatedFarm()
    if (!farm.stripeAccountId || !farm.stripeAccountReady) {
      return { error: 'Stripe ist noch nicht eingerichtet' }
    }
    hof = { id: farm.id, konto: farm.stripeAccountId }
    const { stripe } = await import('@/lib/stripe')
    const link = await stripe.accounts.createLoginLink(farm.stripeAccountId)
    return { url: link.url }
  } catch (err) {
    // Stripe kennt das Konto nicht (Register Z2): vermerken und den Weg
    // zum Neu-Einrichten nennen, statt „gerade nicht erreichbar".
    if (hof && istUnbekanntesStripeKonto(err)) {
      await vermerkeUnbekanntesHofKonto(hof.id, hof.konto)
      return { error: NEU_EINRICHTEN_KURZ }
    }
    console.error('[Stripe] Login-Link fehlgeschlagen:', err)
    return { error: 'Stripe-Übersicht gerade nicht erreichbar' }
  }
}
