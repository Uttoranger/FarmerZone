import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { verlangeHofDerSitzung } from '@/server/hofbereich'
import { getFarmForUser } from '@/server/queries/dashboard'
import { leseRegionReiter } from '@/schemas/region'
import { LadeRahmen } from '@/components/ui/lade-punkt'
import { MARKE } from '@/lib/marke'
import { FutterReiter } from './futter-reiter'
import { PreiseReiter } from './preise-reiter'

export const metadata: Metadata = { title: `Region — ${MARKE}` }

export const dynamic = 'force-dynamic'

type Suche = Record<string, string | string[] | undefined>

/*
 * Region (Nachtlauf Nr. 22c, Gate 8): eigener Menüpunkt in der HofShell mit
 * den Reitern „Preise vergleichen" (das bisherige Umfeld, /analytics/umfeld
 * leitet hierher um) und „Futter kaufen". Beide lesen fremde Höfe nur mit
 * der öffentlichen Sichtbarkeitsregel und rechnen um den EIGENEN Hof — die
 * farmId kommt aus der Sitzung, Umkreis und Filter aus der Adresse (Zod).
 * Entschieden wird in src/lib/umfeld.ts bzw. src/lib/futter-kaufen.ts.
 *
 * Seit Nr. 122 (N23) prüft die Seite nur Sitzung, Hof und Reiter; jeder Reiter
 * ist ein eigener Server-Component (preise-reiter.tsx, futter-reiter.tsx) — so
 * ändern 123 und 124 je nur ihren. Statt einer loading.tsx (Skelett bei jedem
 * Klick auf Reiter, Umkreis oder Filter) bleibt die alte Ansicht stehen, bis
 * die neue da ist: `LadeRahmen` hier, `LadeInhalt` in den Reitern, der
 * Ladepunkt am gewählten Reiter bzw. Umkreis (Muster Admin › Postfach, Nr. 105).
 */
export default async function RegionPage({ searchParams }: { searchParams: Promise<Suche> }): Promise<React.JSX.Element> {
  const { userId } = await verlangeHofDerSitzung()

  const farm = await getFarmForUser(userId)
  if (!farm) redirect('/onboarding')

  const suche = await searchParams
  const reiter = leseRegionReiter(suche.reiter)

  return <LadeRahmen>{reiter === 'futter' ? <FutterReiter farm={farm} suche={suche} /> : <PreiseReiter farm={farm} suche={suche} />}</LadeRahmen>
}
