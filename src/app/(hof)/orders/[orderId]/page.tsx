import type { Metadata } from 'next'
import { redirect, notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { getFarmForUser } from '@/server/queries/dashboard'
import { getBestellungenSeite, getHofBestellDetail } from '@/server/queries/orders'
import { gibVerwaisteFreiOhneRisiko } from '@/server/verwaiste-bestellungen'
import { hofBestellFilterAus } from '@/schemas/hof-bestellungen'
import { BestellungenAnsicht } from '@/components/hof-bestellungen/bestellungen-ansicht'

export const metadata: Metadata = {
  title: 'Bestellung — FarmerZone',
}

export const dynamic = 'force-dynamic'

/*
 * Eine Bestellung in der HofShell (Gate 5, Nachtlauf Nr. 19; Mockups
 * web-h3-bestellungen-packen-uebergeben, mobil-h3-bestelldetail,
 * web-h3-stornieren-erstatten, mobil-h3-stornieren, web-h3-artikel-fehlt).
 * Ab 1024 px mit der Liste links, am Handy allein mit „Zurück". Nur
 * Bestellungen des eigenen Hofs — eine fremde ID ergibt 404 (die Abfrage
 * sucht nach ID UND Hof).
 */
export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>
  searchParams: Promise<{ filter?: string | string[] }>
}): Promise<React.JSX.Element> {
  const { orderId } = await params

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  const farm = await getFarmForUser(session.user.id)
  if (!farm) redirect('/onboarding')

  // Frist gilt beim Lesen (src/lib/fristen.ts), wie auf /orders.
  await gibVerwaisteFreiOhneRisiko(farm.id)

  const jetzt = new Date()
  const detail = await getHofBestellDetail(farm, orderId, jetzt)
  if (!detail) notFound()

  const filter = hofBestellFilterAus((await searchParams).filter)
  const seite = await getBestellungenSeite(farm.id, filter, jetzt)

  return <BestellungenAnsicht seite={seite} filter={filter} detail={detail} modus="detail" />
}
