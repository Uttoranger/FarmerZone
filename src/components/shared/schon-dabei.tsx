import Link from 'next/link'
import { SCHON_DABEI } from '@/lib/kunden-navigation'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'

/**
 * „Schon dabei? Anmelden" (→ /login) — der Weg bestehender Höfe zur
 * Anmeldung, wo sonst nur Registrieren angeboten wird (Register N1): im Band
 * „Für Höfe" der Startseite, auf /fuer-hoefe oben und unten und auf
 * /register. Text und Ziel aus src/lib/kunden-navigation.ts. Der Link ist
 * 44 px hoch, damit er auch am Handy sicher zu treffen ist.
 */
export function SchonDabei({ className }: { className?: string }): React.JSX.Element {
  return (
    <p className={cn('text-[13.5px] text-foreground', className)}>
      {SCHON_DABEI.frage}{' '}
      <Link
        href={SCHON_DABEI.href}
        className={cn(
          'inline-flex min-h-11 items-center rounded-md px-1 font-semibold text-status-fertig underline underline-offset-2 hover:no-underline',
          FOKUS_RAHMEN
        )}
      >
        {SCHON_DABEI.link}
      </Link>
    </p>
  )
}
