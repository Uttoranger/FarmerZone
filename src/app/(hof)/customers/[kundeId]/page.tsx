import type { Metadata } from 'next'
import { notFound, permanentRedirect, redirect } from 'next/navigation'
import { headers } from 'next/headers'
import * as Sentry from '@sentry/nextjs'
import { auth } from '@/lib/auth'
import { getFarmForUser } from '@/server/queries/dashboard'
import { findeKundenAdressen, getCustomerDetail, kundeIdFuer, type CustomerDetail } from '@/server/queries/customers'
import { KUNDE_ID_MUSTER, alteKundenAdresse } from '@/lib/kunden-id'
import { KundenDetail } from '@/components/hof-kunden/kunden-detail'
import { KundenFehler } from '@/components/hof-kunden/kunden-fehler'
import { KUNDEN_RAHMEN } from '@/components/hof-kunden/kunden-laden'

// Kein Name im Titel: Der Tab-Titel landet im Verlauf und in der Statistik.
export const metadata: Metadata = {
  title: 'Kundin — FarmerZone',
}

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ kundeId: string }>
}

/*
 * Eine Kundin in der HofShell (Gate 8 „Code ohne Mockup", Nachtlauf Nr. 22a).
 * Die Kennung ist kein Zugang: Gesucht wird nur unter den Bestellungen des
 * angemeldeten Hofs (findeKundenAdressen, getCustomerDetail mit farmId) —
 * eine erratene oder fremde Kennung ergibt 404, nie eine fremde Kundin.
 */
export default async function CustomerDetailPage({ params }: Props): Promise<React.JSX.Element> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  const farm = await getFarmForUser(session.user.id)
  if (!farm) redirect('/onboarding')

  const { kundeId } = await params

  // Alte Adresse mit der E-Mail im Pfad (Lesezeichen, Verlauf): dauerhaft
  // (308) auf die Kennung umleiten, damit die E-Mail nicht weiter in
  // Protokollen und Statistik landet.
  const alteEmail = alteKundenAdresse(kundeId)
  if (alteEmail) permanentRedirect(`/customers/${kundeIdFuer(farm.id, alteEmail)}`)
  if (!KUNDE_ID_MUSTER.test(kundeId)) notFound()

  const jetzt = new Date()
  let kunde: CustomerDetail | null
  try {
    kunde = await getCustomerDetail(farm.id, await findeKundenAdressen(farm.id, kundeId), jetzt)
  } catch (err) {
    // Nur Art und Hof — keine Kennung, keine Personendaten.
    Sentry.captureException(err, { tags: { bereich: 'kunden', seite: 'detail' }, extra: { farmId: farm.id } })
    return (
      <div className={KUNDEN_RAHMEN}>
        <KundenFehler titel="Kundin" nochmal={`/customers/${kundeId}`} />
      </div>
    )
  }
  if (!kunde) notFound()

  return (
    <div className={KUNDEN_RAHMEN}>
      <KundenDetail kunde={kunde} jetzt={jetzt} />
    </div>
  )
}
