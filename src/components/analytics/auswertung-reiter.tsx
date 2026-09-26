import Link from 'next/link'
import { cn } from '@/lib/utils'

const REITER = [
  { key: 'umsatz', label: 'Umsatz', href: '/analytics' },
  { key: 'umfeld', label: 'Umfeld', href: '/analytics/umfeld' },
] as const

/**
 * Die Reiter der Auswertung: „Umsatz" (das Bisherige) und „Umfeld" (Konzept
 * Umfeld §4). Als Links, nicht als Tabs-Komponente: Jeder Reiter hat seine
 * eigene Adresse, Zurück und Neuladen landen im richtigen. Bewusst als
 * Unterstrich-Reiter gestaltet — die Zeitraum-Wahl darunter ist eine
 * Segment-Wanne, zwei gleiche Wannen übereinander läsen sich wie eine Wahl.
 */
export function AuswertungReiter({ aktiv }: { aktiv: (typeof REITER)[number]['key'] }) {
  return (
    <nav aria-label="Auswertung" className="mb-6 flex border-b border-border">
      {REITER.map((reiter) => {
        const gewaehlt = reiter.key === aktiv
        return (
          <Link
            key={reiter.key}
            href={reiter.href}
            aria-current={gewaehlt ? 'page' : undefined}
            className={cn(
              '-mb-px inline-flex min-h-11 items-center border-b-2 px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              gewaehlt
                ? 'border-brand-text text-brand-text'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {reiter.label}
          </Link>
        )
      })}
    </nav>
  )
}
