'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { BEREIT_TYP, leseMarkierung, verlaesstRahmen } from '@/lib/hofseite-vorschau'
import { ZIEL_ABSCHNITT } from '@/lib/hofseite-fortschritt'

/** So lange bleibt der Rahmen stehen — lang genug zum Hinsehen, kurz genug, um nicht zu stören. */
const MARKIERUNG_MS = 2000

/** Die klebende Kopfleiste der Hofseite am Handy (h-14) — darunter darf das Ziel nicht beginnen. */
const KOPFLEISTE_PX = 56

/**
 * Die Hofseite im Vorschau-Modus, wenn sie im Rahmen des Editors steht
 * (components/farmer/hofseite-vorschau-rahmen.tsx) oder in der Kundenansicht
 * von Mein Hof (components/mein-hof/kundenansicht-vollbild.tsx). Vier Aufgaben:
 *
 * 1. Markierung: Der Editor schickt die Kennung seiner offenen Zeile per
 *    postMessage; die Seite scrollt zum passenden `data-abschnitt` und
 *    umrandet es kurz in der Akzentfarbe. Fremde Ursprünge und fremde Formen
 *    ignoriert leseMarkierung. Gescrollt wird das eigene Fenster, nicht mit
 *    scrollIntoView — das zöge bei gleichem Ursprung die Editor-Seite mit.
 * 2. Bereit-Meldung: Sobald der Empfänger steht, sagt die Seite es dem Editor,
 *    und der schickt die Markierung (noch einmal). Das `load`-Ereignis des
 *    iframes käme womöglich vor der Hydration.
 * 3. Links: Ein Klick auf einen Link zu einer anderen Seite (verlaesstRahmen)
 *    öffnet sie in einem neuen Tab. Im Rahmen führte er sonst auf eine Seite,
 *    die sich nicht einbetten lässt (X-Frame-Options DENY) — ein Fehlerbild
 *    im Handyrahmen.
 *
 * 4. Leiste (seit Nr. 107, Register N4): Die Seite sagt der KundeShell, dass
 *    sie im Rahmen steht (useImVorschauRahmen) — die Leiste der Kundschaft
 *    steht dann blass und ohne Wirkung da. Die Erkennung ist dieselbe wie für
 *    Klicks und Bereit-Meldung: die Vorschau (diese Komponente gibt es nur
 *    mit `ansicht.art === 'vorschau'`, entschieden von ansichtsModus aus
 *    ?vorschau=1) UND `window.parent !== window`. Erst nach dem Mounten — vom
 *    Server und beim Hydrieren kommt die Leiste unverändert.
 *
 * Steht die Seite nicht im Rahmen („In neuem Tab öffnen"), bleibt sie, wie
 * sie ist; dann meldet sie sich nicht und fängt keine Klicks ab.
 */
let imRahmen = false
const hoerer = new Set<() => void>()

function setzeImRahmen(wert: boolean): void {
  if (imRahmen === wert) return
  imRahmen = wert
  for (const melde of hoerer) melde()
}

function abonniere(melde: () => void): () => void {
  hoerer.add(melde)
  return () => {
    hoerer.delete(melde)
  }
}

/**
 * Ob die Hofseite gerade als Vorschau im Rahmen steht (Punkt 4 oben) — für
 * die KundeShell. Vom Server und beim Hydrieren immer `false`.
 */
export function useImVorschauRahmen(): boolean {
  return useSyncExternalStore(
    abonniere,
    () => imRahmen,
    () => false
  )
}

export function VorschauImRahmen(): null {
  useEffect(() => {
    const rahmen = window.parent !== window
    let timer: ReturnType<typeof setTimeout> | null = null
    let markiert: HTMLElement | null = null

    const aufheben = () => {
      if (!markiert) return
      markiert.style.outline = ''
      markiert.style.outlineOffset = ''
      markiert = null
    }

    function beiNachricht(ereignis: MessageEvent) {
      const zeile = leseMarkierung(ereignis, window.location.origin)
      if (!zeile) return
      const ziel = document.querySelector<HTMLElement>(`[data-abschnitt="${ZIEL_ABSCHNITT[zeile]}"]`)
      if (!ziel) return
      if (timer) clearTimeout(timer)
      aufheben()
      const lage = ziel.getBoundingClientRect()
      // Mittig — aber nie unter die klebende Kopfleiste: Ein hoher Abschnitt
      // (Fotos, Kontakt) begänne sonst über dem Fenster.
      const abstand = Math.max(KOPFLEISTE_PX, (window.innerHeight - lage.height) / 2)
      window.scrollTo({ top: Math.max(0, lage.top + window.scrollY - abstand), behavior: 'smooth' })
      // Inline statt Klasse: Das Ziel trägt eigene Klassen, ein Rahmen darf
      // sie nicht anfassen. Die Akzentfarbe kommt aus dem Token, in beiden Modi.
      ziel.style.outline = '3px solid var(--accent)'
      ziel.style.outlineOffset = '4px'
      markiert = ziel
      timer = setTimeout(aufheben, MARKIERUNG_MS)
    }

    function beiKlick(ereignis: MouseEvent) {
      // Klicks mit Taste (neuer Tab, neues Fenster) regelt der Browser selbst.
      if (ereignis.button !== 0 || ereignis.metaKey || ereignis.ctrlKey || ereignis.shiftKey) return
      const link = ereignis.target instanceof Element ? ereignis.target.closest('a[href]') : null
      if (!(link instanceof HTMLAnchorElement)) return
      if (!verlaesstRahmen({ href: link.href, target: link.target }, window.location.href)) return
      // In der Capture-Phase, vor React: weder die Navigation im Rahmen noch
      // ein onClick des Links (etwa router.back des Zurück-Knopfs) darf laufen.
      ereignis.preventDefault()
      ereignis.stopPropagation()
      window.open(link.href, '_blank', 'noopener,noreferrer')
    }

    window.addEventListener('message', beiNachricht)
    if (rahmen) {
      document.addEventListener('click', beiKlick, true)
      window.parent.postMessage({ typ: BEREIT_TYP }, window.location.origin)
      setzeImRahmen(true)
    }
    return () => {
      window.removeEventListener('message', beiNachricht)
      document.removeEventListener('click', beiKlick, true)
      if (timer) clearTimeout(timer)
      aufheben()
      setzeImRahmen(false)
    }
  }, [])

  return null
}
