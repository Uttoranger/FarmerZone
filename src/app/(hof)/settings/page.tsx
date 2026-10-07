import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import * as Sentry from '@sentry/nextjs'
import { auth } from '@/lib/auth'
import { einstellungenBereiche, EINSTELLUNGEN_TITEL, type EinstellungBereich } from '@/lib/hof-einstellungen'
import { ladeEinstellungenUebersicht } from '@/server/queries/einstellungen'
import { EinstellungenUebersicht } from '@/components/hof-einstellungen/einstellungen-uebersicht'
import { EinstellungenFehler } from '@/components/hof-einstellungen/einstellungen-fehler'
import { EINSTELLUNGEN_RAHMEN } from '@/components/hof-einstellungen/einstellungen-laden'

export const metadata: Metadata = { title: 'Einstellungen — FarmerZone' }

export const dynamic = 'force-dynamic'

/*
 * Übersicht der Einstellungen in der HofShell (Gate 8, Nachtlauf Nr. 22d) —
 * Mockups web-h1-einstellungen-uebersicht und mobil-h5-einstellungen. Die
 * Shell kommt aus dem Layout der Routengruppe (hof). Nur der eigene Hof; was
 * ein Bereich sagt, entscheidet einstellungenBereiche.
 */
export default async function SettingsPage(): Promise<React.JSX.Element> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  let bereiche: EinstellungBereich[] | null = null
  let gefunden = true
  try {
    const daten = await ladeEinstellungenUebersicht(session.user.id)
    if (daten) bereiche = einstellungenBereiche(daten, new Date())
    else gefunden = false
  } catch (err) {
    // Nur Art und Bereich — keine Personendaten.
    Sentry.captureException(err, { tags: { bereich: 'einstellungen', seite: 'uebersicht' } })
  }
  // Kein Hof: Das Layout schickt schon nach /onboarding — hier nur zur Sicherheit.
  if (!gefunden) redirect('/onboarding')

  return (
    <div className={EINSTELLUNGEN_RAHMEN}>
      {bereiche ? <EinstellungenUebersicht bereiche={bereiche} /> : <EinstellungenFehler titel={EINSTELLUNGEN_TITEL} href="/settings" />}
    </div>
  )
}
