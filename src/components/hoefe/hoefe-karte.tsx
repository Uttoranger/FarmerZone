'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

/**
 * Die Kundenkarte der Hofübersicht — Leaflet nach dem Muster der Profilkarte
 * (standort-karte.tsx): dynamischer Import ohne SSR, Kacheln DIREKT von
 * tile.openstreetmap.org, sichtbare Attribution.
 *
 * ZUR KACHELQUELLE: Die Profilkarte (standort-karte.tsx) vermerkt, eine
 * öffentliche Kundenkarte brauche einen eigenen Kachel-Anbieter — diese
 * Karte hier geht BEWUSST darüber hinweg: Der Betreiber hat für diese
 * Fassung ausdrücklich dasselbe OSM-Muster vorgegeben, und in der
 * Pilotphase (eine Handvoll Höfe, Kacheln laden erst beim Öffnen des
 * Reiters, Attribution sichtbar) liegt das Aufkommen weit unter den
 * Grenzen der OSM-Kachelrichtlinie. Der Kern des alten Vermerks bleibt
 * für den Maßstab darüber richtig: Wächst die Plattform, braucht es den
 * Kachel-Anbieter mit Schlüssel.
 *
 * NUMMERIERTE PINS: Jeder Pin trägt die Nummer seines Listeneintrags.
 * Antippen meldet den Hof nach oben (Eintrag wird hervorgehoben); umgekehrt
 * fährt die Nummer im Eintrag die Karte hierher (`fokus` zählt jede Anfahrt,
 * damit dieselbe Nummer auch zweimal hintereinander wirkt). Höfe ohne
 * Koordinaten kommen hier gar nicht erst an.
 */

export type KartenHof = {
  slug: string
  nummer: number
  lat: number
  lon: number
}

/** Rückfall-Ansicht, wenn (nach Filterung) kein Hof einen Punkt hat:
 *  Österreich als Ganzes statt einer leeren Weltkarte. */
const OESTERREICH_MITTE: [number, number] = [47.7, 13.4]
const OESTERREICH_ZOOM = 7

function pinIcon(nummer: number, hervorgehoben: boolean): L.DivIcon {
  const groesse = hervorgehoben ? 34 : 28
  return L.divIcon({
    className: '',
    html:
      `<div style="width:${groesse}px;height:${groesse}px;border-radius:9999px;` +
      `background:${hervorgehoben ? '#1F4630' : '#2D5F3F'};color:#fff;` +
      `display:flex;align-items:center;justify-content:center;` +
      `font-size:13px;font-weight:600;border:2px solid #fff;` +
      `box-shadow:0 1px 4px rgba(0,0,0,0.35);">${nummer}</div>`,
    iconSize: [groesse, groesse],
    iconAnchor: [groesse / 2, groesse / 2],
  })
}

export default function HoefeKarte({
  hoefe,
  ausgewaehlt,
  fokus,
  onAuswahl,
}: {
  hoefe: KartenHof[]
  /** Slug des hervorgehobenen Hofs — Pin wird größer und dunkler. */
  ausgewaehlt: string | null
  /** Zähler der Anfahrten: bei jeder Erhöhung fährt die Karte den
   *  ausgewählten Pin an. */
  fokus: number
  onAuswahl: (slug: string) => void
}) {
  const kartenDiv = useRef<HTMLDivElement>(null)
  const karte = useRef<L.Map | null>(null)
  const pinEbene = useRef<L.LayerGroup | null>(null)
  // Der Rückruf wechselt mit jedem Render, die Marker hängen aber an der
  // Ebene — Ref (im Effekt nachgeführt), damit nie ein veralteter Rückruf
  // gefangen bleibt.
  const auswahlRef = useRef(onAuswahl)
  useEffect(() => {
    auswahlRef.current = onAuswahl
  })

  useEffect(() => {
    if (!kartenDiv.current || karte.current) return
    const map = L.map(kartenDiv.current, {
      center: OESTERREICH_MITTE,
      zoom: OESTERREICH_ZOOM,
      zoomControl: true,
    })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>-Mitwirkende',
    }).addTo(map)
    pinEbene.current = L.layerGroup().addTo(map)
    karte.current = map
    return () => {
      map.remove()
      karte.current = null
      pinEbene.current = null
    }
  }, [])

  // Pins neu setzen, wenn Filter oder Hervorhebung wechseln; die Ansicht
  // wird nur an die PIN-MENGE angepasst, nicht an die Hervorhebung.
  // Die Signatur trägt Slug UND Nummer: Fällt per Filter ein koordinatenloser
  // Hof VOR den Pins weg, ändern sich nur die Nummern — auch dann müssen die
  // Pins neu gezeichnet werden, sonst zählt die Karte anders als die Liste.
  const pinSignatur = hoefe.map((h) => `${h.slug}:${h.nummer}`).join(',')
  useEffect(() => {
    const map = karte.current
    const ebene = pinEbene.current
    if (!map || !ebene) return
    ebene.clearLayers()
    for (const hof of hoefe) {
      L.marker([hof.lat, hof.lon], {
        icon: pinIcon(hof.nummer, hof.slug === ausgewaehlt),
        keyboard: false,
      })
        .on('click', () => auswahlRef.current(hof.slug))
        .addTo(ebene)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinSignatur, ausgewaehlt])

  useEffect(() => {
    const map = karte.current
    if (!map) return
    if (hoefe.length === 0) {
      map.setView(OESTERREICH_MITTE, OESTERREICH_ZOOM, { animate: false })
    } else if (hoefe.length === 1) {
      map.setView([hoefe[0].lat, hoefe[0].lon], 11, { animate: false })
    } else {
      map.fitBounds(L.latLngBounds(hoefe.map((h) => [h.lat, h.lon] as [number, number])), {
        padding: [32, 32],
        maxZoom: 12,
        animate: false,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinSignatur])

  // Merkt sich den beim Einhängen schon verbrauchten Stand: Nach einem
  // Reiterwechsel (Karte neu eingehängt) darf eine ALTE Anfahrt nicht erneut
  // feuern — sonst öffnete die Karte herangezoomt auf der letzten Auswahl
  // statt mit der Übersicht.
  const behandelterFokus = useRef(fokus)
  useEffect(() => {
    if (fokus === behandelterFokus.current) return
    behandelterFokus.current = fokus
    const ziel = hoefe.find((h) => h.slug === ausgewaehlt)
    if (!ziel || !karte.current) return
    karte.current.setView([ziel.lat, ziel.lon], Math.max(karte.current.getZoom(), 12), {
      animate: false,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fokus])

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border" style={{ height: 340 }}>
      <div ref={kartenDiv} className="h-full w-full" />
    </div>
  )
}
