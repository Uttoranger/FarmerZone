import Link from 'next/link'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getFarmForUser } from '@/server/queries/dashboard'
import { getUmfeld, type UmfeldDaten } from '@/server/queries/umfeld'
import { baueUmfeld, standardBereich, type UmfeldKm } from '@/lib/umfeld'
import type { AnzeigeBereich } from '@/lib/taxonomie'
import { leseUmfeldFilter, umfeldLink } from '@/schemas/umfeld-filter'
import { PageHeader } from '@/components/farmer/page-header'
import { AuswertungReiter } from '@/components/analytics/auswertung-reiter'
import { UmfeldKopf } from '@/components/analytics/umfeld-kopf'
import { UmfeldListe } from '@/components/analytics/umfeld-liste'

/**
 * Auswertung → Umfeld: was andere Höfe in der Nähe anbieten
 * (docs/konzepte/umfeld.md). Die Query bekommt nur die farmId aus der
 * Sitzung; Umkreis und Bereich kommen aus der URL und laufen durch Zod.
 * Entschieden und formatiert wird alles in src/lib/umfeld.ts — hier wird nur
 * zusammengesetzt.
 */
export default async function UmfeldPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  const farm = await getFarmForUser(session.user.id)
  if (!farm) redirect('/login')

  const filter = leseUmfeldFilter(await searchParams)
  const daten = await getUmfeld(farm.id, filter.km)
  if (!daten) redirect('/login')

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto">
      <PageHeader title="Auswertung" subtitle="Was andere Höfe in der Nähe anbieten" />
      <AuswertungReiter aktiv="umfeld" />

      {!daten.eigenerStandort ? (
        <div className="rounded-xl border border-border bg-card p-5 dark:ring-1 dark:ring-border">
          <p className="text-sm text-foreground">
            Trag deine Adresse ein, dann zeigen wir dir Höfe in der Nähe.
          </p>
          <Link
            href="/settings/profile"
            className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-brand-text underline-offset-4 hover:underline"
          >
            Zu den Hof-Einstellungen
          </Link>
        </div>
      ) : (
        <UmfeldInhalt daten={daten} km={filter.km} bereichWunsch={filter.bereich} />
      )}
    </div>
  )
}

function UmfeldInhalt({
  daten,
  km,
  bereichWunsch,
}: {
  daten: Extract<UmfeldDaten, { eigenerStandort: true }>
  km: UmfeldKm
  /** null = nicht gewählt → der Bereich mit den meisten eigenen Produkten. */
  bereichWunsch: AnzeigeBereich | null
}) {
  const bereich = bereichWunsch ?? standardBereich(daten.eigeneProdukte)
  const ansicht = baueUmfeld({ ...daten, bereich, km })

  return (
    <>
      <UmfeldKopf bereich={bereich} km={km} />
      <p className="mb-3 text-xs text-muted-foreground">
        Luftlinie ab deinem Hof. Nur Höfe, die gerade verkaufen — je Hof zählt sein günstigstes Angebot.
      </p>
      {ansicht.hinweise.map((hinweis) => (
        <p key={hinweis} className="mb-3 text-xs text-muted-foreground">
          {hinweis}
        </p>
      ))}
      {ansicht.leer ? (
        <div className="rounded-xl border border-border bg-card p-5 dark:ring-1 dark:ring-border">
          <p className="text-sm text-foreground">{ansicht.leer}</p>
          {ansicht.weiterUmkreis && (
            <Link
              href={umfeldLink({ km: ansicht.weiterUmkreis, bereich })}
              className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-brand-text underline-offset-4 hover:underline"
            >
              Umkreis auf {ansicht.weiterUmkreis} km
            </Link>
          )}
        </div>
      ) : (
        <UmfeldListe zeilen={ansicht.zeilen} />
      )}
    </>
  )
}
