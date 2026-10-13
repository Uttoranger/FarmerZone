import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { KundeFokusShell } from '@/components/shells/kunde-shell'
import { TEXTKNOPF } from '@/components/anmelden/stil'
import { cn } from '@/lib/utils'
import { NeuesPasswortFormular } from './neues-passwort-formular'
import { MARKE } from '@/lib/marke'

export const metadata: Metadata = {
  title: `Neues Passwort — ${MARKE}`,
  // Der Link aus der Mail trägt einen gültigen Token (?token=) — wie /verify:
  // nie in einen Suchindex; next.config.ts setzt dazu no-referrer und
  // X-Robots-Tag (Nr. 54).
  robots: { index: false, follow: false },
}

/**
 * „Neues Passwort wählen" in der Fokus-Shell (seit Nr. 54) — wie /register
 * und /verify: keine Navigation, nur Zurück zur Anmeldung und der Titel. Kein
 * Mockup; gebaut nach DESIGN_SYSTEM.md wie /verify (eine Karte auf --surface,
 * höchstens 520 px, genau ein oranger Hauptknopf, ein ungültiger Link als
 * orange Hinweiskarte mit Ausweg).
 *
 * Die Seite bleibt statisch: Den Token liest das Formular im Browser
 * (useSearchParams), wie bisher. Überschrift und Satz stehen außerhalb der
 * Suspense-Grenze und damit schon im vorgerenderten HTML.
 */
export default function ResetPasswordPage(): React.JSX.Element {
  return (
    <KundeFokusShell titel="Neues Passwort" zurueck={{ href: '/login', label: 'Zurück zur Anmeldung' }}>
      <div className="mx-auto w-full max-w-[520px] px-4 pt-6 pb-12 md:pt-10">
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 md:p-6">
          <div>
            <h2 className="font-heading text-[22px] leading-tight font-semibold text-foreground md:text-2xl">Neues Passwort wählen</h2>
            <p className="mt-1 text-[14px] leading-normal text-muted-foreground">Für dein {MARKE}-Konto.</p>
          </div>
          {/* useSearchParams verlangt beim Prerendern eine Suspense-Grenze */}
          <Suspense fallback={null}>
            <NeuesPasswortFormular />
          </Suspense>
          <Link href="/login" className={cn(TEXTKNOPF, 'self-center')}>
            Zurück zur Anmeldung
          </Link>
        </div>
      </div>
    </KundeFokusShell>
  )
}
