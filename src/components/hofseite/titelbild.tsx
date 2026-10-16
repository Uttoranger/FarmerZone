'use client'

import { useState, type ReactNode, type SyntheticEvent } from 'react'
import Image from 'next/image'
import { TITELBILD_SIZES, leseBildmasse, titelbildDarstellung, type TitelbildDarstellung, type TitelbildMasse } from '@/lib/titelbild'
import { bildStil, filterMit, nurFilterStil } from '@/lib/bild-ausschnitt'
import type { BildAusschnitt } from '@/schemas/bild-ausschnitt'
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
 * Wechsel nach dem Laden blendet weich über: `object-fit` lässt sich nicht
 * überblenden, darum liegt das scharfe Foto in zwei Lagen (füllend und ganz), und
 * beim Wechsel blenden die ganze Lage und die Kopie ein, während die füllende
 * ausblendet. Der Alt-Text bleibt leer (Schmuck); den Hof nennt die Überschrift.
 *
 * Seit Nr. 97 (Register N13, Ergänzung; N17) kommt statt des senkrechten
 * Fokuspunkts der ganze Ausschnitt: Fokus waagrecht und senkrecht, Zoom und
 * Filter wirken am Computer und am Handy gleich (`bildStil`, lib/bild-ausschnitt.ts),
 * die Wahl „füllen oder ganz“ nur am Computer (`titelbildDarstellung`).
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

/** Der Übergang aller drei Lagen: gleich lang und zugleich, bei „weniger Bewegung“ ohne. */
const UEBERGANG = 'transition-opacity duration-500 motion-reduce:transition-none'

/**
 * Die Bilder im Rahmen: hinten die unscharfe Kopie über die volle Breite, davor
 * im Kasten das scharfe Foto in zwei Lagen.
 *
 * Die Kopie (`object-cover` mit demselben Ausschnitt, Weichzeichner, dunkle
 * Tönung aus dem Design-System — Bild-Overlay, in beiden Themes gleich) ist
 * immer im Baum, nur ihre Sichtbarkeit wechselt: Bei `ganz` ist sie ab 768 px
 * da, bei `beschnitt` bleibt sie unsichtbar — außer über 1 920 px, wo sie die
 * Ränder füllt. Dass sie schon im Baum steht, lässt den Wechsel nach dem Laden
 * weich einblenden (`transition-opacity`); wäre sie erst dann eingehängt, ginge
 * sie ohne Übergang an. Unter 768 px ist sie aus.
 *
 * Weichzeichner 28 px, Kopie 10 % größer und 20 px über den Rahmen hinaus, Tönung
 * 45 % — die Werte des Mockups system-k2-titelbild-computer. Weichzeichner und
 * Filter stehen in EINER Inline-Angabe `filter` (`filterMit`): Eine Klasse
 * `blur-[28px]` neben dem Inline-Filter des Ausschnitts wäre wirkungslos. Der Überstand
 * hält den Rand des Bilds außerhalb des Rahmens: Ein Weichzeichner macht die
 * Kante halbdurchsichtig, und dahinter stünde sonst die Fläche des Rahmens.
 *
 * Das scharfe Foto liegt zweimal im Kasten, beide Male dieselbe Quelle mit
 * demselben `sizes` — der Browser lädt die Datei nur einmal:
 *  - füllend (`object-cover`, ganzer Ausschnitt): die Lage, die am Handy und bei
 *    „füllen“ steht. Sie lädt vorrangig und liest die Maße (`onLoad`).
 *  - ganz (`object-contain`, nur der Filter): erst ab 768 px da (`hidden md:block` —
 *    darunter gibt es sie nicht, also auch keinen Abruf) und unsichtbar, bis das Foto ganz steht.
 * Beim Wechsel nach dem Laden blenden die ganze Lage und die Kopie ein, während die
 * füllende ausblendet. Ein einzelnes Bild, das nur von `cover` auf `contain` wechselte,
 * spränge: `object-fit` lässt sich nicht überblenden. Unter 768 px bleibt die
 * füllende Lage stehen (`md:opacity-0`).
 *
 * Screenreader hören das Foto höchstens einmal: Kopie und ganze Lage sind
 * `aria-hidden`, nur die füllende nicht — in jeder Darstellung und bei jeder Breite.
 */
