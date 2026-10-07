import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import * as Sentry from '@sentry/nextjs'
import { auth } from '@/lib/auth'
import { getFarmForUser } from '@/server/queries/dashboard'
import { getMeistverkaufteProduktIds, getSalesOverview } from '@/server/queries/manual-sales'
import { getProductsForFarm } from '@/server/queries/products'
import { getStripeReadiness } from '@/server/queries/farm'
import { VerkaeufeAnsicht } from '@/components/hof-verkaeufe/verkaeufe-ansicht'
import { VerkaeufeFehler } from '@/components/hof-verkaeufe/verkaeufe-fehler'
import { VERKAEUFE_RAHMEN } from '@/components/hof-verkaeufe/verkaeufe-laden'

export const metadata: Metadata = {
  title: 'Verkäufe — FarmerZone',
}

export const dynamic = 'force-dynamic'

/*
 * Verkäufe in der HofShell (Gate 8 „Code ohne Mockup", Nachtlauf Nr. 22b) —
 * gebaut nach docs/ai/DESIGN_SYSTEM.md, Abschnitt „Verkäufe". Die Shell kommt
 * aus dem Layout der Routengruppe (hof). Alles nur für den eigenen Hof
 * (farmId); an den Browser gehen nur Text und Zahlen (Zeilen in Cent, Tage
 * nach Wiener Zeit, Produkte nur mit Kennung, Name, Einheit, Gebindegröße und
 * Vorrat — für den Schalter „Vorrat abziehen“, Nr. 39).
 */
export default async function SalesPage(): Promise<React.JSX.Element> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  const farm = await getFarmForUser(session.user.id)
  if (!farm) redirect('/onboarding')

  let daten: React.ComponentProps<typeof VerkaeufeAnsicht> | null = null
  try {
    const [overview, produkte, topProduktIds, stripeReady] = await Promise.all([
      getSalesOverview(farm.id, new Date()),
      getProductsForFarm(farm.id),
      getMeistverkaufteProduktIds(farm.id),
      getStripeReadiness(session.user.id),
    ])
    daten = {
      overview,
      produkte: produkte.map((p) => ({ id: p.id, name: p.name, unit: p.unit, unitSize: p.unitSize, stock: p.stock })),
      topProduktIds,
      stripeReady,
    }
  } catch (err) {
    // Nur Art und Hof — keine Personendaten; Texte bereinigt sentry-hygiene ohnehin.
    Sentry.captureException(err, { tags: { bereich: 'verkaeufe', seite: 'liste' }, extra: { farmId: farm.id } })
  }

  return <div className={VERKAEUFE_RAHMEN}>{daten ? <VerkaeufeAnsicht {...daten} /> : <VerkaeufeFehler />}</div>
}
