import { cn } from '@/lib/utils'

/**
 * Eine kleine Zahl an einem Eintrag: offene Bestellungen, Meldungen zu
 * entscheiden, Artikel im Korb. Orange heißt „hier wartet etwas auf dich"
 * (Hofbereich und Admin), Grün gehört zum Kaufen (Warenkorb) — die Farbrollen
 * aus docs/ai/DESIGN_SYSTEM.md.
 *
 * Für Screenreader steht hinter der Zahl, wofür sie zählt; ab 100 steht „99+"
 * da, die genaue Zahl im unsichtbaren Text. Null oder nichts: kein Zähler.
 */
export function Zaehler({
  anzahl,
  wofuer,
  ton = 'orange',
  className,
}: {
  anzahl: number | undefined
  /** Was gezählt wird, für Screenreader: „offene Bestellungen". */
  wofuer: string
  ton?: 'orange' | 'gruen'
  className?: string
}): React.JSX.Element | null {
  if (!anzahl || anzahl <= 0) return null
  return (
    <span
      data-slot="zaehler"
      className={cn(
        'inline-flex h-[19px] min-w-[19px] shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] leading-none font-semibold tabular-nums',
        ton === 'orange' ? 'bg-primary text-primary-foreground' : 'bg-accent text-accent-foreground',
        className
      )}
    >
      <span aria-hidden="true">{anzahl > 99 ? '99+' : anzahl}</span>
      <span className="sr-only">
        {anzahl} {wofuer}
      </span>
    </span>
  )
}
