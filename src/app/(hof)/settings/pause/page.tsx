import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { getFarmSettings } from '@/server/queries/farm'
import { PauseClient } from '@/components/settings/pause-client'
import { EinstellungenKopf } from '@/components/hof-einstellungen/einstellungen-kopf'
import { UNTERSEITE_RAHMEN } from '@/components/hof-einstellungen/einstellungen-laden'

export const metadata: Metadata = { title: 'Urlaubsmodus — FarmerZone' }

/*
 * Urlaubsmodus (Pause, Farm.isPaused) in der HofShell (Nachtlauf Nr. 22d):
 * derselbe Schalter und dieselbe Action setPause, nur Kopf und Rahmen neu.
 * „Urlaubsmodus" heißt die Seite wie in den Mockups (Umsetzungsprompt §2).
 */
export default async function PausePage(): Promise<React.JSX.Element> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  const farm = await getFarmSettings(session.user.id)
  if (!farm) redirect('/login')

  return (
    <div className={UNTERSEITE_RAHMEN}>
      <EinstellungenKopf
        titel="Urlaubsmodus"
        satz="Pausiere Bestellungen während Urlaub oder Betriebsferien. Bestehende Bestellungen bleiben erhalten."
      />
      <div data-app-palette="neu">
        <PauseClient initialPaused={farm.isPaused} initialMessage={farm.pauseMessage} />
      </div>
    </div>
  )
}
