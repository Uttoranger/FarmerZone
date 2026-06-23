import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import type { Metadata } from 'next'
import { ChevronLeft } from 'lucide-react'
import { auth } from '@/lib/auth'
import { getFarmSettings } from '@/server/queries/farm'
import { ProfileForm } from '@/components/settings/profile-form'

export const metadata: Metadata = { title: 'Hof-Profil — FarmerZone' }

export default async function ProfileSettingsPage() {
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

      <h1 className="text-xl font-semibold text-slate-800 mb-1">Hof-Profil</h1>
      <p className="text-sm text-slate-500 mb-6">
        Informationen, die auf deiner öffentlichen Hof-Seite sichtbar sind.
      </p>

      <ProfileForm farm={farm} />
    </div>
  )
}
