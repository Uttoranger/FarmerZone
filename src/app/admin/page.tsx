import type { Metadata } from 'next'
import Link from 'next/link'
import { verlangeAdminSeite } from '@/server/admin-wache'
import { getAdminFarms } from '@/server/queries/admin'
import { zaehleZuEntscheiden } from '@/server/queries/meldung'
import {
  gruendungsplaetze,
  vergebeneGruendungsplaetze,
  MAX_GRUENDUNGSHOEFE,
} from '@/lib/gruendungshof'
import { AdminFarmList } from './admin-farm-list'

export const metadata: Metadata = { title: 'Admin — FarmerZone' }

export default async function AdminPage() {
  await verlangeAdminSeite()

  const [farms, zuEntscheiden] = await Promise.all([getAdminFarms(), zaehleZuEntscheiden()])
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
        {/* Fehlerbriefkasten: der Zähler ist bewusst ein Link, kein Alarm. Er zählt,
            was auf dich wartet — Neues und die Wunsch-Vorschläge der KI. */}
        <Link
          href="/admin/meldungen"
          className="mb-5 flex min-h-11 items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-2.5 text-sm transition-colors hover:border-primary/40"
        >
          <span className="font-medium text-foreground">
            {zuEntscheiden === 0
              ? 'Keine Meldung wartet auf dich'
              : zuEntscheiden === 1
                ? '1 Meldung zu entscheiden'
                : `${zuEntscheiden} Meldungen zu entscheiden`}
          </span>
          <span className="text-xs text-primary">Briefkasten →</span>
        </Link>

        {/* Finanzen: kein Zähler davor. „Ab wann trägt sich die Plattform?"
            ist eine Frage, die man stellt, wenn man sie stellen will — kein
            Posten, der auf Erledigung wartet. */}
        <Link
          href="/admin/finanzen"
          className="mb-5 flex min-h-11 items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-2.5 text-sm transition-colors hover:border-primary/40"
        >
          <span className="font-medium text-foreground">Einnahmen und Kosten der Plattform</span>
          <span className="text-xs text-primary">Finanzen →</span>
        </Link>

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
