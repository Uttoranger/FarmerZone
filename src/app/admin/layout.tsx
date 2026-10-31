import type { Metadata } from 'next'
import { ladeAdminbereich } from '@/server/adminbereich'
import { AdminShell } from '@/components/shells/admin-shell'
import { STRIPE_MARKE, TESTBETRIEB } from '@/lib/umgebung-server'

/*
 * Alle Routen unter /admin in der AdminShell (Nachtlauf Nr. 22f, Gate 8):
 * eigene Kopfzeile mit den Reitern Heute · Höfe · Bestellungen · Postfach ·
 * Startseite · Geld · Betrieb · Einstellungen (Register N32, Nr. 193; am Handy
 * als Leiste unten mit „Mehr“) und — nur mit eigenem Hof — „← Zu meinem Hof",
 * keine Hof-Seitenleiste (docs/ai/DESIGN_SYSTEM.md). Welche Reiter die Person
 * sieht, sagt `reiter` (N35: ohne Recht kein Reiter).
 *
 * Zugang: ladeAdminbereich prüft zuerst mit verlangeAdminShell (frisch aus
 * der Datenbank), erst danach lädt es Name und Zähler. Jede Seite darunter
 * prüft zusätzlich selbst (tests/admin-seiten-wache.test.ts). Ohne Passkey
 * (Pflicht, Register N20) und in einer Sitzung ohne Passkey kommt die Shell
 * ohne Zähler und Betriebshinweis — das Layout umhüllt auch die Pflichtseite
 * /admin/einrichten.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function AdminLayout({ children }: { children: React.ReactNode }): Promise<React.JSX.Element> {
  const { personName, hatHof, zahlen, reiter, betrieb, aufgaben, stripeLiveWarnung } = await ladeAdminbereich()

  // Testbetrieb (Register Z2): Produktion mit Test-Schlüssel — nur der Wahrheitswert geht an die Shell.
  // Betriebsleiste (Register Z3, Korrektur Nr. 94): der Stripe-Modus, als Text und Ton;
  // rechts seit Nr. 185 (N32) „n offen · m überfällig“ aus Heute; der Punkt am Reiter Betrieb (N15/N18) nur in der Produktion;
  // seit Nr. 201 (N40) die Warnung „Stripe ist live, aber …“ aus derselben Liste.
  return (
    <AdminShell personName={personName} hatHof={hatHof} zahlen={zahlen} reiter={reiter} testbetrieb={TESTBETRIEB} stripeMarke={STRIPE_MARKE} betrieb={betrieb} aufgaben={aufgaben} stripeLiveWarnung={stripeLiveWarnung}>
      {children}
    </AdminShell>
  )
}
