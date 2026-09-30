'use client'

import { useCallback, useSyncExternalStore } from 'react'

/**
 * Ob das Fenster mindestens `px` breit ist — live über matchMedia, ohne
 * Sprung beim Hydrieren: Auf dem Server und beim ersten Rendern im Browser
 * gilt `false`, danach der echte Wert. Der Editor nutzt das, um die
 * Web-Vorschau unter 1280 px ins Overlay zu schicken statt neben die
 * Bearbeitung (src/lib/hofseite-vorschau.ts, VORSCHAU_WEB_MINDESTBREITE).
 */
export function useMindestbreite(px: number): boolean {
  // Stabil je Breite: Eine neue Funktion je Render hieße bei jedem Render ab- und wieder anmelden.
  const anmelden = useCallback(
    (melde: () => void) => {
      const abfrage = window.matchMedia(`(min-width: ${px}px)`)
      abfrage.addEventListener('change', melde)
      return () => abfrage.removeEventListener('change', melde)
    },
    [px]
  )
  const lesen = useCallback(() => window.matchMedia(`(min-width: ${px}px)`).matches, [px])
  return useSyncExternalStore(anmelden, lesen, () => false)
}
