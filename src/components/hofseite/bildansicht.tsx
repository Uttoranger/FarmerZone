'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { stelleNachBildansicht } from '@/lib/hofseite-sektionen'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { bildStil, nurFilterStil } from '@/lib/bild-ausschnitt'
import { HOFSEITE_FOTOS_TEXT, fotoSprungLabel, wischRichtung, zaehlerText } from '@/lib/hofseite-fotos'
import type { BildAusschnitt } from '@/schemas/bild-ausschnitt'

/*
 * Die Bildansicht der Hofseite (Lightbox) — eine eigene Ebene über der Seite,
 * kein Base-UI-Dialog. Ihr Verhalten steht EINMAL hier, im Hook, und gilt für
 * die Fotos der Kundenansicht (hofseite-fotos.tsx) wie für die Galerie des
 * Besitzers im Bearbeitungsmodus (farm-page-view.tsx):
 *
 *  - Solange das Bild offen ist, scrollt die Seite dahinter nicht mit. Die
 *    Sperre über body.style.overflow hält auf iOS nicht immer — deshalb merkt
 *    sie sich beim Öffnen die Stelle und holt die Seite beim Aufheben dorthin
 *    zurück (stelleNachBildansicht, Meldung cmua8bof), aber NUR beim echten
 *    Schließen: Wird die Hofseite bei offenem Bild verlassen, läuft die
 *    Aufräumfunktion auch — dann darf sie die NEUE Seite nicht verschieben.
 *  - Der Fokus geht beim Schließen ohne Scrollen an die Kachel zurück, aus der
 *    das Bild geöffnet wurde (preventScroll: Wohin die Seite gehört,
 *    entscheidet die Sperre, nicht der Browser beim Fokussieren).
 *  - Escape schließt, die Pfeiltasten blättern; die Leiste unten springt
 *    (geheZu) und gibt den Fokus-Rückweg nicht her — er bleibt die Kachel.
 *
 * tests/hofseite-bildansicht.test.ts prüft das am Quelltext dieser Datei.
 */

export type Bildansicht = {
  /** Das offene Bild, null = zu. */
  offen: number | null
  oeffne: (index: number, kachel: HTMLElement | null) => void
  schliesse: () => void
  vor: () => void
  zurueck: () => void
  /** Springt in der offenen Ansicht zu einem Foto (Leiste unten). */
  geheZu: (index: number) => void
}

export function useBildansicht(anzahl: number): Bildansicht {
  const [offen, setOffen] = useState<number | null>(null)
  // Die Kachel, aus der das Bild geöffnet wurde — dorthin kehrt der Fokus zurück.
  const ausloeser = useRef<HTMLElement | null>(null)
  // Gesetzt nur von schliesse: Die Aufräumfunktion der Sperre unten läuft auch,
  // wenn die Hofseite bei offenem Bild verlassen wird.
  const regulaerGeschlossen = useRef(false)

  const oeffne = useCallback((index: number, kachel: HTMLElement | null) => {
    ausloeser.current = kachel
    setOffen(index)
  }, [])

  const schliesse = useCallback(() => {
    regulaerGeschlossen.current = true
    setOffen(null)
    ausloeser.current?.focus({ preventScroll: true })
  }, [])

  const vor = useCallback(() => {
    setOffen((i) => (i === null || anzahl === 0 ? i : (i + 1) % anzahl))
  }, [anzahl])

  const zurueck = useCallback(() => {
    setOffen((i) => (i === null || anzahl === 0 ? i : (i - 1 + anzahl) % anzahl))
  }, [anzahl])

  const geheZu = useCallback(
    (index: number) => {
      setOffen((i) => (i === null || index < 0 || index >= anzahl ? i : index))
    },
    [anzahl]
  )

  const istOffen = offen !== null

  useEffect(() => {
    if (!istOffen) return
    regulaerGeschlossen.current = false
    const beimOeffnen = window.scrollY
    const vorher = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = vorher
      const ziel = stelleNachBildansicht({
        beimOeffnen,
        jetzt: window.scrollY,
        geschlossen: regulaerGeschlossen.current,
      })
      if (ziel !== null) window.scrollTo(0, ziel)
    }
  }, [istOffen])

  useEffect(() => {
    if (!istOffen) return
    function beiTaste(e: KeyboardEvent) {
      if (e.key === 'Escape') schliesse()
      else if (e.key === 'ArrowRight') vor()
      else if (e.key === 'ArrowLeft') zurueck()
    }
    window.addEventListener('keydown', beiTaste)
    return () => window.removeEventListener('keydown', beiTaste)
  }, [istOffen, schliesse, vor, zurueck])

  return { offen, oeffne, schliesse, vor, zurueck, geheZu }
}

