import Link from 'next/link'
import { headers } from 'next/headers'
import { ChevronLeft, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PaymentsActions } from './payments-actions'

export const metadata = { title: 'Zahlungen — Einstellungen' }

async function getFarmPaymentData() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null
  return prisma.farm.findUnique({
    where: { ownerId: session.user.id },
    select: {
      id: true,
      acceptsOnline: true,
      acceptsOnsite: true,
      stripeAccountId: true,
      stripeAccountReady: true,
    },
  })
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ stripe?: string }>
}) {
  const { stripe: stripeStatus } = await searchParams
  const farm = await getFarmPaymentData()
  if (!farm) return null

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ChevronLeft className="size-4" />
        Einstellungen
      </Link>

      <h1 className="text-xl font-semibold text-foreground mb-1">Zahlungen</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Verwalte, wie Kunden bezahlen können.
      </p>

      {stripeStatus === 'success' && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-primary/8 border border-green-200 px-4 py-3 text-sm text-green-800">
          <CheckCircle className="size-4 shrink-0" />
          Stripe-Konto erfolgreich eingerichtet! Online-Zahlung ist jetzt aktiv.
        </div>
      )}
      {stripeStatus === 'pending' && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          <Clock className="size-4 shrink-0" />
          Das Onboarding ist noch nicht vollständig abgeschlossen. Bitte setze es fort.
        </div>
      )}

      {/* Stripe Connect Status */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Online-Zahlung (Stripe)</CardTitle>
          <CardDescription>
            Kunden können mit Kreditkarte, SEPA-Lastschrift u.v.m. bezahlen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StripeStatusBadge
            accountId={farm.stripeAccountId}
            ready={farm.stripeAccountReady}
          />
          <PaymentsActions
            hasAccount={!!farm.stripeAccountId}
            isReady={farm.stripeAccountReady}
          />
        </CardContent>
      </Card>

      {/* ONSITE Info */}
      <Card>
        <CardHeader>
          <CardTitle>Vor-Ort-Zahlung</CardTitle>
          <CardDescription>
            Kunden zahlen bei der Abholung (Bar oder Karte).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-primary">
            <CheckCircle className="size-4" />
            Immer aktiv — keine Einrichtung nötig
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function StripeStatusBadge({
  accountId,
  ready,
}: {
  accountId: string | null
  ready: boolean
}) {
  if (!accountId) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <AlertCircle className="size-4" />
        Noch nicht verbunden
      </div>
    )
  }
  if (!ready) {
    return (
      <div className="flex items-center gap-2 text-sm text-amber-700 mb-4">
        <Clock className="size-4" />
        Onboarding unvollständig — bitte fortsetzen
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 text-sm text-primary mb-4">
      <CheckCircle className="size-4" />
      Verbunden und aktiv
    </div>
  )
}

