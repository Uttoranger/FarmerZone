'use client'

import { useState, type ReactNode, type SyntheticEvent } from 'react'
import Image from 'next/image'
import { TITELBILD_SIZES, leseBildmasse, titelbildDarstellung, type TitelbildDarstellung, type TitelbildMasse } from '@/lib/titelbild'
import { cn } from '@/lib/utils'

/*
 * Das Titelbild der Hofseite (Register N6, Nachtlauf Nr. 72; am Computer
 * Register N13, Nr. 89), aus hofseite-kunde.tsx herausgelöst.
 *
 * Der Rahmen hat feste Höhen und wird mit der Breite höher: 220 px am Handy,
 * 300 ab 768 px, 360 ab 1 280 px, 420 ab 1 536 px. Fest, damit nach dem Laden
 * nichts springt. Er rechnet mit höchstens 1 920 px Breite (TITELBILD_BREITE_MAX):
 * Das scharfe Foto steht in einem zentrierten Kasten dieser Breite — breiter
 * wird es nicht aufgezogen —, dahinter liegt über die volle Breite eine unscharfe,
 * abgedunkelte Kopie desselben Fotos. Sie füllt, was der Kasten freilässt: links
 * und rechts über 1 920 px, und neben einem Foto, das ganz steht, die ganze Fläche.
 * Es ist EINE Kopie über die volle Breite, nicht eine im Kasten und eine für die
 * Ränder: Zwei Kopien mit verschiedenem Maßstab ergäben an der Kastenkante eine Naht.
 *
 * Was ganz steht und was die Fläche füllt, entscheidet lib/titelbild.ts, sobald
 * das Bild geladen ist: Ab 768 px steht das ganze Foto mittig in voller Höhe,
 * wenn es weniger als 1,5-mal so breit wie hoch ist (Quadrat, Hochformat, 4:3);
 * ein Querformat ab 3:2 füllt die Fläche mit Fokuspunkt, wie vor N6. Unter
 * 768 px bleibt es immer beim Beschnitt — dort steht der Name auf dem Bild. Der
 * Alt-Text bleibt leer (Schmuck); den Hof nennt die Überschrift.
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
 * Die Bilder im Rahmen: hinten die unscharfe Kopie über die volle Breite, davor
 * im Kasten das scharfe Foto.
 *
 * Die Kopie (`object-cover` mit demselben Fokuspunkt, Weichzeichner, dunkle
 * Tönung aus dem Design-System — Bild-Overlay, in beiden Themes gleich) ist
 * immer im Baum, nur ihre Sichtbarkeit wechselt: Bei `ganz` ist sie ab 768 px
 * da, bei `beschnitt` bleibt sie unsichtbar — außer über 1 920 px, wo sie die
 * Ränder füllt. Dass sie schon im Baum steht, lässt den Wechsel nach dem Laden
 * weich einblenden (`transition-opacity`); wäre sie erst dann eingehängt, ginge
 * sie ohne Übergang an. Unter 768 px ist sie aus.
 *
 * Weichzeichner 28 px, Kopie 10 % größer und 20 px über den Rahmen hinaus, Tönung
 * 45 % — die Werte des Mockups system-k2-titelbild-computer. Der Überstand
 * hält den Rand des Bilds außerhalb des Rahmens: Ein Weichzeichner macht die
 * Kante halbdurchsichtig, und dahinter stünde sonst die Fläche des Rahmens.
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
      {/* Die Kopie steht VOR dem Kasten im Baum: Beide liegen absolut übereinander, und ohne z-index malt das spätere Geschwister obenauf — so liegt das scharfe Foto über der Kopie. */}
      <div
        aria-hidden="true"
        className={cn(
          'absolute inset-0 hidden transition-opacity duration-500 motion-reduce:transition-none md:block',
          ganz ? 'opacity-100' : 'opacity-0 min-[1920px]:opacity-100'
        )}
      >
        <div className="absolute -inset-5">
          <Image src={foto} alt="" fill sizes={TITELBILD_SIZES} className="scale-110 object-cover blur-[28px]" style={position} />
        </div>
        <div className="absolute inset-0 bg-primary-foreground/45" />
      </div>
      {/* Der Kasten: Breiter als 1 920 px (TITELBILD_BREITE_MAX) wird das scharfe Foto nicht aufgezogen. */}
      <div className="relative mx-auto h-full max-w-[1920px]">
        <Image
          src={foto}
          alt=""
          fill
          sizes={TITELBILD_SIZES}
          priority
          onLoad={beimLaden}
          className={cn('object-cover', ganz && 'md:object-contain')}
          style={position}
        />
      </div>
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
    <div
      data-abschnitt="titelbild"
      className="relative h-[220px] w-full overflow-hidden bg-muted md:h-[300px] xl:h-[360px] 2xl:h-[420px]"
    >
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
