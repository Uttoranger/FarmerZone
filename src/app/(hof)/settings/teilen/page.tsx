import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { verlangeHofDerSitzung } from '@/server/hofbereich'
import { ladeTeilenMomente } from '@/server/queries/einstellungen'
import { teilenMomenteAn, TEILEN_MOMENTE_SATZ, TEILEN_MOMENTE_TITEL } from '@/lib/teilen-momente'
import { getFarmForUser } from '@/server/queries/dashboard'
import { WerkzeugKopf } from '@/components/ui/werkzeug-kopf'
import { HofUnterzeile } from '@/components/mein-hof/hof-unterzeile'
import { UNTERSEITE_RAHMEN, UNTERSEITE_SATZ } from '@/components/hof-einstellungen/einstellungen-laden'
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

  // Der Hofname der Unterzeile aus der Abfrage, die das Layout ohnehin stellt.
  const [hof, kopf] = await Promise.all([ladeTeilenMomente(userId), getFarmForUser(userId)])
  if (!hof) redirect('/onboarding')
  const jetzt = new Date()

  return (
    <div className={UNTERSEITE_RAHMEN}>
      {/* Werkzeug-Kopf (G1, Nr. 250) mit Hof-Unterzeile, der Satz darunter (Board s2-/w2-konto-hof Bild 5). */}
      <WerkzeugKopf titel={TEILEN_MOMENTE_TITEL} unterzeile={kopf ? <HofUnterzeile hofName={kopf.name} jetzt={jetzt} /> : undefined} />
      <p className={UNTERSEITE_SATZ}>{TEILEN_MOMENTE_SATZ}</p>
      <TeilenMomenteSchalter anfangsAn={teilenMomenteAn(hof)} />
    </div>
  )
}
