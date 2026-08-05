import { redirect, notFound } from 'next/navigation'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { getAdminUebersicht, istAdmin } from '@/server/queries/admin'
import { AdminHofListe } from './admin-hof-liste'

export const metadata: Metadata = { title: 'Admin — FarmerZone' }
export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  // Ohne Betreiber-Recht: notFound statt einer Fehlermeldung. Der Bereich soll
  // sich Unbefugten nicht zu erkennen geben — eine „Kein Zugriff"-Seite wäre
  // die Bestätigung, dass es ihn gibt.
  if (!(await istAdmin(session.user.id))) notFound()

  const { hoefe, vergebenePlaetze, maxPlaetze } = await getAdminUebersicht()
  const wartend = hoefe.filter((h) => h.approvedAt === null).length

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:py-10">
        <h1 className="font-heading text-2xl font-semibold text-foreground">Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Höfe freischalten und Gründungsplätze im Blick behalten.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Gründungsplätze vergeben</p>
            <p className="mt-1 font-heading text-2xl font-semibold text-foreground">
              {vergebenePlaetze} von {maxPlaetze}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Wartet auf Freigabe</p>
            <p className="mt-1 font-heading text-2xl font-semibold text-foreground">{wartend}</p>
          </div>
        </div>

        <AdminHofListe
          hoefe={hoefe.map((h) => ({
            ...h,
            createdAt: h.createdAt.toISOString(),
            approvedAt: h.approvedAt?.toISOString() ?? null,
            archivedAt: h.archivedAt?.toISOString() ?? null,
          }))}
          vergebenePlaetze={vergebenePlaetze}
          maxPlaetze={maxPlaetze}
        />
      </div>
    </div>
  )
}
