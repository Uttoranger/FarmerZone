'use client'

import { Clock } from 'lucide-react'
import { ABHOLZEILE_TEXT, abholLage, abholzeileText, type AbholFenster } from '@/lib/hofuebersicht'
import { cn } from '@/lib/utils'
import { useUhr } from '@/components/hoefe/use-uhr'

/**
 * Die Abholzeile (Register N22, Board system-k1-entdecken-v2): EINE Zeile, die
 * in Liste, Karussell und Pin-Vorschau gleich aussieht — „Abholung heute
 * 15:00–18:00" in Grün (es geht), „Macht gerade Pause – …" in Orange, „Noch
 * nicht bestellbar" grau. Zustandsfarben, nie Knopffarben.
 *
 * Gerechnet wird mit der Uhr des Browsers (useUhr): beim Hydrieren der
 * Zeitpunkt des Servers, danach die eigene Uhr, auf die Minute — eine bis zu
 * zehn Minuten alte Seite zeigt so nach Mitternacht nicht „heute" für
 * gestern. Die Regel steht in src/lib/hofuebersicht.ts (abholLage), die Zeile
 * zeichnet nur. Region bindet sie in Lauf 19 ein.
 */
export function Abholzeile({
  fenster,
  isPaused,
  bestellbar = true,
  jetzt,
  className,
}: {
  /** Die aktiven Abholzeiten; fehlt das Feld (alter Cache-Eintrag), gilt „keine". */
  fenster: readonly AbholFenster[] | undefined
  isPaused: boolean
  /** istBestellbar (src/lib/bereiche-anzeige.ts): ohne kaufbares Produkt „Noch nicht bestellbar". */
  bestellbar?: boolean
  /** Der Zeitpunkt des Servers beim Bauen der Seite (ISO-Text). */
  jetzt: string
  className?: string
}): React.JSX.Element {
  const uhr = useUhr(jetzt)
  const lage = abholLage(fenster, isPaused, uhr)
  if (lage.art === 'pause') {
    return <p className={cn('text-[13px] font-semibold text-status-offen', className)}>{ABHOLZEILE_TEXT.pause}</p>
  }
  const text = bestellbar ? abholzeileText(lage) : null
  if (!text) {
    return <p className={cn('text-[13px] text-muted-foreground', className)}>{ABHOLZEILE_TEXT.nichtBestellbar}</p>
  }
  return (
    <p
      data-abholung={lage.art}
      className={cn('flex items-center gap-1.5 text-[13px] text-status-fertig', lage.art === 'heute' && 'font-semibold', className)}
    >
      <Clock className="size-3.5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
      <span className="min-w-0">{text}</span>
    </p>
  )
}