/** Mit dem Ausschnitt des Fotos (Register N17, Nr. 98): groß zählt davon nur der Filter. */
export type BildansichtFoto = { id: string; url: string; caption: string | null; ausschnitt?: BildAusschnitt | null }

/**
 * Der Alt-Text eines Hoffotos (Nr. 117): die Bildunterschrift des Hofs, sonst
 * „Foto von {Hof}" — für Suchmaschinen; Screenreader hören auf den Knöpfen ihr aria-label.
 */
export function fotoAlt(foto: Pick<BildansichtFoto, 'caption'>, hofName: string | undefined): string {
  return foto.caption || (hofName ? `Foto von ${hofName}` : '')
}

const RUNDER_KNOPF = cn(
  'flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-foreground/12 text-accent-foreground transition-colors duration-[250ms] hover:bg-accent-foreground/24',
  FOKUS_RAHMEN
)

/** Die Leiste zum Springen: nur sie scrollt seitlich, ohne Rollbalken (Register N5, Nr. 107). */
const LEISTE = 'relative flex shrink-0 gap-1.5 overflow-x-auto overscroll-x-contain px-4 pt-2.5 pb-[calc(1.75rem+env(safe-area-inset-bottom))] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'

/**
 * Die Ebene im neuen Design (Mockup mobil-k2-hofseite-bildansicht, seit
 * Nr. 107): oben links Schließen, in der Mitte „3 / 8", das ganze Foto mit
 * Filter, die Bildunterschrift und unten eine Leiste mit allen Fotos zum
 * Springen. Gewischt wird mit Pointer-Events (wischRichtung, Schwelle 40 px);
 * `touch-pan-y` nur auf der Bildfläche lässt dem Browser das senkrechte
 * Scrollen und gibt uns das waagrechte. Am Computer (feiner Zeiger) kommen
 * Pfeil-Knöpfe links und rechts dazu; Pfeiltasten und Escape gelten überall.
 *
 * Der Grund bleibt in beiden Themes dunkel (DESIGN_SYSTEM, „Bild-Overlays"):
 * `primary-foreground` ist im Geltungsbereich data-design="neu" fast schwarz,
 * `accent-foreground` Crème — beide in beiden Themes gleich, nie Tailwinds
 * black/white. Ebene 70: über der Unterleiste (50/60) und der Kopfzeile (40).
 */
