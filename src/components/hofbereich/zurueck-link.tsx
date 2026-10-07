import type { ReactNode } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { cn } from '@/lib/utils'

/**
 * Der Rückweg „‹ …" über einer Unterseite des Hofbereichs (seit Nr. 22e:
 * Neuer Beitrag, WhatsApp fortsetzen, Meldung abgeben) — dieselbe Gestalt wie
 * „‹ Einstellungen" und „‹ Alle Kunden": leise Schrift, 44 px hoch, sichtbarer
 * Fokus. `className` blendet ihn z. B. ab einer Breite aus, wo ein anderer
 * Weg zurück sichtbar ist.
 */
export function ZurueckLink({ href, children, className }: { href: string; children: ReactNode; className?: string }): React.JSX.Element {
  return (
    <Link
      href={href}
      className={cn(
        '-ml-1.5 mb-2 inline-flex min-h-11 w-fit items-center gap-1 rounded-full pr-3 pl-1 text-sm font-medium text-muted-foreground transition-colors duration-[250ms] hover:text-foreground',
        FOKUS_RAHMEN,
        className
      )}
    >
      <ChevronLeft className="size-5" strokeWidth={1.7} aria-hidden="true" />
      {children}
    </Link>
  )
}
