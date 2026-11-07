import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'
import { verlangeHofDerSitzung } from '@/server/hofbereich'
import { einstellungenBereiche, EINSTELLUNGEN_TITEL, type EinstellungBereich } from '@/lib/hof-einstellungen'
import { ladeEinstellungenUebersicht } from '@/server/queries/einstellungen'
import { EinstellungenUebersicht } from '@/components/hof-einstellungen/einstellungen-uebersicht'
import { EinstellungenFehler } from '@/components/hof-einstellungen/einstellungen-fehler'
import { UEBERSICHT_RAHMEN } from '@/components/hof-einstellungen/einstellungen-laden'
import { MARKE } from '@/lib/marke'
import { getFarmForUser } from '@/server/queries/dashboard'
import { HofUnterzeile } from '@/components/mein-hof/hof-unterzeile'

export const metadata: Metadata = { title: `Einstellungen — ${MARKE}` }

export const dynamic = 'force-dynamic'

/*
 * Übersicht der Einstellungen in der HofShell (Gate 8, Nachtlauf Nr. 22d) —
 * Mockups web-h1-einstellungen-uebersicht und mobil-h5-einstellungen. Die
 * Shell kommt aus dem Layout der Routengruppe (hof). Nur der eigene Hof; was
 * ein Bereich sagt, entscheidet einstellungenBereiche.
 */
export default async function SettingsPage(): Promise<React.JSX.Element> {
  const { userId } = await verlangeHofDerSitzung()

  const jetzt = new Date()
  let bereiche: EinstellungBereich[] | null = null
  let hofName = ''
  let gefunden = true
  try {
    const daten = await ladeEinstellungenUebersicht(userId)
    if (daten) {
      bereiche = einstellungenBereiche(daten, jetzt)
      hofName = daten.name
    } else {
      gefunden = false
    }
  } catch (err) {
    // Nur Art und Bereich — keine Personendaten.
    Sentry.captureException(err, { tags: { bereich: 'einstellungen', seite: 'uebersicht' } })
    // Der Hofname für die Unterzeile des Fehlerzustands (Board w1-einstellungen Bild 2) — aus der Abfrage,
    // die das Layout ohnehin stellt; scheitert auch sie, steht der Kopf ohne Unterzeile da.
    hofName = (await getFarmForUser(userId).catch(() => null))?.name ?? ''
  }
  // Kein Hof: Das Layout schickt schon nach /onboarding — hier nur zur Sicherheit.
  if (!gefunden) redirect('/onboarding')

  return (
    <div className={UEBERSICHT_RAHMEN}>
      {bereiche ? <EinstellungenUebersicht bereiche={bereiche} hofName={hofName} jetzt={jetzt} /> : (
        <EinstellungenFehler
          titel={EINSTELLUNGEN_TITEL}
          href="/settings"
          unterzeile={hofName ? <HofUnterzeile hofName={hofName} jetzt={jetzt} /> : undefined}
        />
      )}
    </div>
  )
}
