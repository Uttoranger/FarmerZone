import type { Metadata } from 'next'
import { ladeAdminbereich } from '@/server/adminbereich'
import { AdminShell } from '@/components/shells/admin-shell'
import { TESTBETRIEB } from '@/lib/umgebung-server'

/*
 * Alle Routen unter /admin in der AdminShell (Nachtlauf Nr. 22f, Gate 8):
 * eigene Kopfzeile mit den Reitern Höfe · Briefkasten · Finanzen und — nur
 * mit eigenem Hof — „← Zu meinem Hof", keine Hof-Seitenleiste
 * (docs/ai/DESIGN_SYSTEM.md).
 *
 * Zugang: ladeAdminbereich prüft zuerst mit verlangeAdminSeite (frisch aus
 * der Datenbank), erst danach lädt es Name und Zähler. Jede Seite darunter
 * prüft zusätzlich selbst (tests/admin-seiten-wache.test.ts).
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function AdminLayout({ children }: { children: React.ReactNode }): Promise<React.JSX.Element> {
  const { personName, hatHof, zahlen } = await ladeAdminbereich()

  // Testbetrieb (Register Z2): Produktion mit Test-Schlüssel — nur der Wahrheitswert geht an die Shell.
  return (
    <AdminShell personName={personName} hatHof={hatHof} zahlen={zahlen} testbetrieb={TESTBETRIEB}>
      {children}
    </AdminShell>
  )
}
