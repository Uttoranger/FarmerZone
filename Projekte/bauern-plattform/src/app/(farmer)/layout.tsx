import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { FarmerNav } from '@/components/farmer/farmer-nav'

export default async function FarmerLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session?.user) {
    redirect('/login')
  }

  const role = (session.user as typeof session.user & { role: string }).role
  if (role !== 'FARMER') {
    redirect('/login')
  }

  const farmName = (session.user as typeof session.user & { name: string | null }).name ?? 'Mein Hof'

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop: Sidebar + Content nebeneinander */}
      <div className="flex min-h-screen">
        <FarmerNav farmName={farmName} userName={session.user.name ?? ''} />

        {/* Hauptinhalt */}
        <main className="flex-1 pb-24 md:pb-0 md:ml-56">
          {children}
        </main>
      </div>
    </div>
  )
}
