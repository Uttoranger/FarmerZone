import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getFarmForUser } from '@/server/queries/dashboard'
import { getMeldungenFuerHof } from '@/server/queries/meldung'
import { MELDUNG_ART_LABEL, ersteZeile } from '@/lib/meldung'
import { PageHeader } from '@/components/farmer/page-header'
import { Marke } from '@/components/ui/marke'

export const dynamic = 'force-dynamic'

/**
 * „Meine Meldungen" (Sprint fehlerbriefkasten, Teil C): nur die eigenen
 * Meldungen des Hofes (farmId der Sitzung, hart in der Query), nur die Felder
 * der Sichtbarkeitsregel — Art, Datum, erste Zeile, öffentlicher Status und
 * die Antwort des Betreibers, falls es eine gibt.
 */
export default async function MeineMeldungenPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')
  const farm = await getFarmForUser(session.user.id)
  if (!farm) redirect('/login')

  const meldungen = await getMeldungenFuerHof(farm.id)

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <PageHeader
        title="Meine Meldungen"
        action={
          <Link
            href="/fehler-melden"
            className="inline-flex min-h-10 items-center rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Fehler melden
          </Link>
        }
      />

      {meldungen.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
          Du hast noch nichts gemeldet — wenn dir etwas auffällt, findest du hier später den Stand.
        </p>
      ) : (
        <ul className="space-y-3">
          {meldungen.map((m) => (
            <li key={m.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{MELDUNG_ART_LABEL[m.art]}</span>
                  {' · '}
                  {m.createdAt.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Vienna' })}
                  {' · '}
                  <span className="font-mono">{m.kurznummer}</span>
                </div>
                <Marke farbe={m.statusFarbe}>{m.status}</Marke>
              </div>
              <p className="mt-2 text-sm text-foreground">{ersteZeile(m.text, 140)}</p>
              {m.antwortAnMelder && (
                <p className="mt-2 rounded-lg bg-muted/30 px-3 py-2 text-sm text-foreground">
                  <span className="text-xs font-medium text-muted-foreground">Antwort: </span>
                  {m.antwortAnMelder}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
