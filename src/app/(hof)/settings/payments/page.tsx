import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { CircleAlert, CircleCheck, Clock } from 'lucide-react'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { StatusBadge } from '@/components/ui/status-badge'
import { KARTE } from '@/components/hof-bestellungen/stil'
import { EinstellungenKopf } from '@/components/hof-einstellungen/einstellungen-kopf'
import { UNTERSEITE_RAHMEN } from '@/components/hof-einstellungen/einstellungen-laden'
import { cn } from '@/lib/utils'
import { PaymentsActions } from './payments-actions'

export const metadata: Metadata = { title: 'Zahlung — FarmerZone' }

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

/*
 * Zahlung in der HofShell (Nachtlauf Nr. 22d). Gleiches Verhalten wie vorher:
 * Einrichten, Fortsetzen und Prüfen laufen nur über die bestehenden Actions
 * (stripe-connect.ts); die Seite ruft Stripe nicht selbst auf. Neu gezeichnet
 * mit Hinweiskarte und StatusBadge; ?stripe=error (Rückweg von Stripe) steht
 * jetzt inline da, statt still zu bleiben.
 */
export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ stripe?: string }>
}): Promise<React.JSX.Element | null> {
  const { stripe: stripeStatus } = await searchParams
  const farm = await getFarmPaymentData()
  if (!farm) return null

  return (
    <div className={UNTERSEITE_RAHMEN}>
      <EinstellungenKopf titel="Zahlung" satz="Verwalte, wie Kunden bezahlen können." />

      <div className="flex flex-col gap-4">
        {stripeStatus === 'success' && (
          <Hinweiskarte ton="gruen" symbol={CircleCheck}>
            Dein Stripe-Konto ist eingerichtet. Online-Zahlung ist jetzt aktiv.
          </Hinweiskarte>
        )}
        {stripeStatus === 'pending' && (
          <Hinweiskarte ton="orange" symbol={Clock}>
            Die Einrichtung bei Stripe ist noch nicht ganz fertig. Bitte setz sie fort.
          </Hinweiskarte>
        )}
        {stripeStatus === 'error' && (
          <Hinweiskarte ton="orange" symbol={CircleAlert}>
            Wir konnten den Stand bei Stripe gerade nicht prüfen. Versuch es bitte noch einmal.
          </Hinweiskarte>
        )}

        <section aria-labelledby="online-titel" className={cn(KARTE, 'p-5')}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 id="online-titel" className="text-[15.5px] font-semibold text-foreground">
                Online-Zahlung (Stripe)
              </h2>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                Kunden zahlen online mit Karte und weiteren Zahlungsarten.
              </p>
            </div>
            <StripeStatus accountId={farm.stripeAccountId} ready={farm.stripeAccountReady} />
          </div>
          <div className="mt-4">
            <PaymentsActions hasAccount={!!farm.stripeAccountId} isReady={farm.stripeAccountReady} />
          </div>
        </section>

        <section aria-labelledby="bar-titel" className={cn(KARTE, 'p-5')}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 id="bar-titel" className="text-[15.5px] font-semibold text-foreground">
                Bar bei Abholung
              </h2>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                Kunden zahlen bei der Abholung bar — keine Einrichtung nötig.
              </p>
            </div>
            <StatusBadge status="fertig">Immer aktiv</StatusBadge>
          </div>
        </section>
      </div>
    </div>
  )
}

function StripeStatus({ accountId, ready }: { accountId: string | null; ready: boolean }): React.JSX.Element {
  if (!accountId) return <StatusBadge status="neutral">Noch nicht verbunden</StatusBadge>
  if (!ready) return <StatusBadge status="offen">Einrichtung nicht fertig</StatusBadge>
  return <StatusBadge status="fertig">Verbunden und aktiv</StatusBadge>
}
