'use client'

import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Loader2, MapPin } from 'lucide-react'
import type { GeokodierungsErgebnis } from '@/lib/geokodierung'

/**
 * Minikarte zum Bestätigen des Hofstandorts.
 *
 * BEDIENUNG nach bewährtem Muster: Der Pin sitzt FEST in der Kartenmitte,
 * der Bauer verschiebt die KARTE darunter — am Touchgerät deutlich
 * treffsicherer, als einen Pin mit dem Finger zu ziehen (der Finger verdeckt
 * sonst genau das, was er treffen soll). Bestätigt wird die Kartenmitte.
 *
 * Die Kacheln kommen DIREKT von tile.openstreetmap.org — bewusst OHNE
 * Proxy-Route: Das Weiterverteilen von Kacheln über die eigene Domain
 * widerspricht der OSM-Kachelrichtlinie. Diese Minikarte sehen
 * ausschließlich eingeloggte Bauern, das Aufkommen ist minimal; die
 * IP-Übertragung an OSM steht in der Datenschutzerklärung. Für eine spätere
 * ÖFFENTLICHE Kundenkarte reicht das nicht — dann braucht es einen eigenen
 * Kachel-Anbieter mit Schlüssel.
 *
 * Wird nur clientseitig geladen (next/dynamic in profile-form): Leaflet
 * greift beim Import auf window zu.
 */

export default function StandortKarte({
  adresse,
  ergebnis,
  onBestaetigt,
  onAbbrechen,
}: {
  /** Die eingegebene Adresse als Text über der Karte. */
  adresse: string
  ergebnis: GeokodierungsErgebnis
  /** Speichert; liefert im Fehlerfall den anzuzeigenden Text. */
  onBestaetigt: (lat: number, lon: number) => Promise<{ error?: string }>
  onAbbrechen: () => void
}) {
  const kartenDiv = useRef<HTMLDivElement>(null)
  const karte = useRef<L.Map | null>(null)
  const [speichert, setSpeichert] = useState(false)
  const [hinweis, setHinweis] = useState<string | null>(null)

  useEffect(() => {
    if (!kartenDiv.current || karte.current) return
    const map = L.map(kartenDiv.current, {
      center: [ergebnis.zentrum.lat, ergebnis.zentrum.lon],
      zoom: ergebnis.zoom,
      zoomControl: true,
    })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>-Mitwirkende',
    }).addTo(map)
    karte.current = map
    return () => {
      map.remove()
      karte.current = null
    }
    // Bewusst nur beim Einhängen: Das Ergebnis steht beim Öffnen fest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function bestaetigen() {
    const mitte = karte.current?.getCenter()
    if (!mitte || speichert) return
    setSpeichert(true)
    setHinweis(null)
    try {
      const ergebnis = await onBestaetigt(mitte.lat, mitte.lng)
      if (ergebnis.error) setHinweis(ergebnis.error)
    } finally {
      setSpeichert(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-label="Standort bestätigen">
      <button type="button" aria-label="Abbrechen" className="absolute inset-0 bg-black/40" onClick={onAbbrechen} />
      <div className="relative w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-card p-4 shadow-lg">
        <p className="text-sm font-medium text-foreground">{adresse}</p>
        <p className="mt-0.5 mb-3 text-xs text-muted-foreground">{ergebnis.hinweis}</p>

        <div className="relative overflow-hidden rounded-xl" style={{ height: 240 }}>
          <div ref={kartenDiv} className="h-full w-full" />
          {/* Der feste Pin: exakt über der Kartenmitte, mit der Spitze im
              Zentrum — deshalb um die halbe Icon-Höhe angehoben. */}
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 z-[500] -translate-x-1/2 -translate-y-full"
            aria-hidden="true"
          >
            <MapPin className="size-8 text-primary drop-shadow" fill="white" strokeWidth={2} />
          </div>
        </div>

        {ergebnis.kandidaten.length > 1 && (
          <div className="mt-3 space-y-1">
            <p className="text-xs text-muted-foreground">Meintest du:</p>
            {ergebnis.kandidaten.map((k) => (
              <button
                key={`${k.lat},${k.lon}`}
                type="button"
                className="block w-full min-h-11 rounded-lg px-3 text-left text-sm text-foreground hover:bg-muted/40 transition-colors"
                onClick={() => karte.current?.setView([k.lat, k.lon], 17)}
              >
                {k.anzeigeName}
              </button>
            ))}
          </div>
        )}

        {hinweis && (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {hinweis}
          </p>
        )}

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onAbbrechen}
            className="min-h-12 flex-1 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted/40 transition-colors"
          >
            Später
          </button>
          <button
            type="button"
            onClick={bestaetigen}
            disabled={speichert}
            className="min-h-12 flex-1 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {speichert ? <Loader2 className="mx-auto size-4 animate-spin" /> : 'Standort bestätigen'}
          </button>
        </div>
      </div>
    </div>
  )
}
