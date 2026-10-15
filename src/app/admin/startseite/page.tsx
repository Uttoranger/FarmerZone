import type { Metadata } from 'next'
import { verlangeAdminSeite } from '@/server/admin-wache'
import { ladeStartseiteAdmin } from '@/server/queries/startseite'
import { ADMIN_STARTSEITE_TEXT } from '@/lib/startseite-gestalten'
import { ADMIN_RAHMEN } from '@/components/admin/admin-teile'
import { StartseiteGestalten } from '@/components/admin/startseite-gestalten'
import { MARKE } from '@/lib/marke'

export const metadata: Metadata = { title: `${ADMIN_STARTSEITE_TEXT.titel} — Admin — ${MARKE}` }

/*
 * /admin/startseite — Startseite gestalten (Register N16, Nr. 96; Mockups
 * admin-startseite-gestalten und admin-startseite-vorschau), im Muster der
 * Admin-Seiten (Register N15): Seitenkopf mit Satz und Umschalter, Inhalt,
 * Regel-Zeile. Kennzahlen hat das Mockup keine. Die Seite prüft selbst und
 * zuerst (verlangeAdminSeite), wie jede Admin-Seite; jede Aktion prüft noch
 * einmal (verlangeAdminAktion).
 */
export default async function AdminStartseitePage(): Promise<React.JSX.Element> {
  await verlangeAdminSeite()
  const daten = await ladeStartseiteAdmin()

  return (
    <div className={ADMIN_RAHMEN}>
      <StartseiteGestalten daten={daten} jetzt={new Date().toISOString()} />
    </div>
  )
}
