import Image from 'next/image'
import { bildStil } from '@/lib/bild-ausschnitt'
import type { BildAusschnitt } from '@/schemas/bild-ausschnitt'
import { cn } from '@/lib/utils'
import { HofBildflaeche } from '@/components/hoefe/hof-bildflaeche'

/**
 * Das Bild einer Karte: Foto oder, ohne Foto, die Illustration der Kategorie
 * (Register N22; vorher Initialen). Seit Nr. 122 eine eigene Datei, damit
 * Hofkarte, Produktzeile und `HofKopf` (Region, N23) dasselbe Bild zeigen.
 */
export function Vorschaubild({
  foto,
  ausschnitt = null,
  illustration,
  sizes,
  gedaempft,
  className,
}: {
  foto: string | null
  /** Ausschnitt eines Produktfotos (Register N17, Nr. 98); die Fotos des Hofs stehen wie heute. */
  ausschnitt?: BildAusschnitt | null
  /** Ohne Foto: der Pfad der Illustration (hofIllustrationen bzw. illustrationPfad). */
  illustration: string
  sizes: string
  gedaempft: boolean
  className?: string
}): React.JSX.Element {
  if (!foto) {
    return <HofBildflaeche bilder={[illustration]} sizes={sizes} gedaempft={gedaempft} fuellen className={cn('shrink-0', className)} />
  }
  return (
    <span className={cn('relative block shrink-0 overflow-hidden bg-muted', className)}>
      <Image
        src={foto}
        alt=""
        fill
        sizes={sizes}
        // Ausgegraut wird nur das Bild — eine Deckkraft über dem Text drückte
        // ihn unter 4,5:1 (Axe color-contrast).
        className={cn('object-cover', gedaempft && 'opacity-60 grayscale')}
        // Gedämpft ohne Filter des Hofs: Ein Inline-Filter überschriebe sonst die Klasse grayscale.
        style={bildStil(ausschnitt, { filter: !gedaempft })}
      />
    </span>
  )
}
