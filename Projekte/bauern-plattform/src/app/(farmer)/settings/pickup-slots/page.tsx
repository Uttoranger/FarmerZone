import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import type { Metadata } from 'next'
import { ChevronLeft } from 'lucide-react'
import { auth } from '@/lib/auth'
import { getFarmSettings } from '@/server/queries/farm'
import { PickupSlotsClient } from '@/components/settings/pickup-slots-client'

export const metadata: Metadata = { title: 'Abholzeiten — FarmerZone' }

export default async function PickupSlotsPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  const farm = await getFarmSettings(session.user.id)
  if (!farm) redirect('/login')

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 mb-6"
      >
        <ChevronLeft className="size-4" />
        Einstellungen
      </Link>

      <h1 className="text-xl font-semibold text-slate-800 mb-1">Abholzeiten</h1>
      <p className="text-sm text-slate-500 mb-6">
        Lege fest, wann Kunden ihre Bestellungen abholen können.
        Abholzeiten gelten für die nächsten 14 Tage ab heute.
      </p>

      <PickupSlotsClient initialSlots={farm.pickupSlots} />
    </div>
  )
}
