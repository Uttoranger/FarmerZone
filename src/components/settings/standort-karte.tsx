'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPin } from 'lucide-react'
import { erstelleKartenBremse, type KartenBremse, type StandortKandidat } from '@/lib/geokodierung'

/**
 * Die DAUERHAFT eingebettete Minikarte im Hofprofil — kein Dialog mehr.
 * Adresse und Kartenpunkt arbeiten in beide Richtungen: Die Vorwärts-Suche
 * fährt die Karte auf den Vorschlag, das Schieben füllt (gebremst) die
 * Adressfelder. Gespeichert wird die Kartenmitte zusammen mit dem Profil,
 * nicht mehr über einen eigenen Bestätigen-Knopf.
 *
 * BEDIENUNG nach bewährtem Muster: Der Pin sitzt FEST in der Kartenmitte,
 * der Bauer verschiebt die KARTE darunter — am Touchgerät deutlich
 * treffsicherer, als einen Pin mit dem Finger zu ziehen (der Finger verdeckt
 * sonst genau das, was er treffen soll). Es zählt die Kartenmitte.
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

/** Ein programmatischer Sprung (Ergebnis der Vorwärts-Suche). `folge`
 *  unterscheidet zwei Suchen mit demselben Ziel. */
export type KartenZiel = { lat: number; lon: number; zoom: number; folge: number }

export default function StandortKarte({
  start,
  ziel,
  hinweis,
  kandidaten,
  onMitteVerschoben,
  onAdresseAnfrage,
}: {
  /** Ansicht beim Einhängen: gespeicherter Punkt (Zoom 17) oder Rückfall (Zoom 8). */
  start: { lat: number; lon: number; zoom: number }
  ziel: KartenZiel | null
  /** Die ruhige Zeile über der Karte — null blendet sie aus. */
  hinweis: string | null
  kandidaten: StandortKandidat[]
  /** Jede vom Bauern gewählte Kartenmitte (Schieben oder Kandidatenwahl) —
   *  wird im Formular zum ungespeicherten Koordinaten-Wert. */
  onMitteVerschoben: (lat: number, lon: number) => void
  /** Gebremste Ruheposition nach dem Schieben — löst die Rückwärtssuche aus. */
  onAdresseAnfrage: (lat: number, lon: number) => void
}) {
  const kartenDiv = useRef<HTMLDivElement>(null)
  const karte = useRef<L.Map | null>(null)
  const bremse = useRef<KartenBremse | null>(null)
  // Eigene Sprünge (setView) feuern ebenfalls 'moveend' — sie dürfen weder
  // als Nutzerbewegung zählen noch die Rückwärtssuche anstoßen.
  const programmatisch = useRef(false)
  // Die Rückrufe wechseln mit jedem Render, die Karten-Handler hängen aber
  // nur einmal — Refs, damit nie ein veralteter Rückruf gefangen bleibt.
  const mitteRef = useRef(onMitteVerschoben)
  mitteRef.current = onMitteVerschoben
  const anfrageRef = useRef(onAdresseAnfrage)
  anfrageRef.current = onAdresseAnfrage

  useEffect(() => {
    if (!kartenDiv.current || karte.current) return
    const map = L.map(kartenDiv.current, {
      center: [start.lat, start.lon],
      zoom: start.zoom,
      zoomControl: true,
    })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>-Mitwirkende',
    }).addTo(map)

    const gebremst = erstelleKartenBremse((lat, lon) => anfrageRef.current(lat, lon))
    gebremst.setzeBezugspunkt(start.lat, start.lon)
    map.on('moveend', () => {
      if (programmatisch.current) return
      const mitte = map.getCenter()
      mitteRef.current(mitte.lat, mitte.lng)
      gebremst.mitteBewegt(mitte.lat, mitte.lng)
    })

    karte.current = map
    bremse.current = gebremst
    return () => {
      gebremst.aufloesen()
      map.remove()
      karte.current = null
      bremse.current = null
    }
    // Bewusst nur beim Einhängen: Die Startansicht steht beim ersten Render fest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const zielFolge = ziel?.folge
  useEffect(() => {
    if (!ziel || zielFolge === undefined) return
    springeZu(ziel.lat, ziel.lon, ziel.zoom)
    // Nur `folge` zählt — dasselbe Ziel zweimal gesucht soll zweimal springen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zielFolge])

  function springeZu(lat: number, lon: number, zoom: number) {
    const map = karte.current
    if (!map) return
    bremse.current?.setzeBezugspunkt(lat, lon)
    // animate: false → 'moveend' feuert synchron INNERHALB von setView; die
    // Klammer um `programmatisch` ist damit wasserdicht, auch wenn die Karte
    // schon auf dem Ziel steht und gar kein Ereignis kommt.
    programmatisch.current = true
    map.setView([lat, lon], zoom, { animate: false })
    programmatisch.current = false
  }

  return (
    <div>
      {hinweis && <p className="mb-2 text-xs text-muted-foreground">{hinweis}</p>}

      {/* Mindestens 260 px hoch laut Vorgabe — 280 gibt dem Daumen Spielraum,
          ohne die Speichern-Schaltfläche unnötig weit nach unten zu drücken. */}
      <div className="relative overflow-hidden rounded-xl" style={{ height: 280 }}>
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

      {kandidaten.length > 1 && (
        <div className="mt-3 space-y-1">
          <p className="text-xs text-muted-foreground">Meintest du:</p>
          {kandidaten.map((k) => (
            <button
              key={`${k.lat},${k.lon}`}
              type="button"
              className="block w-full min-h-11 rounded-lg px-3 text-left text-sm text-foreground hover:bg-muted/40 transition-colors"
              onClick={() => {
                // Die Wahl eines Kandidaten IST eine Punktwahl des Bauern —
                // der Sprung selbst bleibt programmatisch (keine Rückwärtssuche).
                springeZu(k.lat, k.lon, 17)
                onMitteVerschoben(k.lat, k.lon)
              }}
            >
              {k.anzeigeName}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
