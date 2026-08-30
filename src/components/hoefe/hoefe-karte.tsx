'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { pinDarstellung, pinZustand, type AuswahlLage } from '@/lib/hoefe-anzeige'

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
 * NUMMERIERTE PINS in drei Zuständen (normal/hervorgehoben/ausgewählt,
 * reine Stil-Funktion in src/lib/hoefe-anzeige.ts). EIN PIN NAVIGIERT
 * NIEMALS SELBST — er meldet nur die Auswahl nach oben; zur Hofseite führen
 * ausschließlich Listeneintrag, Karussell-Karte und „Zum Hof". Höfe ohne
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

function pinIcon(nummer: number, zustand: ReturnType<typeof pinZustand>): L.DivIcon {
  const stil = pinDarstellung(zustand)
  return L.divIcon({
    className: '',
    html:
      `<div style="width:${stil.groesse}px;height:${stil.groesse}px;border-radius:9999px;` +
      `background:${stil.hintergrund};color:${stil.schrift};` +
      `display:flex;align-items:center;justify-content:center;` +
      `font-size:13px;font-weight:600;border:2px solid ${stil.rand};` +
      `box-shadow:0 1px 4px rgba(0,0,0,0.35);">${nummer}</div>`,
    iconSize: [stil.groesse, stil.groesse],
    iconAnchor: [stil.groesse / 2, stil.groesse / 2],
  })
}

