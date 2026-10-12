'use client'

import { useEffect, useRef, type RefObject } from 'react'
import type { LatLng, Map as LeafletKarte } from 'leaflet'
import type { AusschnittMerker } from '@/lib/hoefe-anzeige'

/** Der Ausschnitt unmittelbar vor dem Größenwechsel — noch mit der alten Größe gemessen. */
export type VorDemGroessenwechsel = { mitte: LatLng; zoom: number }

/**
 * EIN Hook für den Größenwechsel beider Leaflet-Karten (Hofübersicht samt
 * Umfeld, Standortkarte im Hof-Profil; Nachtlauf Nr. 52).
 *
 * Leaflet misst seinen Container nur beim Start und bei window-resize. Ändert
 * sich die Größe anders — Splitscreen schmaler, Drehen des Handys, eine Zeile
 * darüber erscheint —, rechnet die Karte mit der alten Größe weiter: Pins
 * liegen außerhalb, und die Mitte, die Leaflet meldet, ist nicht mehr die
 * Mitte, die man sieht. Darum beobachtet ein ResizeObserver den
 * Kartencontainer und ruft map.invalidateSize(). Die Karten legen Leaflet
 * mit `trackResize: false` an, damit nicht zwei Stellen dieselbe Karte neu
 * messen (Leaflets eigenes Messen lief per requestAnimationFrame vor dem
 * Beobachter, und dessen Bewegung zählte als eine der Nutzerin).
 *
 * Danach entscheidet die Karte selbst (`nachGroesse`), was mit dem
 * Ausschnitt geschieht: die Hofübersicht passt die Übersicht neu ein, solange
 * die Nutzerin nichts bewegt hat; die Standortkarte stellt genau die Mitte von
 * vorher wieder her (der feste Pin). Beides läuft in `merker.still()`: Die
 * Bewegungen, die dabei entstehen, sind keine der Nutzerin — sie füllen weder
 * ein Formular noch heben sie das Neu-Einpassen auf.
 */
export function useKartenGroesse(
  container: RefObject<HTMLElement | null>,
  karte: RefObject<LeafletKarte | null>,
  merker: AusschnittMerker,
  nachGroesse: (vorher: VorDemGroessenwechsel) => void
): void {
  // Der Rückruf wechselt mit jedem Render; der Beobachter entsteht nur einmal.
  const nachGroesseRef = useRef(nachGroesse)
  useEffect(() => {
    nachGroesseRef.current = nachGroesse
  })

  useEffect(() => {
    const element = container.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const beobachter = new ResizeObserver(() => {
      const map = karte.current
      if (!map) return
      const breite = element.clientWidth
      const hoehe = element.clientHeight
      // Ausgeblendet (0 px): nichts einpassen — beim Wiedererscheinen meldet sich der Beobachter erneut.
      if (breite === 0 || hoehe === 0) return
      // getSize() ist die Größe, mit der Leaflet zuletzt gerechnet hat.
      const bisher = map.getSize()
      if (bisher.x === breite && bisher.y === hoehe) return
      // Mitte und Zoom VOR invalidateSize lesen: danach rechnet Leaflet schon mit der neuen Größe.
      const vorher = { mitte: map.getCenter(), zoom: map.getZoom() }
      merker.still(() => {
        map.invalidateSize({ animate: false, pan: true })
        nachGroesseRef.current(vorher)
      })
    })
    beobachter.observe(element)
    return () => beobachter.disconnect()
  }, [container, karte, merker])
}
