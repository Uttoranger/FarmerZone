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
 * Laufzeit der Funktion: „Artikel fehlt" hält eine Transaktion bis
 * TRANSAKTION_MS (42 s, src/server/artikel-fehlt.ts) plus bis zu 10 s Warten
 * auf eine Verbindung. Die Server Actions laufen mit der Laufzeit dieser Seite
 * — endete die Funktion vorher, rollte die Datenbank zurück, während Stripe
 * schon gebucht hat (der nächste Versuch trüge nach, aber der Hof sähe einen
 * Fehler). Vercel: Hobby erlaubt bis 60 s, Pro mehr — beim Plan prüfen.
 * tests/teilerstattung.test.ts hält die Rechnung fest.
 */
export const maxDuration = 60

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
