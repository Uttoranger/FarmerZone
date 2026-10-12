'use client'

import { useCallback, useSyncExternalStore } from 'react'

/** Meldet jede Änderung der Abfrage „mindestens `px` breit" (für useSyncExternalStore). */
function useAnmelden(px: number): (melde: () => void) => () => void {
  // Stabil je Breite: Eine neue Funktion je Render hieße bei jedem Render ab- und wieder anmelden.
  return useCallback(
    (melde: () => void) => {
      const abfrage = window.matchMedia(`(min-width: ${px}px)`)
      abfrage.addEventListener('change', melde)
      return () => abfrage.removeEventListener('change', melde)
    },
    [px]
  )
}

/**
 * Ob das Fenster mindestens `px` breit ist — live über matchMedia, ohne
 * Sprung beim Hydrieren: Auf dem Server und beim ersten Rendern im Browser
 * gilt `false`, danach der echte Wert. Der Editor nutzt das, um die
 * Web-Vorschau unter 1280 px ins Overlay zu schicken statt neben die
 * Bearbeitung (src/lib/hofseite-vorschau.ts, VORSCHAU_WEB_MINDESTBREITE).
 */
export function useMindestbreite(px: number): boolean {
  const anmelden = useAnmelden(px)
  const lesen = useCallback(() => window.matchMedia(`(min-width: ${px}px)`).matches, [px])
  return useSyncExternalStore(anmelden, lesen, () => false)
}

/**
 * Ob das Fenster schmaler als `px` ist — das Gegenstück, ebenso live und ohne
 * Sprung beim Hydrieren, auf dem Server und beim ersten Rendern ebenfalls
 * `false`. Für das, was nur auf schmalen Bildschirmen etwas lädt: Es kommt
 * erst im Browser und auf breiten nie (der Rahmen von „So sieht’s die
 * Kundin", components/mein-hof/mein-hof-ansicht.tsx). Nicht
 * `!useMindestbreite(px)` — das wäre auf dem Server `true`.
 */
export function useSchmalerAls(px: number): boolean {
  const anmelden = useAnmelden(px)
  const lesen = useCallback(() => !window.matchMedia(`(min-width: ${px}px)`).matches, [px])
  return useSyncExternalStore(anmelden, lesen, () => false)
}
