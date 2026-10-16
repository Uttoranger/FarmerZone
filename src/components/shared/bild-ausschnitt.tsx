'use client'

import { useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import Image from 'next/image'
import { Move, ZoomIn } from 'lucide-react'
import { Segment } from '@/components/ui/segment'
import { FOKUS_RAHMEN, FOKUS_RAHMEN_INNEN } from '@/components/ui/fokus'
import { useBildmasse } from '@/components/hofseite/titelbild'
import {
  AUSSCHNITT_STANDARD,
  BILD_AUSSCHNITT_TEXT as TEXT,
  BILD_FILTER_NAME,
  ZOOM_MAX,
  ZOOM_MIN,
  ausschnittNachTaste,
  ausschnittNachZiehen,
  bildLage,
  bildStil,
  filterMit,
  nurFilterStil,
  type Masse,
} from '@/lib/bild-ausschnitt'
import { BILD_FILTER_NAMEN, type BildAusschnitt as BildAusschnittWert } from '@/schemas/bild-ausschnitt'
import { cn } from '@/lib/utils'

/*
 * Der Bild-Baustein (Register N17, Nachtlauf Nr. 97; Mockups
 * system-h1-bild-baustein, web-/mobil-h1-titelbild-ausschnitt): Ausschnitt
 * (Fokus + Zoom) und Filter eines hochgeladenen Fotos wählen und vorher sehen,
 * wie es in jeder Größe aussieht. Am Computer in der Zeile, am Handy im Blatt —
 * dieselben Bedienelemente, nichts ist „nur Web“.
 *
 * Gezogen wird im Hauptrahmen und in den Vorschau-Rahmen: Pointer-Events mit
 * setPointerCapture, `touch-action: none` NUR auf den Rahmen (das Blatt bleibt
 * scrollbar). Die Rechnung steht rein in lib/bild-ausschnitt.ts
 * (`ausschnittNachZiehen`, `ausschnittNachTaste`) — die Komponente misst nur.
 * Alle Rahmen rendern mit `bildStil`: Die Vorschau ist das Ergebnis.
 *
 * Alle Bilder des Bausteins nehmen dieselbe Quelle mit demselben `sizes` — der
 * Browser lädt das Foto einmal. Fotos und Overlays folgen keinem Modus
 * (DESIGN_SYSTEM, Bild-Overlays): Marken darauf sind theme-fest dunkel.
 */

/** Eine Größe für alle Bilder des Bausteins — dieselbe wie im Titelbild-Baustein von Mein Hof, eine Datei. */
const BILD_SIZES = '640px'

/** Der Rahmen, in dem gezogen wird. */
export type BildRahmen = {
  /** Kurzer Name auf dem Rahmen („Computer“). */
  name: string
  /** Breite ÷ Höhe. */
  verhaeltnis: number
}

/** Ein Vorschau-Rahmen „So sieht es … aus“. */
export type BildVorschau = {
  titel: string
  /** Breite ÷ Höhe. */
  verhaeltnis: number
  /** Kurzer Name auf dem Rahmen („Handy“); mit Name trägt er die Kontur wie der Hauptrahmen. */
  name?: string
  /** Feste Breite in px (der Satz steht dann daneben); ohne Angabe die volle Breite. */
  breite?: number
  /** Ein Satz zum Rahmen. */
  satz?: string
  /** Steht das Foto in diesem Rahmen ganz (Titelbild „Ganz zeigen“)? Dann weiche Kopie dahinter, gezogen wird dort nicht. */
  ganz?: (wert: BildAusschnittWert, masse: Masse | null) => boolean
  /** Was über dem Foto liegt (Schleier, Name) — fängt keine Zeiger. */
  darueber?: ReactNode
  /** Was den Rahmen umgibt (Browserleiste, Kopf, Hofkopf). */
  umgebung?: (rahmen: ReactNode) => ReactNode
}

type Griffe = {
  onPointerDown: (ereignis: PointerEvent<HTMLDivElement>) => void
  onPointerMove: (ereignis: PointerEvent<HTMLDivElement>) => void
  onPointerUp: (ereignis: PointerEvent<HTMLDivElement>) => void
  onPointerCancel: (ereignis: PointerEvent<HTMLDivElement>) => void
}

type Zug = { zeiger: number; x: number; y: number; start: BildAusschnittWert; rahmen: Masse }

/** Theme-fest dunkle Marke auf dem Foto (DESIGN_SYSTEM, Bild-Overlays). */
const FOTO_MARKE =
  'pointer-events-none absolute top-1.5 left-1.5 rounded-full bg-primary-foreground/55 px-[7px] py-0.5 text-[10px] font-semibold tracking-[0.6px] text-accent-foreground uppercase'

/** Die Bühne ist doppelt so breit wie hoch (Mockups: 358 × 180, 362 × 192). */
const BUEHNE_VERHAELTNIS = 2

/**
 * Wo der Hauptrahmen auf der Bühne steht, in Prozent: ein breiter Rahmen über
 * die volle Breite, senkrecht mittig; ein höherer (Nr. 98: Logo, Produktfoto)
 * 80 % hoch, waagrecht mittig. Als Inline-Wert ohne translate — die Fortsetzung
 * des Fotos liegt im selben Kasten und rechnet in seinen Prozent.
 */
function rahmenPlatz(verhaeltnis: number): { left: string; top: string; width: string; aspectRatio: number } {
  if (verhaeltnis >= BUEHNE_VERHAELTNIS) {
    return { left: '0%', top: `${50 * (1 - BUEHNE_VERHAELTNIS / verhaeltnis)}%`, width: '100%', aspectRatio: verhaeltnis }
  }
  const breite = (0.8 * verhaeltnis) / BUEHNE_VERHAELTNIS
  return { left: `${50 * (1 - breite)}%`, top: '10%', width: `${100 * breite}%`, aspectRatio: verhaeltnis }
}

/** Die Kontur des Rahmens in der Textfarbe — über dem Foto, damit es sie nicht verdeckt. */
const KONTUR = 'pointer-events-none absolute inset-0 ring-2 ring-foreground ring-inset'

export function BildAusschnitt({
  foto,
  wert: anfang,
  rahmen,
  vorschauen = [],
  mitFilter = true,
  mitDarstellung = false,
  speichert = false,
  onSpeichern,
  onAbbrechen,
}: {
  foto: string
  /** Der gespeicherte Ausschnitt — oder der Stand von vorher. */
  wert: BildAusschnittWert
  rahmen: BildRahmen
  /** Die Vorschau-Rahmen „So sieht es … aus“ (Plural: `vorschau=` als Text sperrt tests/hofseite-einmal.test.ts für den Parameter der Hofseite). */
  vorschauen?: readonly BildVorschau[]
  /** Filterkacheln zeigen (das Logo hat keine, Register N17). */
  mitFilter?: boolean
  /** Wahl „Am Computer: Ausschnitt füllen | Ganz zeigen“ (nur Titelbild). */
  mitDarstellung?: boolean
  speichert?: boolean
  onSpeichern: (wert: BildAusschnittWert) => void
  onAbbrechen: () => void
}): React.JSX.Element {
  const [wert, setWert] = useState<BildAusschnittWert>(anfang)
  // Der Hinweis „Ziehen“ steht bis zur ersten Berührung (oder Taste).
  const [beruehrt, setBeruehrt] = useState(false)
  const { masse, beimLaden } = useBildmasse(foto)
  const zug = useRef<Zug | null>(null)
  const zoomId = useId()

  const griffe: Griffe = {
    onPointerDown(ereignis) {
      if (ereignis.pointerType === 'mouse' && ereignis.button !== 0) return
      const flaeche = ereignis.currentTarget.getBoundingClientRect()
      zug.current = {
        zeiger: ereignis.pointerId,
        x: ereignis.clientX,
        y: ereignis.clientY,
        start: wert,
        rahmen: { breite: flaeche.width, hoehe: flaeche.height },
      }
      ereignis.currentTarget.setPointerCapture(ereignis.pointerId)
      setBeruehrt(true)
    },
    onPointerMove(ereignis) {
      const z = zug.current
      if (!z || z.zeiger !== ereignis.pointerId || masse === null) return
      const fokus = ausschnittNachZiehen(z.start, { dx: ereignis.clientX - z.x, dy: ereignis.clientY - z.y }, z.rahmen, masse)
      setWert((alt) => ({ ...alt, ...fokus }))
    },
    onPointerUp(ereignis) {
      if (zug.current?.zeiger === ereignis.pointerId) zug.current = null
    },
    onPointerCancel(ereignis) {
      if (zug.current?.zeiger === ereignis.pointerId) zug.current = null
    },
  }

  function beiTaste(ereignis: KeyboardEvent<HTMLDivElement>): void {
    const fokus = ausschnittNachTaste(wert, ereignis.key, ereignis.shiftKey)
    if (!fokus) return
    ereignis.preventDefault()
    setBeruehrt(true)
    setWert((alt) => ({ ...alt, ...fokus }))
  }

  function zuruecksetzen(): void {
    setWert(mitDarstellung ? { ...AUSSCHNITT_STANDARD, darstellung: 'AUTO' } : AUSSCHNITT_STANDARD)
  }

  // Ein Vorschau-Rahmen: gezogen wird auch hier, außer das Foto steht dort ganz.
  function vorschauRahmen(v: BildVorschau): ReactNode {
    const ganz = v.ganz?.(wert, masse) ?? false
    const flaeche = (
      <div
        {...(ganz ? {} : griffe)}
        className={cn('relative overflow-hidden bg-background select-none', !ganz && 'cursor-grab touch-none active:cursor-grabbing', v.name && 'rounded-lg')}
        style={{ aspectRatio: v.verhaeltnis, width: v.breite }}
      >
        <RahmenFoto foto={foto} wert={wert} ganz={ganz} />
        {v.darueber}
        {v.name && (
          <>
            <span className={cn(KONTUR, 'rounded-lg')} />
            <span className={FOTO_MARKE}>{v.name}</span>
          </>
        )}
      </div>
    )
    return v.umgebung ? v.umgebung(flaeche) : flaeche
  }

  // Die blasse Fortsetzung außerhalb des Hauptrahmens: im Verhältnis gerechnet, also in Prozent des Rahmens.
  const lage = masse === null ? null : bildLage({ breite: rahmen.verhaeltnis, hoehe: 1 }, masse, wert)
  const platz = rahmenPlatz(rahmen.verhaeltnis)

  return (
    <div className="flex flex-col gap-4">
      {/* Die Bühne: der Hauptrahmen, darum blass die Fortsetzung des Fotos (30 %). */}
      <div className="relative w-full overflow-hidden rounded-xl border border-border bg-muted" style={{ aspectRatio: BUEHNE_VERHAELTNIS }}>
        {lage && (
          <div aria-hidden="true" className="pointer-events-none absolute" style={platz}>
            <div
              className="absolute opacity-30"
              style={{
                left: `${(lage.links / rahmen.verhaeltnis) * 100}%`,
                top: `${lage.oben * 100}%`,
                width: `${(lage.breite / rahmen.verhaeltnis) * 100}%`,
                height: `${lage.hoehe * 100}%`,
              }}
            >
              <Image src={foto} alt="" fill sizes={BILD_SIZES} draggable={false} className="object-fill" style={nurFilterStil(wert)} />
            </div>
          </div>
        )}
        <div
          role="group"
          aria-label={`${rahmen.name}: ${TEXT.rahmenHilfe}`}
          tabIndex={0}
          onKeyDown={beiTaste}
          {...griffe}
          className={cn('absolute cursor-grab touch-none overflow-hidden bg-background select-none active:cursor-grabbing', FOKUS_RAHMEN_INNEN)}
          style={platz}
        >
          <Image src={foto} alt="" fill sizes={BILD_SIZES} draggable={false} className="object-cover" style={bildStil(wert)} onLoad={beimLaden} />
          <span className={KONTUR} />
          <span className={FOTO_MARKE}>{rahmen.name}</span>
          {!beruehrt && (
            <span className="pointer-events-none absolute top-1/2 left-1/2 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-full bg-accent-foreground/90 px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-primary-foreground">
              <Move className="size-3.5" strokeWidth={1.7} aria-hidden="true" />
              {TEXT.ziehen}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-[12.5px] text-muted-foreground">
          <label htmlFor={zoomId} className="inline-flex items-center gap-1.5">
            <ZoomIn className="size-3.5" strokeWidth={1.7} aria-hidden="true" />
            {TEXT.zoom}
          </label>
          <output htmlFor={zoomId} className="font-semibold text-foreground">
            {wert.zoom} %
          </output>
        </div>
        <input
          id={zoomId}
          type="range"
          min={ZOOM_MIN}
          max={ZOOM_MAX}
          step={1}
          value={wert.zoom}
          aria-valuetext={`${wert.zoom} %`}
          onChange={(ereignis) => {
            const zoom = Number(ereignis.target.value)
            setWert((alt) => ({ ...alt, zoom }))
          }}
          className={cn('h-11 w-full cursor-pointer accent-accent', FOKUS_RAHMEN)}
        />
      </div>

      {vorschauen.map((v) => (
        <div key={v.titel} className="flex flex-col gap-2">
          <div className="text-[12.5px] text-muted-foreground">{v.titel}</div>
          {v.breite === undefined ? (
            <>
              <div aria-hidden="true">{vorschauRahmen(v)}</div>
              {v.satz && <p className="text-[12.5px] leading-snug text-muted-foreground">{v.satz}</p>}
            </>
          ) : (
            <div className="flex items-center gap-3">
              <div aria-hidden="true" className="shrink-0">
                {vorschauRahmen(v)}
              </div>
              {v.satz && <p className="min-w-0 text-[12.5px] leading-snug text-muted-foreground">{v.satz}</p>}
            </div>
          )}
        </div>
      ))}

      {mitDarstellung && (
        <div className="flex flex-col gap-2">
          <div className="text-[12.5px] text-muted-foreground">{TEXT.amComputer}</div>
          <Segment
            beschriftung={TEXT.amComputer}
            optionen={[
              { wert: 'FUELLEN', label: TEXT.fuellen },
              { wert: 'GANZ', label: TEXT.ganz },
            ]}
            // Ohne Wahl (AUTO) ist keine Stellung gedrückt — dann entscheidet die Form des Fotos.
            wert={wert.darstellung ?? 'AUTO'}
            onWertChange={(gewaehlt) => setWert((alt) => ({ ...alt, darstellung: gewaehlt === 'GANZ' ? 'GANZ' : 'FUELLEN' }))}
            className="self-start"
          />
        </div>
      )}

      {mitFilter && (
        <div className="flex flex-col gap-2">
          <div className="text-[12.5px] text-muted-foreground">{TEXT.filter}</div>
          {/* Am Handy 50 px wie im Mockup mobil-h1-titelbild-ausschnitt, sonst 52 px: Sechs Kacheln passen so auch bei 375 px Breite in das Blatt. */}
          <div className="flex justify-between gap-0.5">
            {BILD_FILTER_NAMEN.map((filter) => {
              const aktiv = wert.filter === filter
              return (
                <button
                  key={filter}
                  type="button"
                  aria-pressed={aktiv}
                  onClick={() => setWert((alt) => ({ ...alt, filter }))}
                  className={cn('flex min-w-[50px] flex-col items-center gap-1.5 rounded-lg sm:min-w-[52px]', FOKUS_RAHMEN)}
                >
                  <span
                    className={cn(
                      'relative block size-[50px] overflow-hidden rounded-[9px] bg-muted sm:size-[52px]',
                      // Die gewählte Kachel trägt die Kontur im Status-Token „fertig“ (Mockup web-h1-titelbild-ausschnitt).
                      aktiv ? 'outline-2 outline-offset-1 outline-status-fertig' : 'outline-1 outline-border'
                    )}
                  >
                    <Image src={foto} alt="" fill sizes={BILD_SIZES} draggable={false} className="object-cover" style={bildStil({ ...wert, filter })} />
                  </span>
                  <span className={cn('text-[11px] whitespace-nowrap', aktiv ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground')}>
                    {BILD_FILTER_NAME[filter]}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1 lg:flex-row lg:items-center lg:gap-2.5">
        <button
          type="button"
          onClick={() => onSpeichern(wert)}
          disabled={speichert}
          aria-busy={speichert || undefined}
          className={cn(
            'h-12 w-full rounded-full bg-accent px-5 text-[15px] font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60 lg:h-11 lg:w-auto lg:text-sm',
            FOKUS_RAHMEN
          )}
        >
          {speichert ? TEXT.speichert : TEXT.speichern}
        </button>
        {/* Unter lg eine Zeile unter „Speichern“, ab lg in der Reihe: Abbrechen neben Speichern, Zurücksetzen rechts. */}
        <div className="flex items-center justify-between lg:contents">
          <button
            type="button"
            onClick={zuruecksetzen}
            disabled={speichert}
            className={cn('min-h-11 rounded-full px-3 text-[13.5px] font-medium text-muted-foreground hover:text-foreground lg:order-last lg:ml-auto', FOKUS_RAHMEN)}
          >
            {TEXT.zuruecksetzen}
          </button>
          <button
            type="button"
            onClick={onAbbrechen}
            disabled={speichert}
            className={cn(
              'min-h-11 rounded-full px-4 text-sm font-semibold text-brand-text hover:bg-muted lg:border lg:border-border lg:text-foreground',
              FOKUS_RAHMEN
            )}
          >
            {TEXT.abbrechen}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Das Foto in einem Vorschau-Rahmen: füllend mit dem Ausschnitt — oder, wo es
 * ganz steht, wie das Titelbild am Computer: ganz mit Filter vor einer weichen,
 * abgedunkelten Kopie (components/hofseite/titelbild.tsx). Der Weichzeichner
 * ist verkleinert wie die Vorschau (28 px bei 1 440 px Breite, hier ~8 px).
 */
function RahmenFoto({ foto, wert, ganz }: { foto: string; wert: BildAusschnittWert; ganz: boolean }): React.JSX.Element {
  if (!ganz) {
    return <Image src={foto} alt="" fill sizes={BILD_SIZES} draggable={false} className="object-cover" style={bildStil(wert)} />
  }
  return (
    <>
      <div className="absolute -inset-1.5">
        <Image
          src={foto}
          alt=""
          fill
          sizes={BILD_SIZES}
          draggable={false}
          className="scale-110 object-cover"
          style={{ ...bildStil(wert, { filter: false }), filter: filterMit('blur(8px)', wert) }}
        />
      </div>
      {/* Tönung wie die Kopie auf der Hofseite: theme-fest dunkel (Bild-Overlay). */}
      <div className="absolute inset-0 bg-primary-foreground/45" />
      <Image src={foto} alt="" fill sizes={BILD_SIZES} draggable={false} className="object-contain" style={nurFilterStil(wert)} />
    </>
  )
}
