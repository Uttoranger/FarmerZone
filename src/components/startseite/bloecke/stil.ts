import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'

/*
 * Gemeinsame Maße der vier Vorlagen (Register N16, Nr. 96) — dieselbe Breite
 * wie die Abschnitte der Startseite (startseite-abschnitte.tsx), damit ein
 * Block zwischen ihnen nicht aus der Flucht fällt.
 */
export const BLOCK_CONTAINER = 'mx-auto max-w-[1200px] px-4 md:px-6'

/** Ein Block steht zwischen zwei Abschnitten — oben und unten ein kleiner Abstand, den Rest tragen die Abschnitte. */
export const BLOCK_ABSTAND = 'py-5 md:py-6'

/** Der umrandete Link-Knopf der Startseite (wie „Mehr für Höfe"). */
export const BLOCK_KNOPF_UMRISS = cn(
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-border px-[18px] text-sm font-medium text-foreground transition-colors duration-[250ms] hover:bg-muted',
  FOKUS_RAHMEN
)

/** Der grüne Handlungsknopf der Kundenwelt (wie in den Abschnitten der Startseite). */
export const BLOCK_KNOPF_GRUEN = cn(
  'inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-[18px] text-sm font-semibold text-accent-foreground transition-opacity duration-[250ms] hover:opacity-90',
  FOKUS_RAHMEN
)

/** Die Kennung der Überschrift eines Blocks — für aria-labelledby, eindeutig je Block. */
export function blockTitelId(blockId: string): string {
  return `block-${blockId}-titel`
}
