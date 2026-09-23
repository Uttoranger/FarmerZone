import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { getPublicFarm } from '@/server/queries/farm'
import { getBetriebsVorbelegung, getNurBetriebeProduktIds } from '@/server/queries/products'
import { CheckoutForm } from '@/components/checkout/checkout-form'

interface Props {
  params: Promise<{ farmSlug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { farmSlug } = await params
  const farm = await getPublicFarm(farmSlug)
  return { title: farm ? `Checkout — ${farm.name}` : 'Checkout' }
}

export default async function CheckoutPage({ params }: Props) {
  const { farmSlug } = await params
  const farm = await getPublicFarm(farmSlug)

  if (!farm || farm.isPaused) notFound()

  // Abschnitt „Betrieb" (Sprint Bereiche 1): welche Produkte nur an Betriebe
  // gehen, und — ist der Besteller selbst ein Hof — die Vorbelegung. Die
  // Session wird hier auf dem Server gelesen wie im Bauern-Bereich; kein
  // zusätzlicher Request aus dem Browser. Gast bleibt Gast.
  const session = await auth.api.getSession({ headers: await headers() })
  const [nurBetriebeIds, vorbelegung] = await Promise.all([
    getNurBetriebeProduktIds(farm.id),
    session?.user ? getBetriebsVorbelegung(session.user.id) : Promise.resolve(null),
  ])

  return (
    <div className="min-h-screen bg-background">
      <CheckoutForm farm={farm} nurBetriebeIds={nurBetriebeIds} vorbelegung={vorbelegung} />
    </div>
  )
}
