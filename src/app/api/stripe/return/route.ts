import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'

export async function GET(request: NextRequest) {
  const accountId = request.nextUrl.searchParams.get('account_id')

  if (!accountId) {
    return NextResponse.redirect(new URL('/settings/payments?stripe=error', request.url))
  }

  try {
    const account = await stripe.accounts.retrieve(accountId)
    const ready = !!(account.charges_enabled && account.details_submitted)

    await prisma.farm.update({
      where: { stripeAccountId: accountId },
      data: { stripeAccountReady: ready },
    })

    const status = ready ? 'success' : 'pending'
    return NextResponse.redirect(new URL(`/settings/payments?stripe=${status}`, request.url))
  } catch {
    return NextResponse.redirect(new URL('/settings/payments?stripe=error', request.url))
  }
}
