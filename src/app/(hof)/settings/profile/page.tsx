import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { getFarmSettings } from '@/server/queries/farm'
import { ProfileForm } from '@/components/settings/profile-form'
import { UnterseitenKopf } from '@/components/hofbereich/unterseiten-kopf'
import { UNTERSEITE_RAHMEN } from '@/components/hof-einstellungen/einstellungen-laden'

/** Titel der Seite — für den Kopf und den Tab, eine Schreibweise. */
const TITEL = 'Hof-Profil'

export const metadata: Metadata = { title: `${TITEL} — FarmerZone` }

/*
 * Hof-Profil in der HofShell (Nachtlauf Nr. 22d): gleiches Formular, gleiche
 * Action (updateProfile mit Zod und Besitzprüfung), nur Kopf und Rahmen neu.
 * Seit Nr. 44 am Handy mit festem Kopf (UnterseitenKopf); nach dem Speichern
 * geht es zurück zur Übersicht (Register N1).
 * data-app-palette: Das Formular zeichnet teils noch mit --app-* (DESIGN_SYSTEM
 * „Bestandsteile im Geltungsbereich").
 */
export default async function ProfileSettingsPage(): Promise<React.JSX.Element> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect('/login')

  const farm = await getFarmSettings(session.user.id)
  if (!farm) redirect('/login')

  return (
    <div className={UNTERSEITE_RAHMEN}>
      <UnterseitenKopf titel={TITEL} satz="Informationen, die auf deiner öffentlichen Hof-Seite sichtbar sind." />
      <div data-app-palette="neu">
        <ProfileForm farm={farm} />
      </div>
    </div>
  )
}
