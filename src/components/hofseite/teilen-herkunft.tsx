'use client'

import { useEffect } from 'react'
import { TEILEN_PARAMETER } from '@/lib/teilen-kanal'
import { adresseOhneKanal, merkeTeilenBesuch, teilenSpeicher } from '@/lib/teilen-herkunft'

/**
 * Kam die Kundin über einen geteilten Link (`?k=wa` …)? Dann merkt sich der
 * Tab das Kürzel für den Checkout, meldet den Besuch EINMAL an den Server
 * und nimmt das Kürzel aus der Adresse (Gate 7, Teilen-Zählung; S8).
 *
 * Bewusst im Browser statt beim Rendern auf dem Server: Vorschau-Abrufer der
 * Messenger und Vorabrufe führen kein JavaScript aus und zählen so nicht,
 * und Zählen ist ein POST (S2). Ohne Cookie, ohne Kennung — gemeldet werden
 * nur Hof und Kürzel. Zeigt nichts an.
 */
export function TeilenHerkunft({ farmSlug }: { farmSlug: string }): null {
  useEffect(() => {
    const wert = new URLSearchParams(window.location.search).get(TEILEN_PARAMETER)
    if (wert === null) return
    const { zaehlen, kanal } = merkeTeilenBesuch(teilenSpeicher(), farmSlug, wert)
    if (zaehlen && kanal) {
      const body = JSON.stringify({ farmSlug, kanal })
      // sendBeacon überlebt auch ein sofortiges Weitertippen; ohne ihn ein
      // fetch mit keepalive. Ein Fehler ist egal — es ist nur ein Zähler.
      const gesendet =
        typeof navigator.sendBeacon === 'function' &&
        navigator.sendBeacon('/api/teilen/besuch', new Blob([body], { type: 'application/json' }))
      if (!gesendet) {
        void fetch('/api/teilen/besuch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        }).catch(() => {})
      }
    }
    // Das Kürzel verlässt die Adresse: Teilt die Kundin die Seite weiter,
    // trägt der Link nicht den Kanal des Hofs, und Neuladen zählt nicht neu.
    const ohne = adresseOhneKanal(window.location.href, TEILEN_PARAMETER)
    if (ohne) window.history.replaceState(null, '', ohne)
  }, [farmSlug])

  return null
}
