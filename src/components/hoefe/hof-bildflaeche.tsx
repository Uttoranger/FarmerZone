import Image from 'next/image'
import { cn } from '@/lib/utils'

// Bilder im Dunkeln (Freigabe Lauf 31, Maßstab Punkt 4: keine hellen Flecken) — dieselben Werte wie
// Hofseite und Produktseite (ILLUSTRATION_HUELLE/-BILD, FOTO_HUELLE in hofseite/produkt-karte.tsx,
// Nr. 235). Hier eigens, weil jene Datei ein Client-Modul ist: Eine Server-Komponente (Startseite)
// bekäme aus ihr nur einen Verweis statt der Klassen. Eine gemeinsame Quelle in ui/ ist Nacharbeit (242).
// Illustration: mit der Fläche der Hülle multipliziert, die Hülle hellt danach auf; Foto: leicht dunkler
// (FOTO_HUELLE_DUNKEL nehmen auch Vorschaubild, Fotostreifen und die Hofkarten der Startseite).
const ILLUSTRATION_HUELLE_DUNKEL = 'dark:brightness-[1.6]'
const ILLUSTRATION_BILD_DUNKEL = 'dark:mix-blend-multiply'
export const FOTO_HUELLE_DUNKEL = 'dark:brightness-[0.85]'

/**
 * Die Bildfläche einer Hofkarte ohne Foto (Register N22, Board
 * system-k1-entdecken-v2 „Ohne Foto"): die Illustrationen der ersten ein bis
 * drei Kategorien nebeneinander, in derselben Höhe wie ein Foto — die Liste
 * springt nicht, der Hof wirkt nicht leer. Die Pfade kommen aus
 * hofIllustrationen bzw. illustrationPfad (src/lib/hoefe-anzeige.ts,
 * src/lib/taxonomie.ts) — dieselbe Quelle wie Produktseite und Teilen-Bild.
 *
 * Reiner Schmuck (`alt=""`): Der Hofname steht direkt darunter. Jede
 * Illustration steht quadratisch auf ihrem Creme-Grund; die Fläche dahinter
 * ist `bg-muted`, im hellen Theme fast derselbe Ton. Im Dunkeln gerahmt statt
 * beschattet und mit der Fläche multipliziert (ILLUSTRATION_HUELLE_DUNKEL/-BILD_DUNKEL
 * wie Hofseite und Produktseite, Nr. 234): Mit `brightness` allein leuchtete der
 * Crème-Grund noch als hellgraues Quadrat (Abnahme Lauf 31).
 *
 * `fuellen`: Die Bilder teilen sich die Breite, statt quadratisch zu bleiben —
 * für kleine Vorschaubilder (Splitscreen, Karussell, Produktzeile), in denen
 * ein Quadrat Ränder ließe.
 */
export function HofBildflaeche({
  bilder,
  sizes,
  gedaempft = false,
  fuellen = false,
  className,
}: {
  bilder: readonly string[]
  /** next/image-sizes für EIN Bild der Fläche. */
  sizes: string
  /** Pausiert oder „derzeit aus": entsättigt wie ein Foto. */
  gedaempft?: boolean
  fuellen?: boolean
  className?: string
}): React.JSX.Element {
  return (
    <span
      data-slot="hof-bildflaeche"
      className={cn('flex justify-center overflow-hidden bg-muted dark:ring-1 dark:ring-border', ILLUSTRATION_HUELLE_DUNKEL, className)}
    >
      {bilder.map((src) => (
        <span key={src} className={cn('relative h-full min-w-0', fuellen ? 'flex-1' : 'aspect-square shrink')}>
          <Image
            src={src}
            alt=""
            fill
            sizes={sizes}
            className={cn('object-cover', ILLUSTRATION_BILD_DUNKEL, gedaempft && 'opacity-60 grayscale')}
          />
        </span>
      ))}
    </span>
  )
}
