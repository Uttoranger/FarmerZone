import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { verlangeHofDerSitzung } from '@/server/hofbereich'
import { getFarmSettings } from '@/server/queries/farm'
import { PauseClient } from '@/components/settings/pause-client'
import { UnterseitenKopf } from '@/components/hofbereich/unterseiten-kopf'
import { UNTERSEITE_RAHMEN } from '@/components/hof-einstellungen/einstellungen-laden'
import { MARKE } from '@/lib/marke'
import { URLAUB_UND_PAUSE } from '@/lib/hof-einstellungen'

/** Titel der Seite — für den Kopf und den Tab, eine Schreibweise (wie die Zeile der Übersicht, V8). */
const TITEL = URLAUB_UND_PAUSE

export const metadata: Metadata = { title: `${TITEL} — ${MARKE}` }

/*
 * Urlaub und Pause (Pause, Farm.isPaused) in der HofShell (Nachtlauf Nr. 22d):
 * derselbe Schalter und dieselbe Action setPause, nur Kopf und Rahmen neu.
 * Seit Nr. 224 heißt die Seite „Urlaub und Pause“ wie die Zeile der
 * Übersicht (Boards s1-/w1-einstellungen, V8); die Aktion in Mein Hof bleibt „Pausieren“.
 */
export default async function PausePage(): Promise<React.JSX.Element> {
  const { userId } = await verlangeHofDerSitzung()

  const farm = await getFarmSettings(userId)
  if (!farm) redirect('/onboarding')

  return (
    <div className={UNTERSEITE_RAHMEN}>
      <UnterseitenKopf
        titel={TITEL}
        satz="Pausiere Bestellungen während Urlaub oder Betriebsferien. Bestehende Bestellungen bleiben erhalten."
      />
      <div data-app-palette="neu">
        <PauseClient initialPaused={farm.isPaused} initialMessage={farm.pauseMessage} />
      </div>
    </div>
  )
}
