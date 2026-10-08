import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { istUnbekanntesStripeKonto, stripeKontoBereit } from '@/lib/stripe-konto'
import { vermerkeUnbekanntesHofKonto } from '@/server/hofkonto-unbekannt'

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
    select: { id: true, stripeAccountId: true },
  })
  if (!farm || farm.stripeAccountId !== accountId) {
    return NextResponse.redirect(new URL('/settings/payments?stripe=error', request.url))
  }

  try {
    const account = await stripe.accounts.retrieve(accountId)
    // Dieselbe Regel wie account.updated (src/lib/stripe-konto.ts).
    const ready = stripeKontoBereit(account)

    await prisma.farm.update({
      where: { id: farm.id },
      data: { stripeAccountReady: ready },
    })

    const status = ready ? 'success' : 'pending'
    return NextResponse.redirect(new URL(`/settings/payments?stripe=${status}`, request.url))
  } catch (err) {
    // Stripe kennt das Konto nicht (Register Z2): nicht bereit vermerken —
    // die Kennung bleibt — und den Weg „Online-Zahlung neu einrichten" zeigen.
    if (istUnbekanntesStripeKonto(err)) {
      await vermerkeUnbekanntesHofKonto(farm.id, accountId)
      return NextResponse.redirect(new URL('/settings/payments?stripe=neu', request.url))
    }
    return NextResponse.redirect(new URL('/settings/payments?stripe=error', request.url))
  }
}
