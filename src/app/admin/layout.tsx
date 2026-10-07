import type { Metadata } from 'next'
import { ladeAdminbereich } from '@/server/adminbereich'
import { AdminShell } from '@/components/shells/admin-shell'

/*
 * Alle Routen unter /admin in der AdminShell (Nachtlauf Nr. 22f, Gate 8):
 * eigene Kopfzeile mit den Reitern Höfe · Briefkasten · Finanzen und
 * „← Zu meinem Hof", keine Hof-Seitenleiste (docs/ai/DESIGN_SYSTEM.md).
 *
 * Zugang: ladeAdminbereich prüft zuerst mit verlangeAdminSeite (frisch aus
 * der Datenbank), erst danach lädt es Name und Zähler. Jede Seite darunter
 * prüft zusätzlich selbst (tests/admin-seiten-wache.test.ts).
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function AdminLayout({ children }: { children: React.ReactNode }): Promise<React.JSX.Element> {
  const { personName, zahlen } = await ladeAdminbereich()

  return (
    <AdminShell personName={personName} zahlen={zahlen}>
      {children}
    </AdminShell>
  )
}
