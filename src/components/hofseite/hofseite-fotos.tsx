'use client'

import Image from 'next/image'
import type { PublicFarmPhoto } from '@/server/queries/farm'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { BildansichtEbene, useBildansicht } from '@/components/hofseite/bildansicht'

/** So viele Kacheln zeigt die Übersicht; auf der letzten steht „+N", die Bildansicht blättert durch alle. */
const SICHTBAR = 6

/**
 * „Fotos" in der Übersicht der Hofseite (Mockup web-k2-hofseite): ein Raster
 * aus Kacheln, jede ein Knopf, der die Bildansicht öffnet — kein Bild liegt in
 * einem Link (sonst sprang ein Tipp auf ein Bild auf eine andere Seite,
 * Meldung cmua8bof). touch-action: manipulation nimmt dem Browser das Warten
 * auf einen Doppeltipp.
 */
export function HofseiteFotos({ fotos }: { fotos: readonly PublicFarmPhoto[] }): React.JSX.Element | null {
  const bild = useBildansicht(fotos.length)
  if (fotos.length === 0) return null
  const sichtbar = fotos.slice(0, SICHTBAR)
  const weitere = fotos.length - sichtbar.length

  return (
    <section id="fotos" data-abschnitt="fotos" aria-labelledby="fotos-titel" className="flex flex-col gap-3">
      <h2 id="fotos-titel" className="font-heading text-xl font-semibold text-foreground">
        Fotos
      </h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-3.5">
        {sichtbar.map((foto, i) => {
          const letzte = i === sichtbar.length - 1 && weitere > 0
          return (
            <li key={foto.id}>
              <button
                type="button"
                onClick={(e) => bild.oeffne(i, e.currentTarget)}
                aria-label={
                  letzte
                    ? `Alle ${fotos.length} Fotos ansehen`
                    : foto.caption
                      ? `${foto.caption} – Foto vergrößern`
                      : `Foto ${i + 1} von ${fotos.length} vergrößern`
                }
                className={cn('relative block h-[140px] w-full touch-manipulation overflow-hidden rounded-[14px] bg-muted', FOKUS_RAHMEN)}
              >
                <Image
                  src={foto.url}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 260px, (min-width: 640px) 33vw, 50vw"
                  className="object-cover"
                />
                {/* „+N" liegt auf dem Foto: dunkler Schleier, helle Schrift — in beiden Themes gleich (DESIGN_SYSTEM, Bild-Overlays). */}
                {letzte && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 flex items-center justify-center bg-primary-foreground/55 text-[15px] font-semibold text-accent-foreground"
                  >
                    +{weitere}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
      <BildansichtEbene fotos={fotos} bild={bild} titel="Fotos vom Hof" />
    </section>
  )
}
