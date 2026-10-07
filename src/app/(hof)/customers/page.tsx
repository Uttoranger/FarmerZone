import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import * as Sentry from '@sentry/nextjs'
import { auth } from '@/lib/auth'
import { getFarmForUser } from '@/server/queries/dashboard'
import { getCustomersForFarm, type CustomerSummary } from '@/server/queries/customers'
import { KundenAnsicht } from '@/components/hof-kunden/kunden-ansicht'
import { KundenFehler } from '@/components/hof-kunden/kunden-fehler'
import { KUNDEN_RAHMEN } from '@/components/hof-kunden/kunden-laden'

export const metadata: Metadata = {
  title: 'Kunden — FarmerZone',
}

export const dynamic = 'force-dynamic'

/*
 * Kunden in der HofShell (Gate 8 „Code ohne Mockup", Nachtlauf Nr. 22a) —
 * gebaut nach docs/ai/DESIGN_SYSTEM.md, Abschnitt „Kunden". Die Shell kommt
 * aus dem Layout der Routengruppe (hof), Zugang und Zahlen aus ladeHofbereich.
 * Nur die Kundinnen des eigenen Hofs: getCustomersForFarm fragt nach farmId.
 * Filter, Suche und Sortierung liest die Ansicht selbst aus der Adresse.
 */
export default async function CustomersPage(): Promise<React.JSX.Element> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  const farm = await getFarmForUser(session.user.id)
  if (!farm) redirect('/onboarding')

  let kunden: CustomerSummary[] | null = null
  try {
    kunden = await getCustomersForFarm(farm.id, new Date())
  } catch (err) {
    // Nur Art und Hof — keine Personendaten; Texte bereinigt sentry-hygiene ohnehin.
    Sentry.captureException(err, { tags: { bereich: 'kunden', seite: 'liste' }, extra: { farmId: farm.id } })
  }

  return (
    <div className={KUNDEN_RAHMEN}>
      {kunden ? <KundenAnsicht kunden={kunden} /> : <KundenFehler titel="Kunden" nochmal="/customers" />}
    </div>
  )
}
