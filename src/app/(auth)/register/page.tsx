import type { Metadata } from 'next'
import Link from 'next/link'
import { generateFormToken } from '@/lib/form-token'
import { SCHON_DABEI } from '@/lib/kunden-navigation'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN_INNEN } from '@/components/ui/fokus'
import { KundeFokusShell } from '@/components/shells/kunde-shell'
import { RegisterForm } from './register-form'

export const metadata: Metadata = {
  title: 'Hof registrieren — FarmerZone',
}

// Die Seite ist eine Server-Komponente, damit der signierte Zeitstempel BEIM
// RENDERN entsteht — das Formular selbst bleibt eine Client-Komponente
// (register-form.tsx). Gleiches Muster wie /admin: Server rechnet, Client bedient.
//
// force-dynamic ist hier keine Kosmetik: eine statisch vorgerenderte Seite
// würde allen Besuchern denselben, beliebig alten Token ausliefern — nach
// zwölf Stunden wäre die Registrierung für jeden abgelaufen.
export const dynamic = 'force-dynamic'

/**
 * Hof registrieren (Gate 5, Nr. 15) in der Fokus-Shell: keine Navigation,
 * nur Zurück, Titel und rechts der Weg zur Anmeldung (Mockup
 * mobil-h0-registrieren). Die Shell heißt „Kunde…", ist aber die einzige
 * Fokus-Form des neuen Designs; die Farbe der Hofwelt (Orange) setzt das
 * Formular selbst. Die Frage vor „Anmelden" lautet seit Nr. 41 wie unter dem
 * Formular „Schon dabei?" (SCHON_DABEI, Register N1) — vorher „Schon
 * registriert?".
 */
export default function RegisterPage(): React.JSX.Element {
  return (
    <KundeFokusShell
      titel="Hof registrieren"
      zurueck={{ href: '/fuer-hoefe', label: 'Zurück zu Für Höfe' }}
      rechts={
        <span className="flex items-center gap-3">
          <span className="hidden md:inline">{SCHON_DABEI.frage}</span>
          <Link
            href={SCHON_DABEI.href}
            className={cn(
              'inline-flex min-h-11 items-center rounded-full border border-border px-4 text-[13.5px] font-medium text-foreground hover:bg-muted',
              // Innen: Der Platz rechts in der Fokus-Shell schneidet über `truncate` ab.
              FOKUS_RAHMEN_INNEN
            )}
          >
            {SCHON_DABEI.link}
          </Link>
        </span>
      }
    >
      <RegisterForm formToken={generateFormToken()} />
    </KundeFokusShell>
  )
}
