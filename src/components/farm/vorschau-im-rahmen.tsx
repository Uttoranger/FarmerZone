'use client'

import { useEffect } from 'react'
import { BEREIT_TYP } from '@/schemas/hofseite-vorschau'
import { leseMarkierung, verlaesstRahmen } from '@/lib/hofseite-vorschau'
import { ZIEL_ABSCHNITT } from '@/lib/hofseite-fortschritt'

/** So lange bleibt der Rahmen stehen — lang genug zum Hinsehen, kurz genug, um nicht zu stören. */
const MARKIERUNG_MS = 2000

/** Die klebende Kopfleiste der Hofseite am Handy (h-14) — darunter darf das Ziel nicht beginnen. */
const KOPFLEISTE_PX = 56

/**
 * Die Hofseite im Vorschau-Modus, wenn sie im Rahmen des Editors steht
 * (components/farmer/hofseite-vorschau-rahmen.tsx). Drei Aufgaben:
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
 * Steht die Seite nicht im Rahmen („In neuem Tab öffnen"), bleibt sie, wie
 * sie ist; dann meldet sie sich nicht und fängt keine Klicks ab.
 */
export function VorschauImRahmen(): null {
  useEffect(() => {
    const imRahmen = window.parent !== window
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
    if (imRahmen) {
      document.addEventListener('click', beiKlick, true)
      window.parent.postMessage({ typ: BEREIT_TYP }, window.location.origin)
    }
    return () => {
      window.removeEventListener('message', beiNachricht)
      document.removeEventListener('click', beiKlick, true)
      if (timer) clearTimeout(timer)
      aufheben()
    }
  }, [])

  return null
}
