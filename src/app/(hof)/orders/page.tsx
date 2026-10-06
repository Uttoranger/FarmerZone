import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getFarmForUser } from '@/server/queries/dashboard'
import { getBestellungenSeite, getHofBestellDetail } from '@/server/queries/orders'
import { gibVerwaisteFreiOhneRisiko } from '@/server/verwaiste-bestellungen'
import { hofBestellFilterAus } from '@/schemas/hof-bestellungen'
import { BestellungenAnsicht } from '@/components/hof-bestellungen/bestellungen-ansicht'

export const metadata: Metadata = {
  title: 'Bestellungen — FarmerZone',
}

export const dynamic = 'force-dynamic'

/*
 * Bestellungen in der HofShell (Gate 5, Nachtlauf Nr. 19; Mockups
 * web-h3-bestellungen-packen-uebergeben, mobil-h3-bestellungen). Die Shell
 * kommt aus dem Layout der Routengruppe (hof). Ab 1024 px steht rechts die
 * erste Bestellung der Liste (dieselbe Ansicht wie /orders/[orderId]); am
 * Handy nur die Liste — eine Zeile führt in die Bestellung.
 */
export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string | string[] }>
}): Promise<React.JSX.Element> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  const farm = await getFarmForUser(session.user.id)
  if (!farm) redirect('/onboarding')

  // Frist gilt beim Lesen: Verwaiste Bestellungen geben ihre Ware frei, bevor
  // die Seite Bestand und Bestellungen zeigt (src/lib/fristen.ts). Fehler nur gemeldet.
  await gibVerwaisteFreiOhneRisiko(farm.id)

  const filter = hofBestellFilterAus((await searchParams).filter)
  const jetzt = new Date()
  const seite = await getBestellungenSeite(farm.id, filter, jetzt)
  const erste = seite.gruppen[0]?.bestellungen[0]
  const detail = erste ? await getHofBestellDetail(farm, erste.id, jetzt) : null

  return <BestellungenAnsicht seite={seite} filter={filter} detail={detail} modus="liste" />
}
