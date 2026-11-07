import type { MouseEvent } from 'react'
import type { Elternseite } from '@/lib/bauern-navigation'
import { tippAufZiel } from '@/lib/kunden-kopf'
import { eigenerVorgaengerJetzt, merkeHinauf } from '@/components/shared/rueckweg-merker'

/*
 * Der Rückweg der Hof-Köpfe — EINE Quelle für UnterseitenKopf
 * (hofbereich/unterseiten-kopf.tsx, seit Nr. 44/177) und WerkzeugKopf
 * (ui/werkzeug-kopf.tsx, Nr. 245). Aus unterseiten-kopf.tsx herausgezogen,
 * nicht neu geschrieben: Beide Köpfe führen gleich zurück, bis der alte Kopf
 * mit der leeren Bestandsliste wegfällt.
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
