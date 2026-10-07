import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import * as Sentry from '@sentry/nextjs'
import { auth } from '@/lib/auth'
import { getFarmForUser } from '@/server/queries/dashboard'
import { getMeldungenFuerHof } from '@/server/queries/meldung'
import { meldungZeilen, type MeldungZeile } from '@/lib/hof-hilfe'
import { MeineMeldungen } from '@/components/hof-hilfe/meine-meldungen'
import { MELDUNGEN_RAHMEN } from '@/components/hof-hilfe/hilfe-laden'

export const metadata: Metadata = { title: 'Meine Meldungen — FarmerZone' }

export const dynamic = 'force-dynamic'

/*
 * „Meine Meldungen" in der HofShell (Nachtlauf Nr. 22e; Mockups
 * web-h6-meine-meldungen, mobil-h6-meine-meldungen) — das Ziel des Punkts
 * „Hilfe und Rückmeldung". Nur die eigenen Meldungen des Hofs (farmId der
 * Sitzung, hart in der Query) und nur die Felder der Sichtbarkeitsregel
 * (fuerHof). Ein Ladefehler steht inline statt als 500.
 */
export default async function MeineMeldungenPage(): Promise<React.JSX.Element> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')
  const farm = await getFarmForUser(session.user.id)
  if (!farm) redirect('/onboarding')

  let zeilen: MeldungZeile[] | null = null
  try {
    // Der Tag „Heute/Gestern" einmal hier auf dem Server, nach Wiener Zeit.
    zeilen = meldungZeilen(await getMeldungenFuerHof(farm.id), new Date())
  } catch (err) {
    // Nur Bereich und Hof — kein Meldungstext (Fremdtext) nach Sentry.
    Sentry.captureException(err, { tags: { bereich: 'hilfe', seite: 'meldungen' }, extra: { farmId: farm.id } })
  }

  return (
    <div className={MELDUNGEN_RAHMEN}>
      <MeineMeldungen zeilen={zeilen} />
    </div>
  )
}
