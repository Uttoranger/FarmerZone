import { Children, type ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'

/**
 * Chip: ein kurzes Merkmal ohne Handlung („Eier", „Gemüse", „Frontlader vor
 * Ort"). Lange Texte kürzen mit Auslassung; der volle Text steht im `title`.
 */
export function Chip({
  children,
  title,
  className,
}: {
  children: ReactNode
  title?: string
  className?: string
}): React.JSX.Element {
  return (
    <span
      data-slot="chip"
      title={title}
      className={cn(
        'inline-flex max-w-full items-center rounded-full bg-muted px-2.5 py-0.5 text-[11.5px] text-muted-foreground',
        className
      )}
    >
      <span className="min-w-0 truncate">{children}</span>
    </span>
  )
}

/**
 * FilterChip: ein Filter ist ein echter Link (docs/ai/DESIGN_SYSTEM.md,
 * „Links und Filter") — der Filter steht in der Adresse, damit Teilen,
 * Zurück und Mittelklick funktionieren. Der gewählte Chip führt auf die
 * Seite, die gerade offen ist, und trägt deshalb `aria-current="page"`.
 *
 * Sichtbar 36 px hoch wie im Mockup; die Trefferfläche reicht über ein
 * unsichtbares ::before auf 44 px (Touch-Ziel).
 *
 * `onNavigate` (zusätzlich, Nr. 09) reicht an Nexts Link weiter: Er läuft
 * nur bei einem gewöhnlichen Klick in der App, nie bei Mittelklick, Strg-Klick
 * oder „In neuem Tab öffnen". Eine Seite, die ihre Filter selbst im Browser
 * anwendet (/hoefe), schreibt dort die Adresse per `history.replaceState` und
 * ruft `preventDefault()` — so bleibt der Chip ein echter Link, und der Tipp
 * kostet keinen Server-Aufruf.
 */
export function FilterChip({
  href,
  aktiv = false,
  children,
  className,
  onNavigate,
}: {
  href: string
  aktiv?: boolean
  children: ReactNode
  className?: string
  onNavigate?: (ereignis: { preventDefault: () => void }) => void
}): React.JSX.Element {
  return (
    <Link
      href={href}
      onNavigate={onNavigate}
      // Wer selbst anwendet, braucht die Seite nicht vorab vom Server: Bei
      // einer dynamischen Seite wäre das eine Anfrage je sichtbarem Chip.
      prefetch={onNavigate ? false : undefined}
      data-slot="filter-chip"
      aria-current={aktiv ? 'page' : undefined}
      className={cn(
        "relative inline-flex h-9 shrink-0 items-center rounded-full border px-4 text-[13.5px] whitespace-nowrap transition-colors duration-[250ms] before:absolute before:inset-x-0 before:-inset-y-1 before:content-['']",
        aktiv
          ? 'border-foreground bg-foreground font-semibold text-background'
          : 'border-border bg-card font-medium text-foreground hover:bg-muted',
        FOKUS_RAHMEN,
        className
      )}
    >
      {children}
    </Link>
  )
}

/** Eine Reihe Filter-Chips, die am Handy waagrecht scrollt statt umzubrechen. */
export function FilterChipReihe({
  beschriftung,
  children,
  className,
}: {
  /** Wofür die Reihe filtert, für Screenreader: „Kategorie". */
  beschriftung: string
  children: ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <div className={cn('-mx-4 overflow-x-auto px-4 py-1 md:mx-0 md:px-0', className)}>
      <ul aria-label={beschriftung} className="flex gap-2 md:flex-wrap">
        {Children.toArray(children).map((kind, i) => (
          <li key={i}>{kind}</li>
        ))}
      </ul>
    </div>
  )
}
