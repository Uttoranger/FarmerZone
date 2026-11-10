import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Die Klassen einer Hofkarte in Listen (/hoefe, Startseite) je Zustand (V18; Board s1-hoefe,
 * „Hof am Weiher"): Ein pausierter Hof ist ausgegraut, nicht versteckt — Fläche `bg-muted` statt
 * `bg-card`, Rand 1,5 px gestrichelt im Feldrand (`border-input`, ≥ 3:1, damit das Strichmuster
 * auch im Dunkeln zu sehen ist), Bild ohne Farbe, die Zeile zur Abholung in der leisen Textfarbe
 * statt grün. Der Text bleibt voll lesbar (keine Deckkraft über die Karte): Name, Ort und Preise
 * behalten ihre Farben, nur der Zustand wird neutral. Was dort steht (die Nachricht des Hofs,
 * N41 b), entscheidet die Seite.
 */
export function hofkarteKlassen(pausiert: boolean): { rahmen: string; bild: string; abholung: string } {
  return {
    rahmen: cn(
      'relative overflow-hidden rounded-2xl transition-colors duration-[250ms]',
      pausiert ? 'border-[1.5px] border-dashed border-input bg-muted' : 'border border-border bg-card'
    ),
    bild: pausiert ? 'grayscale' : '',
    abholung: cn('text-[14px] font-semibold', pausiert ? 'text-muted-foreground' : 'text-status-fertig'),
  }
}

/**
 * Der Rahmen einer Hofkarte mit dem Zustand am Element (`data-pausiert`), damit Tests und Stile
 * dieselbe Quelle lesen. Inhalt, Link und Bild bringt die Seite (HofKarte in
 * src/components/hoefe); die Klassen für Bild und Abholzeile gibt hofkarteKlassen.
 */
export function HofkarteRahmen({
  pausiert,
  className,
  children,
}: {
  pausiert: boolean
  className?: string
  children?: ReactNode
}): React.JSX.Element {
  return (
    <article data-slot="hofkarte" data-pausiert={pausiert ? 'ja' : undefined} className={cn(hofkarteKlassen(pausiert).rahmen, className)}>
      {children}
    </article>
  )
}
