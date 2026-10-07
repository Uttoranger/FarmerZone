'use client'

import { useEffect } from 'react'
import { teilenBesuchAusAdresse } from '@/lib/teilen-besuch'

const BESUCH_ROUTE = '/api/teilen/besuch'

/**
 * Kam die Kundin über einen geteilten Link (`?k=wa` …)? Dann meldet die Seite
 * den Besuch EINMAL an den Server und nimmt das Kürzel aus der Adresse
 * (Gate 7, Teilen-Zählung; S8, Register T1). Nichts wird im Browser
 * abgelegt: Der Kanal kommt nur aus der aktuellen Adresse.
 *
 * Bewusst im Browser statt beim Rendern auf dem Server: Zählen ist ein POST,
 * nie ein Nebeneffekt eines GET (S2). Vorschau-Abrufer der Messenger,
 * Suchmaschinen und Vorabrufe führen kein JavaScript aus und zählen so nicht;
 * beim Rendern zählte jeder Abruf mit, dessen Kennung der Filter nicht kennt.
 * Genau einmal, weil `k` danach aus der Adresse ist (teilenBesuchAusAdresse).
 * Ohne Cookie, ohne Kennung — gemeldet werden nur Hof und Kürzel. Zeigt nichts an.
 */
export function TeilenBesuchMelden({ farmSlug }: { farmSlug: string }): null {
  useEffect(() => {
    const { kanal, ohne } = teilenBesuchAusAdresse(window.location.href)
    if (kanal) {
      const body = JSON.stringify({ farmSlug, kanal })
      // sendBeacon überlebt auch ein sofortiges Weitertippen; ohne ihn ein
      // fetch mit keepalive. Ein Fehler ist egal — es ist nur ein Zähler.
      const gesendet =
        typeof navigator.sendBeacon === 'function' &&
        navigator.sendBeacon(BESUCH_ROUTE, new Blob([body], { type: 'application/json' }))
      if (!gesendet) {
        void fetch(BESUCH_ROUTE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        }).catch(() => {
          // Bewusst still: ein verlorener Zähler-Aufruf (offline, Seite schon
          // verlassen) betrifft nur die Statistik des Hofs, nie die Kundin —
          // eine Meldung hätte niemanden, der etwas tun kann.
        })
      }
    }
    // Das Kürzel verlässt die Adresse: Teilt die Kundin die Seite weiter,
    // trägt der Link nicht den Kanal des Hofs, und Neuladen zählt nicht neu.
    if (ohne) window.history.replaceState(null, '', ohne)
  }, [farmSlug])

  return null
}
