import type { Metadata } from 'next'

/**
 * /intern — Werkzeugseiten für den Betreiber (heute: die Bausteine-Vorschau
 * aus Gate 2). Nie in Suchmaschinen; jede Seite darunter prüft selbst mit
 * verlangeAdminSeite (src/server/admin-wache.ts) — wer kein Admin ist,
 * bekommt eine 404, wer nicht angemeldet ist, die Anmeldung.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function InternLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <>{children}</>
}
