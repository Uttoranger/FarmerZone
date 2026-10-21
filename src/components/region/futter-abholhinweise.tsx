import { ABHOLHINWEIS_SYMBOL, ABHOLHINWEIS_TEXT, type AbholhinweisValue } from '@/lib/abholhinweise'
import { cn } from '@/lib/utils'

/** Ein Kennzeichen: der Hinweis und — wenn nicht alle Größen ihn tragen — die Größen davor. */
export type AbholhinweisEintrag = { hinweis: AbholhinweisValue; groessen?: string | null }

/**
 * Die Abholhinweise als kleine Kennzeichen mit Symbol (Register N23, Nr. 123;
 * Board system-h5-region-eigene-teile §3): „Anhänger nötig", „Rundballen:
 * Verladen mit Frontlader". EIN Baustein für die Futterkarte in „Futter
 * kaufen" und die Produktseite. Welche Größe vorn steht, entscheidet
 * `abholKennzeichen` (src/lib/futter-kaufen.ts); hier wird nur gezeichnet —
 * neutral, ohne Zustandsfarbe, weil es Angaben sind und kein Zustand.
 */
export function AbholhinweisZeile({ hinweise, className }: { hinweise: readonly AbholhinweisEintrag[]; className?: string }): React.JSX.Element {
  return (
    <ul aria-label="Abholhinweise" className={cn('flex flex-wrap gap-1.5', className)}>
      {hinweise.map(({ hinweis, groessen }) => {
        const Symbol = ABHOLHINWEIS_SYMBOL[hinweis]
        const text = groessen ? `${groessen}: ${ABHOLHINWEIS_TEXT[hinweis]}` : ABHOLHINWEIS_TEXT[hinweis]
        return (
          <li
            key={hinweis}
            className="inline-flex max-w-full items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[12px] leading-snug text-foreground"
          >
            <Symbol className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.8} aria-hidden="true" />
            <span className="min-w-0 break-words">{text}</span>
          </li>
        )
      })}
    </ul>
  )
}
