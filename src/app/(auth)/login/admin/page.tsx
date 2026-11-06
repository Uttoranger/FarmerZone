import type { Metadata } from 'next'
import { ADMIN_ANMELDEN_TEXT } from '@/lib/admin-anmeldung'
import { MARKE } from '@/lib/marke'
import { StatusBadge } from '@/components/ui/status-badge'
import { Wortmarke } from '@/components/shared/wortmarke'
import { ThemeUmschalter } from '@/components/shared/theme-umschalter'
import { AdminAnmeldungKarte } from './admin-anmeldung-karte'

export const metadata: Metadata = {
  title: `${ADMIN_ANMELDEN_TEXT.seitentitel} — ${MARKE}`,
  robots: { index: false, follow: false },
}

/**
 * /login/admin — die Anmeldung für Konten mit Admin-Recht (Register N20,
 * Ergänzung Lauf 18; Nr. 115; Mockup system-admin-anmeldung-passkey,
 * Schritt 1). Nicht verlinkt außer dem kleinen Link „Mit Passkey anmelden"
 * auf /login, `noindex`. Statisch: Wer angemeldet ist, wird nicht umgeleitet —
 * eine Sitzung älter als 12 Stunden landet genau hier (src/server/admin-wache.ts).
 */
export default function AdminAnmeldenPage(): React.JSX.Element {
  return (
    <div data-design="neu" className="flex min-h-dvh flex-col bg-background text-foreground">
      {/* Am Handy steht „Admin“ direkt hinter der Marke, im Browser rechts vor Hell/Dunkel (Boards s2-/w2-anmelden, Bild 3/4). */}
      <header className="border-b border-border bg-card">
        <div className="flex min-h-14 items-center justify-between gap-3 px-4 py-2 md:min-h-16 md:px-10">
          <div className="flex items-center gap-2.5">
            <Wortmarke />
            <span className="md:hidden">
              <StatusBadge status="offen">Admin</StatusBadge>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden md:inline-flex">
              <StatusBadge status="offen">Admin</StatusBadge>
            </span>
            <ThemeUmschalter />
          </div>
        </div>
      </header>
      {/* Eine schmale Spalte ohne Karte, im Browser mittig (Board w2-anmelden, Bild 3). */}
      <main className="flex flex-1 justify-center px-4 pt-6 pb-10 md:pt-8">
        <AdminAnmeldungKarte />
      </main>
    </div>
  )
}
