import type { Metadata } from 'next'
import { ladeAdminbereich } from '@/server/adminbereich'
import { AdminShell } from '@/components/shells/admin-shell'
import { STRIPE_MARKE, TESTBETRIEB } from '@/lib/umgebung-server'

/*
 * Alle Routen unter /admin in der AdminShell (Nachtlauf Nr. 22f, Gate 8):
 * eigene Kopfzeile mit den Reitern Höfe · Postfach · Startseite · Finanzen ·
 * Betrieb · Einstellungen und — nur mit eigenem Hof — „← Zu meinem Hof", keine Hof-Seitenleiste
 * (docs/ai/DESIGN_SYSTEM.md).
 *
 * Zugang: ladeAdminbereich prüft zuerst mit verlangeAdminSeite (frisch aus
 * der Datenbank), erst danach lädt es Name und Zähler. Jede Seite darunter
 * prüft zusätzlich selbst (tests/admin-seiten-wache.test.ts). Ohne Passkey
 * (Pflicht, Register N20) kommt die Shell ohne Zähler und Betriebshinweis —
 * das Layout umhüllt auch die Pflichtseite /admin/einrichten.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function AdminLayout({ children }: { children: React.ReactNode }): Promise<React.JSX.Element> {
  const { personName, hatHof, zahlen, betrieb } = await ladeAdminbereich()

  // Testbetrieb (Register Z2): Produktion mit Test-Schlüssel — nur der Wahrheitswert geht an die Shell.
  // Betriebsleiste (Register Z3, Korrektur Nr. 94): der Stripe-Modus, als Text und Ton;
  // rechts seit Nr. 103 (N15/N18) der Hinweis auf eine offene Warnung — nur in der Produktion.
  return (
    <AdminShell personName={personName} hatHof={hatHof} zahlen={zahlen} testbetrieb={TESTBETRIEB} stripeMarke={STRIPE_MARKE} betrieb={betrieb}>
      {children}
    </AdminShell>
  )
}