export function TitelbildBilder({
  foto,
  ausschnitt,
  darstellung,
  beimLaden,
}: {
  foto: string
  /** Fokus, Zoom und Filter (`titelbildAusschnitt`, lib/titelbild.ts). */
  ausschnitt: BildAusschnitt
  darstellung: TitelbildDarstellung
  beimLaden: (ereignis: SyntheticEvent<HTMLImageElement>) => void
}): React.JSX.Element {
  const ganz = darstellung === 'ganz'
  const fuellend = bildStil(ausschnitt)
  const kopie = { ...bildStil(ausschnitt, { filter: false }), filter: filterMit('blur(28px)', ausschnitt) }
  const nurFilter = nurFilterStil(ausschnitt)

  return (
    <>
      {/* Die Kopie steht VOR dem Kasten im Baum: Beide liegen absolut übereinander, und ohne z-index malt das spätere Geschwister obenauf — so liegt das scharfe Foto über der Kopie. */}
      <div
        aria-hidden="true"
        className={cn('absolute inset-0 hidden md:block', UEBERGANG, ganz ? 'opacity-100' : 'opacity-0 min-[1920px]:opacity-100')}
      >
        <div className="absolute -inset-5">
          <Image src={foto} alt="" fill sizes={TITELBILD_SIZES} className="scale-110 object-cover" style={kopie} />
        </div>
        <div className="absolute inset-0 bg-primary-foreground/45" />
      </div>
      {/* Der Kasten: Breiter als 1 920 px (TITELBILD_BREITE_MAX) wird das scharfe Foto nicht aufgezogen. Die ganze Lage steht nach der füllenden im Baum, also darüber.
          overflow-hidden, weil der Zoom (transform: scale) die füllende Lage über den Kasten hinaus vergrößert — über 1 920 px ragte sie sonst seitlich in die weiche Kopie. */}
      <div className="relative mx-auto h-full max-w-[1920px] overflow-hidden">
        <Image
          src={foto}
          alt=""
          fill
          sizes={TITELBILD_SIZES}
          priority
          onLoad={beimLaden}
          className={cn('object-cover', UEBERGANG, ganz && 'md:opacity-0')}
          style={fuellend}
        />
        {/* Ohne Fokus und Zoom: Bei object-contain im breiten Rahmen begrenzt die Höhe das Foto, es steht von selbst mittig — ganz eben. Der Filter gilt auch hier. */}
        <Image
          src={foto}
          alt=""
          aria-hidden="true"
          fill
          sizes={TITELBILD_SIZES}
          className={cn('hidden object-contain md:block', UEBERGANG, ganz ? 'opacity-100' : 'opacity-0')}
          style={nurFilter}
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
  ausschnitt,
  children,
}: {
  /** Das hochgeladene Foto (`titelbildFoto`), sonst null — dann steht der Verlauf. */
  foto: string | null
  /** Der Verlauf des Hofs (`titelbildVerlauf`). */
  verlauf: string
  /** Der Ausschnitt (`titelbildAusschnitt`): ohne gespeicherten der Stand von vorher. */
  ausschnitt: BildAusschnitt
  children?: ReactNode
}): React.JSX.Element {
  const { masse, beimLaden } = useBildmasse(foto)

  return (
    <div
      data-abschnitt="titelbild"
      className="relative h-[220px] w-full overflow-hidden bg-muted md:h-[300px] xl:h-[360px] 2xl:h-[420px]"
    >
      {foto ? (
        <TitelbildBilder
          foto={foto}
          ausschnitt={ausschnitt}
          darstellung={titelbildDarstellung(masse, ausschnitt.darstellung)}
          beimLaden={beimLaden}
        />
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
