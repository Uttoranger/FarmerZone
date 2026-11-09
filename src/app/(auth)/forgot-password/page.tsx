import type { Metadata } from 'next'
import { KundeFokusShell } from '@/components/shells/kunde-shell'
import { PasswortVergessenFormular } from './passwort-vergessen-formular'
import { MARKE } from '@/lib/marke'

export const metadata: Metadata = { title: `Passwort vergessen — ${MARKE}` }

/**
 * „Passwort vergessen?" in der Fokus-Shell (seit Nr. 54) — wie /register und
 * /verify: keine Navigation, nur Zurück zur Anmeldung und der Titel. Kein
 * Mockup bis Lauf 30; seit Nr. 239 nach Board s2-/w2-passwort: ohne Karte,
 * höchstens 520 px, genau ein oranger Hauptknopf. Die Seite selbst ist
 * statisch, das Formular eine Client-Komponente.
 */
export default function ForgotPasswordPage(): React.JSX.Element {
  return (
    <KundeFokusShell titel="Passwort vergessen" zurueck={{ href: '/login', label: 'Zurück zur Anmeldung' }}>
      {/* Ohne Karte direkt auf der Seite (Board s2-/w2-passwort); nur Erfolg und Fehler stehen gerahmt. */}
      {/* Im Browser 16 px unter dem Kopf wie im Board w2-passwort (pruefer-ui Lauf 33: h1 24 px zu tief; Nr. 275). */}
      <div className="mx-auto w-full max-w-[552px] px-4 pt-5 pb-12 md:pt-4">
        <PasswortVergessenFormular />
      </div>
    </KundeFokusShell>
  )
}
