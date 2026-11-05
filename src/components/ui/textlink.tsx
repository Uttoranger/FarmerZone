import type { ComponentProps } from 'react'
import Link from 'next/link'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { TREFFER_44 } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Schrift je Ton: Grün für Kundensachen, Orange für den Hof (Text-Tokens, nie `text-primary`), leise für Nebenwege. */
const TON_SCHRIFT = {
  gruen: 'text-status-fertig',
  orange: 'text-status-offen',
  leise: 'text-muted-foreground hover:text-foreground',
} as const

/**
 * Die Klassen eines Textlinks mit Trefferfläche ≥ 44 px (V16; Boards w1-korb „Route planen →",
 * w1-mehr-neu „Hofseite ansehen"). `form="zeile"` (Standard): ein eigener Link in einer Zeile,
 * selbst 44 px hoch. `form="im-satz"`: ein Link mitten im Fließtext — er bleibt so hoch wie die
 * Zeile, die Fläche kommt über `::before` (TREFFER_44, wie die kleinen Knöpfe), damit der Satz
 * nicht auseinanderläuft. Unterstrichen im Satz immer, in der Zeile beim Darüberfahren.
 */
export function textlinkKlassen({ ton = 'gruen', form = 'zeile' }: { ton?: keyof typeof TON_SCHRIFT; form?: 'zeile' | 'im-satz' } = {}): string {
  return cn(
    'rounded-sm font-semibold underline-offset-2',
    form === 'zeile' ? 'inline-flex min-h-11 items-center text-[15px] hover:underline' : cn(TREFFER_44, 'underline'),
    TON_SCHRIFT[ton],
    FOKUS_RAHMEN
  )
}

/**
 * Textlink (V16): ein Link, der wie Text aussieht und sich trotzdem mit dem Daumen treffen lässt.
 * Ziel über next/link; für Knöpfe ohne Ziel `textlinkKlassen` an einem `<button>`.
 */
export function Textlink({
  ton,
  form,
  className,
  ...props
}: ComponentProps<typeof Link> & { ton?: keyof typeof TON_SCHRIFT; form?: 'zeile' | 'im-satz' }): React.JSX.Element {
  return <Link data-slot="textlink" className={cn(textlinkKlassen({ ton, form }), className)} {...props} />
}
