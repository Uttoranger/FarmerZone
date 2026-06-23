import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import type { Metadata } from 'next'
import { ChevronLeft } from 'lucide-react'
import { auth } from '@/lib/auth'
import { getFarmSettings } from '@/server/queries/farm'
import { PauseClient } from '@/components/settings/pause-client'

export const metadata: Metadata = { title: 'Pause / Urlaub — FarmerZone' }

export default async function PausePage() {
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

      <h1 className="text-xl font-semibold text-slate-800 mb-1">Pause / Urlaub</h1>
      <p className="text-sm text-slate-500 mb-6">
        Pausiere deinen Shop während Urlaub oder Betriebsferien.
        Bestehende Bestellungen bleiben erhalten.
      </p>

      <PauseClient
        initialPaused={farm.isPaused}
        initialMessage={farm.pauseMessage}
      />
    </div>
  )
}
