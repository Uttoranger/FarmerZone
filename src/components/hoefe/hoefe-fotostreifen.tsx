'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { zentrierterIndex } from '@/lib/hoefe-anzeige'

/**
 * Der blätterbare Fotostreifen oben auf einer Hofkarte (Tripadvisor-Muster):
 * Seitenverhältnis 3:2 (feste Höhe — nichts springt beim Nachladen),
 * horizontales Scroll-Snap-Karussell OHNE neue Abhängigkeit. Wischen am
 * Touchgerät; am Zeigergerät erscheinen Pfeile beim Darüberfahren; Punkte
 * unten zeigen die Position (rein visuell).
 *
 * BLÄTTERN BLÄTTERT NUR: Pfeile stoppen die Weitergabe und wählen weder aus
 * noch navigieren sie. Ein Tipp aufs FOTO selbst tut dagegen, was die
 * restliche Karte tut — der Aufrufer reicht das als onTipp herein (Split:
 * auswählen; schmale Liste: zur Hofseite). Nach echtem Wisch-Scrollen feuert
 * der Browser keinen Klick, Wischen bleibt also reines Blättern.
 *
 * Genau ein Foto → keine Punkte, keine Pfeile. Null Fotos → null, die Karte
 * sieht aus wie ohne diesen Sprint. Die Snap-Erkennung ist die vorhandene
 * reine Funktion zentrierterIndex (#80) — Vollbreiten-Folien, Schritt =
 * Streifenbreite.
 */
export default function HoefeFotostreifen({
  fotos,
  hofName,
  sizes,
  onTipp,
}: {
  fotos: string[]
  hofName: string
  /** next/image-sizes passend zur Kartenbreite des Einsatzorts. */
  sizes: string
  /** Tipp aufs Foto (nicht auf Pfeile) — Verhalten der restlichen Karte. */
  onTipp?: () => void
}) {
  const band = useRef<HTMLDivElement>(null)
  const ruhe = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [aktiv, setAktiv] = useState(0)

  // Kein Geister-Timer nach dem Abbau — Hausstandard wie im Hof-Karussell.
  useEffect(() => {
    return () => {
      if (ruhe.current) clearTimeout(ruhe.current)
    }
  }, [])

  if (fotos.length === 0) return null
  const mehrere = fotos.length > 1

  function beimScrollen() {
    const leiste = band.current
    if (!leiste) return
    if (ruhe.current) clearTimeout(ruhe.current)
    ruhe.current = setTimeout(() => {
      setAktiv(zentrierterIndex(leiste.scrollLeft, leiste.clientWidth, fotos.length))
    }, 100)
  }

  function blaettere(richtung: -1 | 1) {
    const leiste = band.current
    if (!leiste) return
    const ziel = Math.min(
      fotos.length - 1,
      Math.max(0, zentrierterIndex(leiste.scrollLeft, leiste.clientWidth, fotos.length) + richtung)
    )
    leiste.scrollTo({ left: ziel * leiste.clientWidth, behavior: 'smooth' })
  }

  return (
    // group/foto: Die Pfeile erscheinen beim Darüberfahren über dem Streifen.
    <div className="group/foto relative aspect-[3/2] w-full overflow-hidden rounded-t-2xl">
      <div
        ref={band}
        onScroll={beimScrollen}
        onClick={onTipp}
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none]"
      >
        {fotos.map((url, i) => (
          <div key={url} className="relative h-full w-full shrink-0 snap-center">
            <Image
              src={url}
              alt={`${hofName} — Foto ${i + 1} von ${fotos.length}`}
              fill
              sizes={sizes}
              loading="lazy"
              className="object-cover"
            />
          </div>
        ))}
      </div>

      {mehrere && (
        <>
          {/* Echte Buttons mit z-10 über allem: Sie blättern NUR — die
              Weitergabe stoppt, damit weder ausgewählt noch navigiert wird. */}
          <button
            type="button"
            aria-label="Vorheriges Foto"
            onClick={(e) => {
              e.stopPropagation()
              blaettere(-1)
            }}
            className="pointer-events-none absolute left-1.5 top-1/2 z-10 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-card/90 text-foreground opacity-0 shadow-md transition-opacity focus-visible:pointer-events-auto focus-visible:opacity-100 group-hover/foto:pointer-events-auto group-hover/foto:opacity-100"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Nächstes Foto"
            onClick={(e) => {
              e.stopPropagation()
              blaettere(1)
            }}
            className="pointer-events-none absolute right-1.5 top-1/2 z-10 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-card/90 text-foreground opacity-0 shadow-md transition-opacity focus-visible:pointer-events-auto focus-visible:opacity-100 group-hover/foto:pointer-events-auto group-hover/foto:opacity-100"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>

          {/* Rein visuelle Positions-Punkte — aktiver Punkt gefüllt. Der
              Punktebereich schluckt Tipps (Vorgabe: Punkte wählen NIE aus
              und navigieren nie — auch nicht durchgereicht ans Foto). */}
          <div
            aria-hidden="true"
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-x-0 bottom-1.5 z-10 flex cursor-default justify-center gap-1.5"
          >
            {fotos.map((url, i) => (
              <span
                key={url}
                className={`size-1.5 rounded-full shadow ${
                  i === aktiv ? 'bg-white' : 'bg-white/50'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
