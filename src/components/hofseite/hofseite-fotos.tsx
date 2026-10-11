'use client'

import Image from 'next/image'
import type { PublicFarmPhoto } from '@/server/queries/farm'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { BildansichtEbene, useBildansicht } from '@/components/hofseite/bildansicht'

/** So viele Kacheln zeigt die Übersicht; auf der letzten steht „+N", die Bildansicht blättert durch alle. */
const SICHTBAR = 6

/*
 * Die Streifen-Variante (Register N5, Nr. 51): unter lg EINE Reihe, die nur in
 * ihrem eigenen Kasten seitlich scrollt — nie die Seite. Am Rand läuft sie bis
 * an die Bildschirmkante (-mx wie das Polster der Seite), damit die
 * angeschnittene Kachel zeigt, dass es weitergeht. py-1 hält oben und unten
 * Platz für den Fokusrahmen: overflow-x schneidet sonst auch senkrecht ab.
 * Ab lg dieselben Kacheln als Raster wie bisher.
 */
const STREIFEN = {
  liste:
    '-mx-4 -my-1 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto overscroll-x-contain px-4 py-1 md:-mx-6 md:scroll-px-6 md:px-6 lg:mx-0 lg:my-0 lg:grid lg:snap-none lg:grid-cols-3 lg:gap-3.5 lg:overflow-visible lg:p-0',
  eintrag: 'w-40 shrink-0 snap-start sm:w-48 lg:w-auto lg:shrink',
  kachel: 'h-[120px] sm:h-36 lg:h-[140px]',
  sizes: '(min-width: 1024px) 260px, (min-width: 640px) 192px, 160px',
}
const RASTER = {
  liste: 'grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-3.5',
  eintrag: undefined,
  kachel: 'h-[140px]',
  sizes: '(min-width: 1024px) 260px, (min-width: 640px) 33vw, 50vw',
}

/**
 * „Fotos" in der Übersicht der Hofseite (Mockup web-k2-hofseite): Kacheln,
 * jede ein Knopf, der die Bildansicht öffnet — kein Bild liegt in einem Link
 * (sonst sprang ein Tipp auf ein Bild auf eine andere Seite, Meldung
 * cmua8bof). touch-action: manipulation nimmt dem Browser das Warten auf einen
 * Doppeltipp.
 *
 * `streifenUnterLg`: Im Schaufenster (Register N5) stehen die Fotos unter lg
 * als Streifen ganz oben, die Überschrift nur für Screenreader; ab lg bleibt
 * das Raster. Dieselbe Liste, dieselben Knöpfe, EINE Bildansicht — nur die
 * Klassen wechseln mit der Breite, nichts wird im Browser gemessen.
 */
export function HofseiteFotos({
  fotos,
  streifenUnterLg = false,
  className,
}: {
  fotos: readonly PublicFarmPhoto[]
  streifenUnterLg?: boolean
  className?: string
}): React.JSX.Element | null {
  const bild = useBildansicht(fotos.length)
  if (fotos.length === 0) return null
  const sichtbar = fotos.slice(0, SICHTBAR)
  const weitere = fotos.length - sichtbar.length
  const form = streifenUnterLg ? STREIFEN : RASTER

  return (
    <section id="fotos" data-abschnitt="fotos" aria-labelledby="fotos-titel" className={cn('flex flex-col gap-3', className)}>
      <h2 id="fotos-titel" className={cn('font-heading text-xl font-semibold text-foreground', streifenUnterLg && 'max-lg:sr-only')}>
        Fotos
      </h2>
      <ul className={form.liste}>
        {sichtbar.map((foto, i) => {
          const letzte = i === sichtbar.length - 1 && weitere > 0
          return (
            <li key={foto.id} className={form.eintrag}>
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
                className={cn('relative block w-full touch-manipulation overflow-hidden rounded-[14px] bg-muted', form.kachel, FOKUS_RAHMEN)}
              >
                <Image src={foto.url} alt="" fill sizes={form.sizes} className="object-cover" />
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
