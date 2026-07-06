import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getPublicFarm } from '@/server/queries/farm'
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

  return (
    <div className="min-h-screen bg-background">
      <CheckoutForm farm={farm} />
    </div>
  )
}
