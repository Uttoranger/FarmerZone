import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getFarmForUser } from '@/server/queries/dashboard'
import { generateFormToken } from '@/lib/form-token'
import { PageHeader } from '@/components/farmer/page-header'
import { MeldungForm } from '@/components/shared/meldung-form'

export const dynamic = 'force-dynamic'

export default async function FehlerMeldenPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')
  const farm = await getFarmForUser(session.user.id)
  if (!farm) redirect('/login')

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <PageHeader
        title="Fehler melden"
        subtitle="Fehler, Wunsch oder Frage — alles landet im Briefkasten des Betreibers."
      />
      {/* Zeitschranke: ein Token je Seitenaufbau, Zweck 'meldung' */}
      <MeldungForm formToken={generateFormToken('meldung')} alsHof hofName={farm.name} />
    </div>
  )
}
