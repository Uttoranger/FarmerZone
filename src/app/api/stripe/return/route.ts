import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { istUnzugaenglichesStripeKonto } from '@/lib/stripe-konto'
import { schreibeStripeKontoStand } from '@/server/stripe-konto-stand'
import { meldeAbweichendesKontoLand, vermerkeUnbekanntesHofKonto } from '@/server/hofkonto-unbekannt'
import { alsLand } from '@/lib/laender'

export async function GET(request: NextRequest) {
  const accountId = request.nextUrl.searchParams.get('account_id')

  if (!accountId) {
    return NextResponse.redirect(new URL('/settings/payments?stripe=error', request.url))
  }

  // Ohne Session nichts preisgeben und nichts schreiben — einfach zum Login
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Ownership: die account_id aus der Query muss exakt die hinterlegte
  // Stripe-Konto-ID des angemeldeten Hofes sein. Sonst könnte ein
  // beliebiger Aufruf den Bereit-Status eines fremden Hofes umschreiben.
  const farm = await prisma.farm.findUnique({
    where: { ownerId: session.user.id },
    select: { id: true, country: true, stripeAccountId: true },
  })
  if (!farm || farm.stripeAccountId !== accountId) {
    return NextResponse.redirect(new URL('/settings/payments?stripe=error', request.url))
  }

  try {
    // Der Zeitpunkt VOR dem Lesen (Register N49): Ein Schreiber, der früher
    // gelesen hat, überschreibt nie einen, der später gelesen hat.
    const gelesenAm = new Date()
    const account = await stripe.accounts.retrieve(accountId)
    await meldeAbweichendesKontoLand(farm.id, account.country, alsLand(farm.country))

    // Dieselbe Regel und derselbe Schreiber wie account.updated (src/server/stripe-konto-stand.ts).
    const { bereit } = await schreibeStripeKontoStand({ farmId: farm.id, stripeAccountId: accountId, konto: account, gelesenAm })

    const status = bereit ? 'success' : 'pending'
    return NextResponse.redirect(new URL(`/settings/payments?stripe=${status}`, request.url))
  } catch (err) {
    // Stripe kennt das Konto nicht oder verweigert den Zugriff (Register Z2):
    // nicht bereit vermerken — die Kennung bleibt — und den Weg
    // „Online-Zahlung neu einrichten" zeigen.
    if (istUnzugaenglichesStripeKonto(err)) {
      await vermerkeUnbekanntesHofKonto(farm.id, accountId)
      return NextResponse.redirect(new URL('/settings/payments?stripe=neu', request.url))
    }
    return NextResponse.redirect(new URL('/settings/payments?stripe=error', request.url))
  }
}
