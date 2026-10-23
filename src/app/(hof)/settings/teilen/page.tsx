import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { verlangeHofDerSitzung } from '@/server/hofbereich'
import { ladeTeilenMomente } from '@/server/queries/einstellungen'
import { teilenMomenteAn, TEILEN_MOMENTE_SATZ, TEILEN_MOMENTE_TITEL } from '@/lib/teilen-momente'
import { UnterseitenKopf } from '@/components/hofbereich/unterseiten-kopf'
import { UNTERSEITE_RAHMEN } from '@/components/hof-einstellungen/einstellungen-laden'
import { TeilenMomenteSchalter } from '@/components/hof-einstellungen/teilen-momente-schalter'
import { MARKE } from '@/lib/marke'

export const metadata: Metadata = { title: `${TEILEN_MOMENTE_TITEL} — ${MARKE}` }
export const dynamic = 'force-dynamic'

/*
 * Teilen-Hinweise in der HofShell (Gate 7 Aufgabe 5, Nachtlauf Nr. 30): EIN
 * Schalter für alle drei Teilen-Momente (freigeschaltet, wieder da,
 * gespeichert). Nur der eigene Hof; geschrieben wird über setzeTeilenMomente.
 */
export default async function TeilenMomentePage(): Promise<React.JSX.Element> {
  const { userId } = await verlangeHofDerSitzung()

  const hof = await ladeTeilenMomente(userId)
  if (!hof) redirect('/onboarding')

  return (
    <div className={UNTERSEITE_RAHMEN}>
      <UnterseitenKopf titel={TEILEN_MOMENTE_TITEL} satz={TEILEN_MOMENTE_SATZ} />
      <TeilenMomenteSchalter anfangsAn={teilenMomenteAn(hof)} />
    </div>
  )
}
