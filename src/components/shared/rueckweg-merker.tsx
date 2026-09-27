'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { merkeVorgaenger, vorgaengerEigen, type SeitenWechsel } from '@/lib/kunden-kopf'

/**
 * Merkt sich je Dokument, ob vor der aktuellen Seite eine eigene steht — für
 * den Zurück-Knopf der Kundenseiten (kunden-kopf.tsx).
 *
 * Warum nicht einfacher: `document.referrer` bleibt nach Seitenwechseln in
 * der App auf dem Stand des ersten Ladens stehen, `history.length` zählt auch
 * fremde Seiten (so führte der alte ZurueckLink zurück zu Google), und eigene
 * Werte in `history.state` überschreibt Next. Bleibt: selbst mitzählen. Der
 * Stand lebt im Modul, also genau so lange wie das Dokument — ein geteilter
 * Link, ein neuer Tab und Neuladen fangen bei „kein eigener Vorgänger" an.
 *
 * Sitzt im Root-Layout, damit auch der Weg von der Startseite zählt.
 */
let eigenerVorgaenger = false

/** Zum Zeitpunkt des Tipps gelesen — die Navigation API, wo es sie gibt, sonst der Merker. */
export function hatEigenenVorgaenger(): boolean {
  const navigation = (window as Window & { navigation?: { canGoBack?: unknown } }).navigation
  const canGoBack = typeof navigation?.canGoBack === 'boolean' ? navigation.canGoBack : undefined
  return vorgaengerEigen(canGoBack, eigenerVorgaenger)
}

export function RueckwegMerker() {
  const pfad = usePathname()
  const letzterPfad = useRef<string | null>(null)
  const durchVerlauf = useRef(false)

  useEffect(() => {
    // Zurück oder Vorwärts im Browser — auch der Zurück-Knopf der Kopfzeile
    // selbst (router.back). Der Seitenwechsel danach zählt dann nicht als Link.
    const beiVerlauf = () => {
      durchVerlauf.current = true
    }
    window.addEventListener('popstate', beiVerlauf)
    return () => window.removeEventListener('popstate', beiVerlauf)
  }, [])

  useEffect(() => {
    const wechsel: SeitenWechsel =
      letzterPfad.current === null
        ? 'start'
        : letzterPfad.current === pfad
          ? 'nurQuery'
          : durchVerlauf.current
            ? 'verlauf'
            : 'link'
    letzterPfad.current = pfad
    durchVerlauf.current = false
    eigenerVorgaenger = merkeVorgaenger(eigenerVorgaenger, wechsel)
  }, [pfad])

  return null
}
