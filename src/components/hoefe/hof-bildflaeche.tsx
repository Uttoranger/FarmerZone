import Image from 'next/image'
import { cn } from '@/lib/utils'
import { ILLUSTRATION_BILD, ILLUSTRATION_HUELLE } from '@/components/ui/bild-dunkel'

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
 * beschattet und wie ein Foto gedämpft (ILLUSTRATION_HUELLE aus ui/bild-dunkel.ts,
 * dieselbe Quelle wie Hofseite und Produktseite; F041, 9.11.2026): Die Illustration
 * steht auf ihrem eigenen hellen Grund, sie wird nicht mehr mit der Fläche verrechnet.
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
      className={cn('flex justify-center overflow-hidden bg-muted dark:ring-1 dark:ring-border', ILLUSTRATION_HUELLE, className)}
    >
      {bilder.map((src) => (
        <span key={src} className={cn('relative h-full min-w-0', fuellen ? 'flex-1' : 'aspect-square shrink')}>
          <Image
            src={src}
            alt=""
            fill
            sizes={sizes}
            className={cn('object-cover', ILLUSTRATION_BILD, gedaempft && 'opacity-60 grayscale')}
          />
        </span>
      ))}
    </span>
  )
}
