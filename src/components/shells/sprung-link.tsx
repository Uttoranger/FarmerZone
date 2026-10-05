import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'

/** Ziel des Sprunglinks — das <main> jeder Shell trägt diese id. */
export const INHALT_ID = 'inhalt'

/**
 * „Zum Inhalt springen": der erste Tabstopp jeder Shell. Wer mit der Tastatur
 * kommt, muss sonst durch die ganze Navigation, bevor er den Inhalt erreicht.
 * Unsichtbar, bis er den Fokus hat.
 */
export function SprungLink(): React.JSX.Element {
  return (
    <a
      href={`#${INHALT_ID}`}
      className={cn(
        'sr-only rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[70]',
        FOKUS_RAHMEN
      )}
    >
      Zum Inhalt springen
    </a>
  )
}
