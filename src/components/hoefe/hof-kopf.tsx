import { formatiereEntfernung } from '@/lib/hofuebersicht'
import { cn } from '@/lib/utils'
import { Vorschaubild } from '@/components/hoefe/hof-vorschaubild'

/**
 * Der Kopf eines Hofs (Register N22, N23): Name fett (höchstens zwei Zeilen),
 * darunter PLZ und Ort mit der Entfernung dahinter (Boards w1-/s1-hoefe,
 * Nr. 234; vorher Serif und die Entfernung rechts neben dem Namen). EINE Quelle für die
 * Hofkarte der Liste, die kurze Hofkarte am Pin und Region — vorher stand er
 * in jeder Karte als eigene Kopie. Karussell (hoefe-karussell.tsx) und
 * Produkttreffer (`ProduktZeile` in entdecken-teile.tsx) haben bewusst ihren
 * eigenen Kopf: Sie sind keine Hofkarten, dort ist das Produkt bzw. die Reihe
 * die Hauptsache (Register F10).
 *
 * Ohne `bild` sind es zwei Geschwister (Name, Zeile mit Ort und Entfernung) —
 * die Karte stapelt sie in ihrer Spalte. Mit `bild` steht links ein Foto bzw. die
 * Illustration der Kategorie (Kante 40 rund wie in der Karte am Pin von
 * Region, 48 mit Ecken wie die Produktzeile).
 */
export function HofKopf({
  hof,
  als: Name = 'p',
  gedaempft = false,
  bild,
}: {
  hof: HofKopfDaten
  /** Das Element des Namens: h2 in der Liste, h3 unter einer Überschrift, p in Karten ohne Gliederung. */
  als?: 'h2' | 'h3' | 'p'
  /** Pausierter Hof: der Name leiser, lesbar bleibt er. */
  gedaempft?: boolean
  bild?: { foto: string | null; illustration: string; kante: 40 | 48 }
}): React.JSX.Element {
  const zeilen = (
    <>
      <Name
        className={cn(
          'line-clamp-2 min-w-0 text-[17px] leading-snug font-bold break-words',
          gedaempft ? 'text-muted-foreground' : 'text-foreground'
        )}
      >
        {hof.name}
      </Name>
      {/* Die Entfernung hinter dem Ort, wie in den Boards w1-/s1-hoefe („5280 Braunau am Inn · 3 km"). */}
      <p className="truncate text-[13px] text-muted-foreground">
        {hof.postalCode} {hof.city}
        {hof.entfernungKm !== null && ` · ${formatiereEntfernung(hof.entfernungKm)}`}
      </p>
    </>
  )
  if (!bild) return zeilen
  return (
    <div className="flex items-center gap-2.5">
      <Vorschaubild
        foto={bild.foto}
        illustration={bild.illustration}
        sizes={`${bild.kante}px`}
        gedaempft={gedaempft}
        className={bild.kante === 40 ? 'size-10 rounded-full' : 'size-12 rounded-[10px]'}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">{zeilen}</div>
    </div>
  )
}

/** Was der Kopf vom Hof braucht. */
export type HofKopfDaten = {
  name: string
  postalCode: string
  city: string
  /** Luftlinie zum Bezugspunkt; null = ohne Bezugspunkt, dann steht nur der Ort. */
  entfernungKm: number | null
}
