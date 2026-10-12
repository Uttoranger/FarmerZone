'use client'

import { useEffect, type RefObject } from 'react'
import { MARKIERUNG_TYP, type HofseiteZeileId } from '@/schemas/hofseite-vorschau'
import { leseBereit } from '@/lib/hofseite-vorschau'

/**
 * Schickt der Hofseite in einem Rahmen die Kennung eines Abschnitts
 * (schemas/hofseite-vorschau.ts) — dort scrollt sie hin und umrandet ihn kurz
 * (components/farm/vorschau-im-rahmen.tsx). EIN Weg für die Vorschau des
 * Editors ab lg (hofseite-vorschau-rahmen.tsx) und „So sieht’s die Kundin"
 * unter lg (components/mein-hof/mein-hof-ansicht.tsx, Nr. 49).
 *
 * Nur an den eigenen Ursprung. Nach jedem Laden meldet sich die Seite im
 * Rahmen „bereit", und die Markierung geht noch einmal hin: Ein Neuladen
 * verliert sie, und das `load`-Ereignis des iframes käme womöglich vor ihrem
 * Empfänger.
 */
export function useVorschauMarkierung(rahmen: RefObject<HTMLIFrameElement | null>, markiert: HofseiteZeileId | null): void {
  useEffect(() => {
    const sende = () =>
      rahmen.current?.contentWindow?.postMessage({ typ: MARKIERUNG_TYP, abschnitt: markiert }, window.location.origin)
    // Nur die eigene Seite im eigenen Rahmen darf „bereit" sagen.
    const beiNachricht = (ereignis: MessageEvent) => {
      if (ereignis.source !== rahmen.current?.contentWindow) return
      if (leseBereit(ereignis, window.location.origin)) sende()
    }
    sende()
    window.addEventListener('message', beiNachricht)
    return () => window.removeEventListener('message', beiNachricht)
  }, [rahmen, markiert])
}
