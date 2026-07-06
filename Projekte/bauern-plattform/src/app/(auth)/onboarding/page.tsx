import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getFarmForUser } from '@/server/queries/dashboard'
import { OnboardingClient } from './onboarding-client'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  const farm = await getFarmForUser(session.user.id)
  if (farm) redirect('/dashboard')

  return (
    <main
      className="min-h-screen px-4 py-12"
      style={{ background: 'linear-gradient(160deg, #F4EFE6 0%, #E8F0E8 55%, #FAFAF7 100%)' }}
    >
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4 shadow-[0_4px_16px_oklch(0.30_0.082_155_/_0.30)]">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M16 28 C16 28 6 22 6 13 C6 8 10.5 4 16 4 C21.5 4 26 8 26 13 C26 22 16 28 16 28Z" fill="white" opacity="0.9" />
            <path d="M16 28 L16 18" stroke="oklch(0.68 0.071 148)" strokeWidth="1.75" strokeLinecap="round" />
            <path d="M16 21 C13.5 19.5 10 19 8.5 16" stroke="oklch(0.68 0.071 148)" strokeWidth="1.25" strokeLinecap="round" />
          </svg>
        </div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Hof einrichten</h1>
        <p className="text-muted-foreground text-sm mt-1.5">
          Nur wenige Schritte bis zu deinem eigenen Bauernshop
        </p>
      </div>

      <OnboardingClient userEmail={session.user.email ?? ''} />
    </main>
  )
}


