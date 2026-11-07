import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { verlangeHofDerSitzung } from '@/server/hofbereich'
import { getFarmSettings } from '@/server/queries/farm'
import { ProfileForm } from '@/components/settings/profile-form'
import { WerkzeugKopf } from '@/components/ui/werkzeug-kopf'
import { HofUnterzeile } from '@/components/mein-hof/hof-unterzeile'
import { UEBERSICHT_RAHMEN, UNTERSEITE_SATZ } from '@/components/hof-einstellungen/einstellungen-laden'
import { MARKE } from '@/lib/marke'
import { HOFDATEN_TEXT } from '@/lib/hof-einstellungen'

/** Titel der Seite — für den Kopf und den Tab, eine Schreibweise („Hofdaten“, N42 c). */
const TITEL = HOFDATEN_TEXT.titel

export const metadata: Metadata = { title: `${TITEL} — ${MARKE}` }

/*
 * Hofdaten (bis Nr. 224 „Hof-Profil“, Register N42 c) in der HofShell (Nachtlauf Nr. 22d): gleiches Formular, gleiche
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
  const jetzt = new Date()

  return (
    // So breit wie die Übersicht (Board w2-hofdaten-zahlung: zwei Spalten in 1000 px, Nr. 250).
    <div className={UEBERSICHT_RAHMEN}>
      {/* Werkzeug-Kopf (G1, Nr. 250) mit Hof-Unterzeile, der Satz darunter (Boards s2-/w2-hofdaten-zahlung). */}
      <WerkzeugKopf titel={TITEL} unterzeile={<HofUnterzeile hofName={farm.name} jetzt={jetzt} />} />
      <p className={UNTERSEITE_SATZ}>{HOFDATEN_TEXT.satz}</p>
      <div data-app-palette="neu">
        <ProfileForm farm={farm} />
      </div>
    </div>
  )
}
