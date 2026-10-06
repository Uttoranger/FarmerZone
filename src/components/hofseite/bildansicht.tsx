'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { stelleNachBildansicht } from '@/lib/hofseite-sektionen'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'

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
 *  - Escape schließt, die Pfeiltasten blättern.
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

  return { offen, oeffne, schliesse, vor, zurueck }
}

export type BildansichtFoto = { id: string; url: string; caption: string | null }

const RUNDER_KNOPF = cn(
  'flex size-11 items-center justify-center rounded-full bg-accent-foreground/12 text-accent-foreground transition-colors duration-[250ms] hover:bg-accent-foreground/24',
  FOKUS_RAHMEN
)

/**
 * Die Ebene im neuen Design. Der Schleier bleibt in beiden Themes dunkel
 * (DESIGN_SYSTEM, „Bild-Overlays"): `primary-foreground` ist im Geltungsbereich
 * data-design="neu" fast schwarz, `accent-foreground` Crème — beide in beiden
 * Themes gleich, nie Tailwinds black/white. Ebene 70: über der Unterleiste
 * (50/60) und der Kopfzeile (40).
 */
export function BildansichtEbene({
  fotos,
  bild,
  titel,
}: {
  fotos: readonly BildansichtFoto[]
  bild: Bildansicht
  /** Wofür die Ebene steht, für Screenreader: „Fotos vom Hof". */
  titel: string
}): React.JSX.Element | null {
  const schliessenKnopf = useRef<HTMLButtonElement>(null)
  const offen = bild.offen

  // Der Fokus geht in die Ebene, solange sie offen ist — ohne die Seite zu bewegen.
  useEffect(() => {
    if (offen !== null) schliessenKnopf.current?.focus({ preventScroll: true })
  }, [offen])

  if (offen === null || fotos.length === 0) return null
  const foto = fotos[offen]
  if (!foto) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titel}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-primary-foreground/90 p-4"
      onClick={bild.schliesse}
    >
      <button
        ref={schliessenKnopf}
        type="button"
        onClick={bild.schliesse}
        aria-label="Schließen"
        className={cn(RUNDER_KNOPF, 'absolute top-4 right-4')}
      >
        <X className="size-5" strokeWidth={1.7} aria-hidden="true" />
      </button>

      {fotos.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              bild.zurueck()
            }}
            aria-label="Vorheriges Foto"
            className={cn(RUNDER_KNOPF, 'absolute top-1/2 left-4 -translate-y-1/2')}
          >
            <ChevronLeft className="size-5" strokeWidth={1.7} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              bild.vor()
            }}
            aria-label="Nächstes Foto"
            className={cn(RUNDER_KNOPF, 'absolute top-1/2 right-4 -translate-y-1/2')}
          >
            <ChevronRight className="size-5" strokeWidth={1.7} aria-hidden="true" />
          </button>
        </>
      )}

      <figure className="relative w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="relative w-full pb-[66%]">
          <Image
            src={foto.url}
            alt={foto.caption ?? ''}
            fill
            sizes="(min-width: 768px) 768px, 100vw"
            className="rounded-xl object-contain"
          />
        </div>
        <figcaption className="mt-3 text-center text-sm text-accent-foreground">
          {foto.caption && <span className="block break-words">{foto.caption}</span>}
          <span className="mt-1 block text-xs text-accent-foreground/80" aria-live="polite">
            {offen + 1} / {fotos.length}
          </span>
        </figcaption>
      </figure>
    </div>
  )
}
