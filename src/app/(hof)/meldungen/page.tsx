import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'
import { verlangeHofDerSitzung } from '@/server/hofbereich'
import { getFarmForUser } from '@/server/queries/dashboard'
import { getMeldungenFuerHof } from '@/server/queries/meldung'
import { meldungZeilen, type MeldungZeile } from '@/lib/hof-hilfe'
import { MeineMeldungen } from '@/components/hof-hilfe/meine-meldungen'
import { MELDUNGEN_RAHMEN } from '@/components/hof-hilfe/hilfe-laden'
import { MARKE } from '@/lib/marke'

export const metadata: Metadata = { title: `Meine Meldungen — ${MARKE}` }

export const dynamic = 'force-dynamic'

/*
 * „Meine Meldungen" in der HofShell (Nachtlauf Nr. 22e; Mockups
 * web-h6-meine-meldungen, mobil-h6-meine-meldungen) — das Ziel des Punkts
 * „Hilfe und Rückmeldung". Nur die eigenen Meldungen des Hofs (farmId der
 * Sitzung, hart in der Query) und nur die Felder der Sichtbarkeitsregel
 * (fuerHof). Ein Ladefehler steht inline statt als 500.
 */
export default async function MeineMeldungenPage(): Promise<React.JSX.Element> {
  const { userId } = await verlangeHofDerSitzung()
  const farm = await getFarmForUser(userId)
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
