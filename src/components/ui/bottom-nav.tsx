import type { ReactNode } from 'react'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { Zaehler } from '@/components/ui/zaehler'

/**
 * BottomNav: die Unterleiste am Handy (unter 768 px) mit erhobenem
 * Mittelknopf — Kunde: Warenkorb (grün), Hof: „+ Neu" (orange)
 * (docs/ai/DESIGN_SYSTEM.md, „Navigation"). Die Leiste ordnet nichts selbst:
 * Welche Einträge in welcher Reihenfolge stehen, kommt aus der
 * Navigations-Quelle der Welt (bauern-navigation.ts, kunden-navigation.ts),
 * die Shell setzt die Teile zusammen.
 *
 * Teile:
 *  - `BottomNav`: die feste Leiste, `<nav>`, mit Abstand für den
 *    Home-Indicator (safe-area-inset-bottom).
 *  - `BottomNavLink`: ein Ziel mit Symbol und kurzem Namen.
 *  - `BottomNavMitte`: der Platz in der Mitte; darin ein Link oder Knopf mit
 *    `mittelknopfKlassen(ton)` (ein Knopf kann so auch ein SheetTrigger sein).
 *  - `bottomNavEintragKlassen`: dieselbe Gestalt wie ein Link, für Knöpfe
 *    (z. B. „Mehr", das ein Blatt öffnet).
 *  - `mittelknopfMitWortKlassen` + `mittelkreisKlassen`: der Mittelknopf mit
 *    einem Wort unter dem Kreis (Hof: „Neu", freigabe.md §12 Nr. 45).
 */
export function BottomNav({
  beschriftung = 'Hauptnavigation',
  ueberSchleier = false,
  children,
  className,
}: {
  beschriftung?: string
  /** Solange ein Blatt der Leiste offen ist, liegt sie über dessen Schleier (Ebene 60), sonst auf 50. */
  ueberSchleier?: boolean
  children: ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <nav
      aria-label={beschriftung}
      data-slot="bottom-nav"
      // Feste Leiste unten: Der Cookie-Hinweis steht darüber, nie darauf (src/lib/cookie-hinweis.ts).
      data-unten-fest=""
      className={cn(
        'fixed inset-x-0 bottom-0 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden print:hidden',
        ueberSchleier ? 'z-[60]' : 'z-50',
        className
      )}
    >
      <div className="flex h-[68px] items-stretch px-2">{children}</div>
    </nav>
  )
}

/** Gestalt eines Eintrags — aktiv heißt Textfarbe und fett, sonst die leise Farbe. */
export function bottomNavEintragKlassen(aktiv: boolean): string {
  return cn(
    'relative flex min-w-0 flex-1 flex-col items-center justify-center gap-[3px] rounded-xl text-[10.5px] leading-none transition-colors duration-[250ms]',
    aktiv ? 'font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground',
    FOKUS_RAHMEN
  )
}

export function BottomNavLink({
  href,
  label,
  symbol: Symbol,
  aktuell,
  zahl,
  zahlWofuer = '',
  onNavigate,
}: {
  href: string
  label: string
  symbol: LucideIcon
  /** aria-current aus der Navigations-Quelle; hebt den Eintrag hervor. */
  aktuell?: 'page' | 'true'
  zahl?: number
  zahlWofuer?: string
  onNavigate?: () => void
}): React.JSX.Element {
  return (
    <Link href={href} onClick={onNavigate} aria-current={aktuell} className={bottomNavEintragKlassen(aktuell !== undefined)}>
      <span className="relative">
        <Symbol className="size-[22px]" strokeWidth={1.7} aria-hidden="true" />
        <Zaehler anzahl={zahl} wofuer={zahlWofuer} className="absolute -top-1.5 -right-2.5 h-4 min-w-4 px-1 text-[9.5px]" />
      </span>
      <span className="max-w-full truncate px-0.5">{label}</span>
    </Link>
  )
}

/** Der Platz des Mittelknopfs — gleich breit wie ein Eintrag, der Knopf ragt nach oben heraus. */
export function BottomNavMitte({ children }: { children: ReactNode }): React.JSX.Element {
  return <div className="flex flex-1 items-start justify-center">{children}</div>
}

/**
 * Der erhobene, runde Mittelknopf: 54 px, 20 px über die Leiste gehoben, mit
 * einem Kragen in der Leistenfarbe. Grün = Kundenaktion, Orange = Hofaktion.
 * Ein Symbol allein braucht ein aria-label am Element.
 */
export function mittelknopfKlassen(ton: 'gruen' | 'orange'): string {
  return cn(
    'relative -mt-5 flex size-[54px] shrink-0 items-center justify-center rounded-full shadow-lg ring-4 ring-card transition-colors duration-[250ms]',
    ton === 'gruen' ? 'bg-accent text-accent-foreground hover:bg-accent-hover' : 'bg-primary text-primary-foreground hover:bg-primary/90',
    FOKUS_RAHMEN
  )
}

/**
 * Der Mittelknopf mit Wort (Hof: „Neu" unter dem Plus, freigabe.md §12
 * Nr. 45): Die Fläche ist der ganze Knopf — Kreis UND Wort —, also größer als
 * der Kreis allein, nie kleiner. Der Kreis bleibt 54 px und 20 px gehoben
 * (`mittelkreisKlassen` als Span im Knopf), das Wort steht auf der Höhe der
 * übrigen Beschriftungen der Leiste (Kreis 54 − 20 + 7 Abstand = 41 px, wie
 * die Wörter der Einträge). Den Fokusrahmen trägt der Knopf, nicht der Kreis.
 */
export function mittelknopfMitWortKlassen(): string {
  return cn(
    'group relative -mt-5 flex shrink-0 flex-col items-center gap-[7px] rounded-2xl text-[10.5px] leading-none text-muted-foreground transition-colors duration-[250ms] hover:text-foreground',
    FOKUS_RAHMEN
  )
}

/** Der Kreis im Mittelknopf mit Wort — Gestalt wie `mittelknopfKlassen`, Hover über den ganzen Knopf. */
export function mittelkreisKlassen(ton: 'gruen' | 'orange'): string {
  return cn(
    'flex size-[54px] shrink-0 items-center justify-center rounded-full shadow-lg ring-4 ring-card transition-colors duration-[250ms]',
    ton === 'gruen' ? 'bg-accent text-accent-foreground group-hover:bg-accent-hover' : 'bg-primary text-primary-foreground group-hover:bg-primary/90'
  )
}
