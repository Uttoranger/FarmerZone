import type { MouseEvent } from 'react'
import type { Elternseite } from '@/lib/bauern-navigation'
import { tippAufZiel } from '@/lib/kunden-kopf'
import { eigenerVorgaengerJetzt, merkeHinauf } from '@/components/shared/rueckweg-merker'

/*
 * Der Rückweg des Werkzeug-Kopfs (ui/werkzeug-kopf.tsx, Nr. 245) in eigener
 * Datei: Handy-Leiste und Web-Zeile führen über dieselbe Regel zurück (ein
 * Schritt im Verlauf, wenn die Elternseite direkt davor stand, seit Nr. 177),
 * damit Filter, Suche und Scrollstelle der Elternseite erhalten bleiben.
 */

/** Das Ziel samt Filter der Elternseite (z. B. /orders?filter=heute). */
export function zielMitSuche(eltern: Elternseite, suche: string | undefined): string {
  if (!suche) return eltern.href
  const teil = suche.replace(/^\?/, '')
  return eltern.href + (eltern.href.includes('?') ? '&' : '?') + teil
}

/**
 * Der Tipp auf den Rückweg (Nr. 177): Stand die Elternseite direkt davor, ein
 * Schritt im Verlauf — die Liste steht dann mit Filter, Suche und Scrollstelle
 * da, wo man sie verlassen hat. Sonst folgt der Tipp dem Link und steigt
 * hinauf (der RueckwegMerker merkt es sich). Dieselbe Regel wie die
 * Browser-Zeile der Kundenseiten (`tippAufZiel`, lib/kunden-kopf.ts).
 *
 * `history.back()` statt `useRouter().back()`: Der App-Router tut dort nichts
 * anderes, und der Kopf bleibt ohne Router renderbar (Ladeansichten, Tests).
 */
export function beimTipp(ziel: string): (e: MouseEvent<HTMLAnchorElement>) => void {
  return (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    const tipp = tippAufZiel(ziel, eigenerVorgaengerJetzt())
    if (tipp.aktion === 'verlauf') {
      e.preventDefault()
      window.history.back()
      return
    }
    merkeHinauf(tipp.ziel)
  }
}
