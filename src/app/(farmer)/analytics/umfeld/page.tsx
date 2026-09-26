import Link from 'next/link'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getFarmForUser } from '@/server/queries/dashboard'
import { getUmfeld, type UmfeldDaten } from '@/server/queries/umfeld'
import { baueUmfeld, baueUmfeldKarte, standardBereich, type UmfeldKm } from '@/lib/umfeld'
import type { AnzeigeBereich } from '@/lib/taxonomie'
import { leseUmfeldFilter } from '@/schemas/umfeld-filter'
import { PageHeader } from '@/components/farmer/page-header'
import { AuswertungReiter } from '@/components/analytics/auswertung-reiter'
import { UmfeldAnzeige } from '@/components/analytics/umfeld-anzeige'

/**
 * Auswertung → Umfeld: was andere Höfe in der Nähe anbieten
 * (docs/konzepte/umfeld.md). Die Query bekommt nur die farmId aus der
 * Sitzung; Umkreis, Bereich und Ansicht (Liste | Karte) kommen aus der URL
 * und laufen durch Zod. Ohne eigenen Standort gibt es nur den Hinweis — auch
 * keinen Umschalter, eine Karte ohne Mittelpunkt sagte nichts.
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
        <UmfeldInhalt daten={daten} km={filter.km} bereichWunsch={filter.bereich} eigenerName={farm.name} />
      )}
    </div>
  )
}

function UmfeldInhalt({
  daten,
  km,
  bereichWunsch,
  eigenerName,
}: {
  daten: Extract<UmfeldDaten, { eigenerStandort: true }>
  km: UmfeldKm
  /** null = nicht gewählt → der Bereich mit den meisten eigenen Produkten. */
  bereichWunsch: AnzeigeBereich | null
  eigenerName: string
}) {
  const bereich = bereichWunsch ?? standardBereich(daten.eigeneProdukte)
  const eingabe = { ...daten, bereich, km }
  // Liste und Karte aus DERSELBEN Eingabe — die Pins sind genau die Höfe, die
  // die Zeilen zählen (gezaehlteHoefe in src/lib/umfeld.ts).
  return (
    <UmfeldAnzeige
      bereich={bereich}
      km={km}
      eigenerName={eigenerName}
      ansicht={baueUmfeld(eingabe)}
      karte={baueUmfeldKarte({ ...eingabe, eigenerStandort: daten.standort })}
    />
  )
}
