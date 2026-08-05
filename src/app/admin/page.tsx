import { redirect, notFound } from 'next/navigation'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { isAdminUser, getAdminFarms } from '@/server/queries/admin'
import {
  gruendungsplaetze,
  vergebeneGruendungsplaetze,
  MAX_GRUENDUNGSHOEFE,
} from '@/lib/gruendungshof'
import { AdminFarmList } from './admin-farm-list'

export const metadata: Metadata = { title: 'Admin — FarmerZone' }

export default async function AdminPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  // notFound statt redirect oder 403: Der Bereich soll sich Unbefugten nicht
  // einmal zu erkennen geben — für sie existiert /admin schlicht nicht.
  if (!(await isAdminUser(session.user.id))) notFound()

  const farms = await getAdminFarms()
  const wartend = farms.filter((f) => f.approvedAt === null).length

  // Plätze serverseitig berechnen und als schlichte Zahlen weiterreichen: die
  // Liste ist eine Client-Komponente und soll nicht selbst mit Datumswerten
  // rechnen müssen.
  const plaetze = gruendungsplaetze(farms)
  const vergebenePlaetze = vergebeneGruendungsplaetze(farms)
  const farmsMitPlatz = farms.map((f) => ({ ...f, gruendungsplatz: plaetze.get(f.id) ?? null }))

  return (
    <main className="min-h-screen bg-background px-4 py-8 md:px-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-xl font-semibold text-foreground mb-1">Höfe</h1>
        <p className="text-sm text-muted-foreground mb-1">
          {wartend === 0
            ? 'Kein Hof wartet auf Freischaltung.'
            : wartend === 1
              ? '1 Hof wartet auf Freischaltung.'
              : `${wartend} Höfe warten auf Freischaltung.`}
        </p>

        <p className="text-sm text-muted-foreground mb-6">
          Gründungsplätze vergeben: {vergebenePlaetze} von {MAX_GRUENDUNGSHOEFE}
        </p>

        <AdminFarmList farms={farmsMitPlatz} vergebenePlaetze={vergebenePlaetze} />
      </div>
    </main>
  )
}