/** Sanft nur, wenn das System nichts anderes wünscht. */
function wuenschtRuhe(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export default function HoefeKarte({
  hoefe,
  lage,
  fokus,
  sanft = false,
  attributionOben = false,
  hoeheKlasse = 'h-[340px]',
  polsterUnten = 0,
  onAuswahl,
  onLeerTipp,
}: {
  hoefe: KartenHof[]
  /** Die gemeinsame Auswahl-Grammatik (src/lib/hoefe-anzeige.ts). */
  lage: AuswahlLage
  /** Zähler der Anfahrten: bei jeder Erhöhung fährt die Karte den
   *  ausgewählten Pin an. */
  fokus: number
  /** true = Anfahrten fliegen (flyTo), außer bei prefers-reduced-motion. */
  sanft?: boolean
  /** Mobil liegt das Karussell am unteren Rand — die Attribution wandert
   *  dann nach oben rechts, damit sie SICHTBAR bleibt (OSM-Pflicht). */
  attributionOben?: boolean
  hoeheKlasse?: string
  /** Zusätzliches fitBounds-Polster unten in Pixeln: Der Bereich, den das
   *  Karussell überlagert — südliche Pins müssen DARÜBER landen, sonst
   *  liegen sie hinter dem Band und sind nicht antippbar. */
  polsterUnten?: number
  onAuswahl: (slug: string) => void
  /** Tipp ins Kartenleere (nicht auf einen Pin). */
  onLeerTipp?: () => void
}) {
  const kartenDiv = useRef<HTMLDivElement>(null)
  const karte = useRef<L.Map | null>(null)
  const pinEbene = useRef<L.LayerGroup | null>(null)
  // Rückrufe wechseln mit jedem Render, die Handler hängen aber an Karte und
  // Ebene — Refs (im Effekt nachgeführt), damit nichts Altes gefangen bleibt.
  const auswahlRef = useRef(onAuswahl)
  const leerTippRef = useRef(onLeerTipp)
  useEffect(() => {
    auswahlRef.current = onAuswahl
    leerTippRef.current = onLeerTipp
  })

  useEffect(() => {
    if (!kartenDiv.current || karte.current) return
    const map = L.map(kartenDiv.current, {
      center: OESTERREICH_MITTE,
      zoom: OESTERREICH_ZOOM,
      zoomControl: true,
      attributionControl: !attributionOben,
    })
    if (attributionOben) L.control.attribution({ position: 'topright' }).addTo(map)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>-Mitwirkende',
    }).addTo(map)
    // Marker-Klicks laufen bei Leaflet nicht auf die Karte durch — dieser
    // Klick ist also wirklich das Kartenleere. Kurz verzögert, denn vor
    // einem Doppeltipp-/Doppelklick-Zoom feuert Leaflet erst 'click':
    // Der Zoom-Versuch darf die Auswahl nicht löschen.
    let leerTippUhr: ReturnType<typeof setTimeout> | null = null
    const verwerfeLeerTipp = () => {
      if (leerTippUhr) {
        clearTimeout(leerTippUhr)
        leerTippUhr = null
      }
    }
    map.on('click', () => {
      verwerfeLeerTipp()
      leerTippUhr = setTimeout(() => leerTippRef.current?.(), 280)
    })
    map.on('dblclick', verwerfeLeerTipp)
    map.on('zoomstart', verwerfeLeerTipp)
    map.on('movestart', verwerfeLeerTipp)
    pinEbene.current = L.layerGroup().addTo(map)
    karte.current = map
    return () => {
      verwerfeLeerTipp()
      map.remove()
      karte.current = null
      pinEbene.current = null
    }
    // Bewusst nur beim Einhängen; attributionOben wechselt nie zur Laufzeit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Pins neu setzen, wenn Filter, Auswahl oder Zeiger-Hervorhebung wechseln.
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
        icon: pinIcon(hof.nummer, pinZustand(hof.slug, lage)),
        keyboard: false,
      })
        .on('click', () => auswahlRef.current(hof.slug))
        .addTo(ebene)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinSignatur, lage.ausgewaehlt, lage.hervorgehoben])

  // Die Ansicht hängt NUR an der Pin-MENGE, nicht an der Nummerierung: Eine
  // Umkreissuche sortiert die Liste um und vergibt damit alle Nummern neu,
  // ohne dass ein Pin verschwindet — würde die Ansicht daran hängen, risse
  // sie der Nutzerin ihren Kartenausschnitt weg.
  const mengenSignatur = [...hoefe.map((h) => h.slug)].sort().join(',')
  useEffect(() => {
    const map = karte.current
    if (!map) return
    if (hoefe.length === 0) {
      map.setView(OESTERREICH_MITTE, OESTERREICH_ZOOM, { animate: false })
    } else if (hoefe.length === 1) {
      map.setView([hoefe[0].lat, hoefe[0].lon], 11, { animate: false })
    } else {
      map.fitBounds(L.latLngBounds(hoefe.map((h) => [h.lat, h.lon] as [number, number])), {
        paddingTopLeft: [32, 32],
        paddingBottomRight: [32, 32 + polsterUnten],
        maxZoom: 12,
        animate: false,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mengenSignatur])

  // Merkt sich den beim Einhängen schon verbrauchten Stand: Nach einem
  // Reiterwechsel (Karte neu eingehängt) darf eine ALTE Anfahrt nicht erneut
  // feuern — sonst öffnete die Karte herangezoomt auf der letzten Auswahl
  // statt mit der Übersicht.
  const behandelterFokus = useRef(fokus)
  // Während eines Flugs liest getZoom() den abgesenkten Bogen-Zoom — bei
  // Ketten-Wischen würde der Nutzer-Zoom Flug für Flug degradieren. Der
  // Ziel-Zoom des laufenden Flugs gilt darum weiter, bis der Flug ruht.
  const flugZoom = useRef<number | null>(null)
  useEffect(() => {
    if (fokus === behandelterFokus.current) return
    behandelterFokus.current = fokus
    const ziel = hoefe.find((h) => h.slug === lage.ausgewaehlt)
    if (!ziel || !karte.current) return
    const map = karte.current
    const zoom = Math.max(flugZoom.current ?? map.getZoom(), 12)
    if (sanft && !wuenschtRuhe()) {
      flugZoom.current = zoom
      map.once('moveend', () => {
        flugZoom.current = null
      })
      map.flyTo([ziel.lat, ziel.lon], zoom, { duration: 0.6 })
    } else {
      map.setView([ziel.lat, ziel.lon], zoom, { animate: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fokus])

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-border ${hoeheKlasse}`}>
      <div ref={kartenDiv} className="h-full w-full" />
    </div>
  )
}
