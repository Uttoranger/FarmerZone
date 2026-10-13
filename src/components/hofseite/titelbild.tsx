'use client'

import { useState, type ReactNode, type SyntheticEvent } from 'react'
import Image from 'next/image'
import { leseBildmasse, titelbildDarstellung, type TitelbildDarstellung, type TitelbildMasse } from '@/lib/titelbild'
import { cn } from '@/lib/utils'

/*
 * Das Titelbild der Hofseite (Register N6, Nachtlauf Nr. 72), aus
 * hofseite-kunde.tsx herausgelöst. Querformat und der Verlauf ohne Foto sehen
 * aus wie vorher: füllende Fläche, 220 px hoch (ab 768 px 300 px), das Foto mit
 * Fokuspunkt, am Handy der dunkle Schleier für den Namen.
 *
 * Neu ist nur das Hochformat. Sobald das Bild geladen ist, entscheidet
 * lib/titelbild.ts: Ab 768 px steht das ganze Foto mittig in voller Höhe,
 * dahinter dasselbe Foto unscharf und abgedunkelt als Fläche. Unter 768 px
 * bleibt es beim Beschnitt mit Fokuspunkt — dort steht der Name auf dem Bild.
 * Der Alt-Text bleibt leer (Schmuck); den Hof nennt die Überschrift.
 */

/**
 * Die Maße des Bilds `quelle`, sobald der Browser es geladen hat (`beimLaden`
 * ans Bild hängen). Gespeichert sind sie nicht (siehe lib/titelbild.ts).
 * Maße eines früheren Fotos gelten nicht fürs neue — Mein Hof ersetzt das
 * Foto, ohne die Seite neu zu laden.
 */
export function useBildmasse(quelle: string | null): {
  masse: TitelbildMasse | null
  beimLaden: (ereignis: SyntheticEvent<HTMLImageElement>) => void
} {
  const [gelesen, setGelesen] = useState<{ quelle: string; masse: TitelbildMasse } | null>(null)
  const masse = gelesen?.quelle === quelle ? gelesen.masse : null

  function beimLaden(ereignis: SyntheticEvent<HTMLImageElement>): void {
    const gemessen = leseBildmasse(ereignis.currentTarget)
    if (quelle !== null && gemessen !== null) setGelesen({ quelle, masse: gemessen })
  }

  return { masse, beimLaden }
}

/**
 * Die Bilder im Rahmen. Bei `ganz` liegen ab 768 px zwei Lagen übereinander:
 * hinten die Kopie (`object-cover` mit demselben Fokuspunkt, Weichzeichner,
 * dunkle Tönung aus dem Design-System — Bild-Overlays, theme-fest), vorn das
 * ganze Foto. Unter 768 px ist die Kopie aus.
 */
export function TitelbildBilder({
  foto,
  fokusY,
  darstellung,
  beimLaden,
}: {
  foto: string
  /** Fokuspunkt, senkrecht, 0–100 (`Farm.bannerFocusY`). */
  fokusY: number
  darstellung: TitelbildDarstellung
  beimLaden: (ereignis: SyntheticEvent<HTMLImageElement>) => void
}): React.JSX.Element {
  const ganz = darstellung === 'ganz'
  // Bei object-contain im breiten Rahmen begrenzt die Höhe das Foto: Der senkrechte Fokus greift dort nie, mittig bleibt es von selbst.
  const position = { objectPosition: `50% ${fokusY}%` }

  return (
    <>
      {/* Die Kopie steht VOR dem Foto im Baum: Beide liegen absolut übereinander (fill), und ohne z-index malt das spätere Geschwister obenauf — so liegt das ganze Foto über der Kopie. */}
      {ganz && (
        <>
          <Image
            src={foto}
            alt=""
            aria-hidden="true"
            fill
            sizes="100vw"
            className="hidden scale-110 object-cover blur-2xl md:block"
            style={position}
          />
          <div aria-hidden="true" className="absolute inset-0 hidden bg-primary-foreground/45 md:block" />
        </>
      )}
      <Image
        src={foto}
        alt=""
        fill
        sizes="100vw"
        priority
        onLoad={beimLaden}
        className={cn('object-cover', ganz && 'md:object-contain')}
        style={position}
      />
    </>
  )
}

/**
 * Der Rahmen mit Bild (oder Verlauf ohne Foto) und Schleier. Was die Hofseite
 * daraufsetzt (am Handy der Teilen-Knopf), kommt als `children` — es liegt über dem Schleier.
 */
export function Titelbild({
  foto,
  verlauf,
  fokusY,
  children,
}: {
  /** Das hochgeladene Foto (`titelbildFoto`), sonst null — dann steht der Verlauf. */
  foto: string | null
  /** Der Verlauf des Hofs (`titelbildVerlauf`). */
  verlauf: string
  fokusY: number
  children?: ReactNode
}): React.JSX.Element {
  const { masse, beimLaden } = useBildmasse(foto)

  return (
    <div data-abschnitt="titelbild" className="relative h-[220px] w-full overflow-hidden bg-muted md:h-[300px]">
      {foto ? (
        <TitelbildBilder foto={foto} fokusY={fokusY} darstellung={titelbildDarstellung(masse)} beimLaden={beimLaden} />
      ) : (
        // Der Verlauf ist ein Wert des Hofs (Titelbild-Einstellung), kein Farbliteral im Code.
        <div className="absolute inset-0" style={{ background: verlauf }} />
      )}
      {/* Am Handy steht der Name auf dem Bild: dunkler Schleier, theme-fest (DESIGN_SYSTEM, Bild-Overlays). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-linear-to-t from-primary-foreground/75 via-primary-foreground/10 to-transparent md:hidden"
      />
      {children}
    </div>
  )
}
