'use client'

import { ABHOLZEILE_TEXT, abholLage, abholzeileText, type AbholFenster } from '@/lib/hofuebersicht'
import { cn } from '@/lib/utils'
import { useUhr } from '@/components/hoefe/use-uhr'

/**
 * Die Abholzeile (Register N22, Board system-k1-entdecken-v2): EINE Zeile, die
 * in Liste, Karussell und Pin-Vorschau gleich aussieht — „Abholung heute
 * 15:00–18:00" in Grün (es geht), „Macht gerade Pause – …" leise und halbfett
 * (V18, Boards s1/w1-hoefe: ein pausierter Hof steht neutral da, nicht als
 * Aufgabe), „Noch nicht bestellbar" grau. Zustandsfarben, nie Knopffarben.
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
  leise = false,
}: {
  /** Die aktiven Abholzeiten; fehlt das Feld (alter Cache-Eintrag), gilt „keine". */
  fenster: readonly AbholFenster[] | undefined
  isPaused: boolean
  /** istBestellbar (src/lib/bereiche-anzeige.ts): ohne kaufbares Produkt „Noch nicht bestellbar". */
  bestellbar?: boolean
  /** Der Zeitpunkt des Servers beim Bauen der Seite (ISO-Text). */
  jetzt: string
  className?: string
  /**
   * Als Teil einer grauen Meta-Zeile („Hof · 3 km · Abholung heute …“, Produkttreffer auf /hoefe; Liste Lauf 32,
   * hoefe Bild 2, Abnahme hoefe 10): ein <span> in der Schrift der Zeile, ohne eigenes Grün und Fett.
   */
  leise?: boolean
}): React.JSX.Element {
  const uhr = useUhr(jetzt)
  const lage = abholLage(fenster, isPaused, uhr)
  if (leise) {
    const satz = lage.art === 'pause' ? ABHOLZEILE_TEXT.pause : ((bestellbar ? abholzeileText(lage) : null) ?? ABHOLZEILE_TEXT.nichtBestellbar)
    return (
      <span data-abholung={lage.art} className={className}>
        {satz}
      </span>
    )
  }
  if (lage.art === 'pause') {
    return <p data-abholung="pause" className={cn('text-[13px] font-semibold text-muted-foreground', className)}>{ABHOLZEILE_TEXT.pause}</p>
  }
  const text = bestellbar ? abholzeileText(lage) : null
  if (!text) {
    return <p className={cn('text-[13px] text-muted-foreground', className)}>{ABHOLZEILE_TEXT.nichtBestellbar}</p>
  }
  return (
    // Fett in der grünen Schrift, ohne Uhr (Liste Lauf 32, hoefe; Nr. 252).
    <p data-abholung={lage.art} className={cn('text-[13px] font-semibold text-brand-text', className)}>
      {text}
    </p>
  )
}
