import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { verlangeHofDerSitzung } from '@/server/hofbereich'
import { getFarmSettings } from '@/server/queries/farm'
import { ProfileForm } from '@/components/settings/profile-form'
import { UnterseitenKopf } from '@/components/hofbereich/unterseiten-kopf'
import { UNTERSEITE_RAHMEN } from '@/components/hof-einstellungen/einstellungen-laden'
import { MARKE } from '@/lib/marke'

/** Titel der Seite — für den Kopf und den Tab, eine Schreibweise. */
const TITEL = 'Hof-Profil'

export const metadata: Metadata = { title: `${TITEL} — ${MARKE}` }

/*
 * Hof-Profil in der HofShell (Nachtlauf Nr. 22d): gleiches Formular, gleiche
 * Action (updateProfile mit Zod und Besitzprüfung), nur Kopf und Rahmen neu.
 * Seit Nr. 44 am Handy mit festem Kopf (UnterseitenKopf); nach dem Speichern
 * geht es zurück zur Übersicht (Register N1).
 * data-app-palette: Das Formular zeichnet teils noch mit --app-* (DESIGN_SYSTEM
 * „Bestandsteile im Geltungsbereich").
 */
export default async function ProfileSettingsPage(): Promise<React.JSX.Element> {
  const { userId } = await verlangeHofDerSitzung()

  const farm = await getFarmSettings(userId)
  if (!farm) redirect('/onboarding')

  return (
    <div className={UNTERSEITE_RAHMEN}>
      <UnterseitenKopf titel={TITEL} satz="Informationen, die auf deiner öffentlichen Hof-Seite sichtbar sind." />
      <div data-app-palette="neu">
        <ProfileForm farm={farm} />
      </div>
    </div>
  )
}
