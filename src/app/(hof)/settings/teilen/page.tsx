import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { ladeTeilenMomente } from '@/server/queries/einstellungen'
import { teilenMomenteAn, TEILEN_MOMENTE_SATZ, TEILEN_MOMENTE_TITEL } from '@/lib/teilen-momente'
import { UnterseitenKopf } from '@/components/hofbereich/unterseiten-kopf'
import { UNTERSEITE_RAHMEN } from '@/components/hof-einstellungen/einstellungen-laden'
import { TeilenMomenteSchalter } from '@/components/hof-einstellungen/teilen-momente-schalter'

export const metadata: Metadata = { title: `${TEILEN_MOMENTE_TITEL} — FarmerZone` }
export const dynamic = 'force-dynamic'

/*
 * Teilen-Hinweise in der HofShell (Gate 7 Aufgabe 5, Nachtlauf Nr. 30): EIN
 * Schalter für alle drei Teilen-Momente (freigeschaltet, wieder da,
 * gespeichert). Nur der eigene Hof; geschrieben wird über setzeTeilenMomente.
 */
export default async function TeilenMomentePage(): Promise<React.JSX.Element> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  const hof = await ladeTeilenMomente(session.user.id)
  if (!hof) redirect('/onboarding')

  return (
    <div className={UNTERSEITE_RAHMEN}>
      <UnterseitenKopf titel={TEILEN_MOMENTE_TITEL} satz={TEILEN_MOMENTE_SATZ} />
      <TeilenMomenteSchalter anfangsAn={teilenMomenteAn(hof)} />
    </div>
  )
}
