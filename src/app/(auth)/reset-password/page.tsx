import { Suspense } from 'react'
import type { Metadata } from 'next'
import { KundeFokusShell } from '@/components/shells/kunde-shell'
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
 * und /verify: keine Navigation, nur Zurück zur Anmeldung und der Titel. Seit
 * Nr. 239 nach Board s2-/w2-passwort: ohne Karte, höchstens 520 px, genau ein
 * oranger Hauptknopf, ein ungültiger Link als orange Fehlerkarte mit Ausweg.
 *
 * Die Seite bleibt statisch: Den Token liest das Formular im Browser
 * (useSearchParams), wie bisher. Überschrift und Satz stehen außerhalb der
 * Suspense-Grenze und damit schon im vorgerenderten HTML.
 */
export default function ResetPasswordPage(): React.JSX.Element {
  return (
    <KundeFokusShell titel="Neues Passwort" zurueck={{ href: '/login', label: 'Zurück zur Anmeldung' }}>
      {/* Ohne Karte und ohne zweiten Rückweg: Den trägt der Kopf der Fokus-Shell (Board s2-/w2-passwort). */}
      {/* 520 px Inhalt wie im Board (Liste Lauf 32, passwort), darunter die Unterzeile „Für dein Agrilo-Konto.“ */}
      <div className="mx-auto flex w-full max-w-[552px] flex-col gap-3 px-4 pt-5 pb-12 md:pt-10">
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-[24px] leading-tight font-semibold text-foreground">Neues Passwort wählen</h2>
          <p className="text-[15px] leading-normal text-muted-foreground">Für dein {MARKE}-Konto.</p>
        </div>
        {/* useSearchParams verlangt beim Prerendern eine Suspense-Grenze */}
        <Suspense fallback={null}>
          <NeuesPasswortFormular />
        </Suspense>
      </div>
    </KundeFokusShell>
  )
}