export function BildansichtEbene({
  fotos,
  bild,
  titel,
  hofName,
}: {
  fotos: readonly BildansichtFoto[]
  bild: Bildansicht
  /** Wofür die Ebene steht, für Screenreader: „Fotos vom Hof". */
  titel: string
  /** Steht hinter der Bildunterschrift („Brot aus dem Ofen · Hof Test"). */
  hofName?: string
}): React.JSX.Element | null {
  const schliessenKnopf = useRef<HTMLButtonElement>(null)
  const leiste = useRef<HTMLDivElement>(null)
  // Wo der Finger (oder die Maus) aufgesetzt hat — nur für die Bewegung, die gerade läuft.
  const anfang = useRef<{ id: number; x: number; y: number } | null>(null)
  const offen = bild.offen
  const istOffen = offen !== null

  // Der Fokus geht beim Öffnen in die Ebene, ohne die Seite zu bewegen — nicht bei jedem Blättern.
  useEffect(() => {
    if (istOffen) schliessenKnopf.current?.focus({ preventScroll: true })
  }, [istOffen])

  // Das gewählte Foto steht in der Leiste mittig — nur die Leiste scrollt, nie die Seite.
  useEffect(() => {
    const kasten = leiste.current
    const gewaehlt = kasten?.querySelector<HTMLElement>('[aria-current="true"]')
    if (!kasten || !gewaehlt) return
    kasten.scrollTo({ left: gewaehlt.offsetLeft - (kasten.clientWidth - gewaehlt.offsetWidth) / 2, behavior: 'smooth' })
  }, [offen])

  if (offen === null || fotos.length === 0) return null
  const foto = fotos[offen]
  if (!foto) return null
  const mehrere = fotos.length > 1
  const unterschrift = [foto.caption, foto.caption ? hofName : null].filter(Boolean).join(' · ')

  return (
    <div role="dialog" aria-modal="true" aria-label={titel} className="fixed inset-0 z-[70] flex flex-col bg-primary-foreground text-accent-foreground">
      <div className="flex shrink-0 items-center gap-2 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-1">
        <button ref={schliessenKnopf} type="button" onClick={bild.schliesse} aria-label={HOFSEITE_FOTOS_TEXT.schliessen} className={RUNDER_KNOPF}>
          <X className="size-5" strokeWidth={1.7} aria-hidden="true" />
        </button>
        <p className="flex-1 text-center text-[15px] font-semibold tabular-nums" aria-live="polite">
          {zaehlerText(offen, fotos.length)}
        </p>
        <span className="size-11 shrink-0" aria-hidden="true" />
      </div>

      <figure className="m-0 flex min-h-0 flex-1 flex-col">
        <div
          className="relative min-h-0 flex-1 touch-pan-y select-none"
          onPointerDown={(e) => {
            anfang.current = { id: e.pointerId, x: e.clientX, y: e.clientY }
          }}
          onPointerUp={(e) => {
            const start = anfang.current
            anfang.current = null
            if (!start || start.id !== e.pointerId || !mehrere) return
            const richtung = wischRichtung(e.clientX - start.x, e.clientY - start.y)
            if (richtung === 'vor') bild.vor()
            else if (richtung === 'zurueck') bild.zurueck()
          }}
          onPointerCancel={() => {
            anfang.current = null
          }}
        >
          <Image
            src={foto.url}
            alt={fotoAlt(foto, hofName)}
            fill
            sizes="100vw"
            draggable={false}
            className="object-contain"
            // Das ganze Foto ohne Beschnitt, aber mit dem Filter des Hofs (Freigabe 98, Punkt 3) — Fokus und Zoom gelten nur in der Kachel.
            style={nurFilterStil(foto.ausschnitt ?? null)}
          />
          {mehrere && (
            <>
              <button
                type="button"
                onClick={bild.zurueck}
                aria-label={HOFSEITE_FOTOS_TEXT.vorheriges}
                className={cn(RUNDER_KNOPF, 'absolute top-1/2 left-4 hidden -translate-y-1/2 pointer-fine:flex')}
              >
                <ChevronLeft className="size-5" strokeWidth={1.7} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={bild.vor}
                aria-label={HOFSEITE_FOTOS_TEXT.naechstes}
                className={cn(RUNDER_KNOPF, 'absolute top-1/2 right-4 hidden -translate-y-1/2 pointer-fine:flex')}
              >
                <ChevronRight className="size-5" strokeWidth={1.7} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
        {unterschrift && <figcaption className="shrink-0 px-4 pt-2 pb-1.5 text-[13px] break-words text-accent-foreground/85">{unterschrift}</figcaption>}
      </figure>

      {mehrere && (
        <div ref={leiste} role="group" aria-label={HOFSEITE_FOTOS_TEXT.leiste} className={LEISTE}>
          {fotos.map((f, i) => (
            <button
              key={f.id}
              type="button"
              onClick={() => bild.geheZu(i)}
              aria-label={fotoSprungLabel(i, fotos.length)}
              aria-current={i === offen ? 'true' : undefined}
              className={cn(
                'shrink-0 rounded-[10px] border-2 p-0.5 transition-colors duration-[250ms]',
                i === offen ? 'border-accent-foreground' : 'border-transparent hover:border-accent-foreground/40',
                FOKUS_RAHMEN
              )}
            >
              {/* Klein mit Ausschnitt und Filter wie die Kachel der Übersicht (Register N17). */}
              <span className="relative block size-[46px] overflow-hidden rounded-md bg-accent-foreground/12">
                <Image src={f.url} alt={fotoAlt(f, hofName)} fill sizes="46px" className="object-cover" style={bildStil(f.ausschnitt ?? null)} />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
