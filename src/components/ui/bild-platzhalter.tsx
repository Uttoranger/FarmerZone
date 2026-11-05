import { Plus } from 'lucide-react'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { cn } from '@/lib/utils'

/**
 * Der Verlauf des Platzhalters (V15; Boards s1-hofseite, s1-hoefe, s1-produkt-neu): hell von Sand
 * nach zartem Grün, dunkel ein eigener, gedämpfter Verlauf (Grün-Grau) — beides aus Tokens über
 * der Fläche, keine Hexwerte. Gleiche Klassen in beiden Modi; nur die Tokens wechseln.
 */
const VERLAUF = 'bg-card bg-linear-135 from-primary/14 to-accent/12 dark:from-foreground/8 dark:to-accent/20'

/** Der Text des Knopfs im Formular. */
export const FOTO_HINZUFUEGEN = 'Foto hinzufügen'

/**
 * Bild-Platzhalter ohne Dateinamen (V15): wo ein Foto fehlt, steht eine ruhige Fläche mit Verlauf
 * — kein Dateiname, kein Symbol mit Text, nichts zum Vorlesen (`aria-hidden`). Höhe, Breite und
 * Rundung gibt der Aufrufer (`className`), wie die Karte es braucht. `gedaempft` graut ihn aus wie
 * das Foto eines pausierten Hofs (V18).
 */
export function BildPlatzhalter({ className, gedaempft }: { className?: string; gedaempft?: boolean }): React.JSX.Element {
  return <div data-slot="bild-platzhalter" aria-hidden="true" className={cn('rounded-2xl border border-border', VERLAUF, gedaempft && 'grayscale', className)} />
}

/**
 * „Foto hinzufügen" im Produktformular (V15; Board s1-produkt-neu, Bild 1): dieselbe Fläche als
 * Knopf, 84 px hoch, gestrichelt im Feldrand (`border-input`, ≥ 3:1), Plus und Wort in der Mitte.
 * Was der Knopf öffnet (Dateiwahl, Bild-Baustein), entscheidet der Aufrufer.
 */
export function FotoHinzufuegen({
  onClick,
  disabled,
  children = FOTO_HINZUFUEGEN,
  className,
}: {
  onClick?: () => void
  disabled?: boolean
  children?: React.ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <button
      type="button"
      data-slot="foto-hinzufuegen"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex h-[84px] w-full items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-dashed border-input text-[15px] font-bold text-foreground transition-opacity duration-[250ms] hover:opacity-90 disabled:opacity-60',
        VERLAUF,
        FOKUS_RAHMEN,
        className
      )}
    >
      <Plus className="size-5" strokeWidth={1.7} aria-hidden="true" />
      {children}
    </button>
  )
}
