'use client'

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  EIGENER_PIN,
  KARTEN_KACHELN,
  PILLE_HOEHE,
  PIN_FOKUS,
  UMKREIS_KREIS,
  erstelleAusschnittMerker,
  gruppenBeschriftung,
  gruppenPinMasse,
  gruppenZustand,
  gruppierePins,
  pinBeschriftung,
  pinDarstellung,
  pinName,
  pinNamenMasse,
  pinZustand,
  trefferMasse,
  zeigePinNamen,
  zoomBisEinzeln,
  zoomZumAufloesen,
  type AuswahlLage,
  type PinPunkt,
  type PinZustand,
} from '@/lib/hoefe-anzeige'
import { cn } from '@/lib/utils'
import { useKartenGroesse } from '@/components/karte/use-karten-groesse'
import { KURZKARTE_BREITE } from '@/components/hoefe/hof-kurzkarte'

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
 * Kachel-Anbieter mit Schlüssel. Offen in Register O6; Kacheln und
 * Attribution stehen an EINER Stelle (KARTEN_KACHELN).
 *
 * NUMMERIERTE PINS in drei Zuständen (normal/hervorgehoben/ausgewählt,
 * reine Stil-Funktion in src/lib/hoefe-anzeige.ts). EIN PIN NAVIGIERT
 * NIEMALS SELBST — er meldet nur die Auswahl nach oben; zur Hofseite führen
 * ausschließlich Listeneintrag, Karussell-Karte und „Zum Hof". Höfe ohne
 * Koordinaten kommen hier gar nicht erst an.
 *
 * GRUPPEN-PINS (Nr. 52): Pins, deren Trefferflächen (44 px, rund) sich bei
 * der aktuellen Zoomstufe überdecken würden, zeichnet die Karte als EINEN
 * Gruppen-Pin „3 Höfe" (gruppierePins, rein und getestet; kein Paket). Ein
 * Tipp darauf zoomt genau so weit hinein, bis die Gruppe zerfällt; bei
 * maximaler Zoomstufe stehen Höfe am selben Punkt leicht aufgefächert. Die
 * Nummern der Liste bleiben.
 *
 * NAMEN, TASTATUR UND VORSCHAU (Nr. 120, Register N22): Ab Zoom 12 oder bei
 * höchstens 12 Pins im Bild trägt jeder Pin seinen Namen als Pille
 * (zeigePinNamen; gruppierePins rechnet dann mit ihrer Breite). Jeder Pin und
 * jeder Gruppen-Pin ist per Tab erreichbar (Leaflets `keyboard`), Enter und
 * Leertaste wirken wie ein Klick. Am Computer öffnet Darüberfahren
 * oder Tab-Fokus die HofKurzkarte (`kurzkarte`) als `role="tooltip"`; sie bleibt, solange
 * der Zeiger auf Pin oder Vorschau ist, und schließt mit Escape oder 300 ms
 * nach dem Verlassen. Am Handy gibt es keine Vorschau. Ein Hinweis auf Höfe
 * ohne Kartenpunkt (`hinweis`) steht oben auf der Karte.
 *
 * GRÖSSENWECHSEL (Nr. 52): useKartenGroesse misst den Container
 * (ResizeObserver); solange die Nutzerin weder verschoben noch gezoomt hat,
 * passt die Karte danach die Übersicht neu ein — auch beim Drehen.
 *
 * ZENTRUM (Umfeld, Auswertung): Optional ein Mittelpunkt — der eigene Hof als
 * eigener, deutlich anderer Pin (EIGENER_PIN) und der Umkreis als Kreis. Die
 * Ansicht folgt dann dem Kreis, nicht der Pin-Menge. Die fremden Pins bleiben
 * dieselben wie auf /hoefe; der eigene ist nie einer davon.
 *
 * DARK MODE: Die Kacheln bleiben hell — ein invertiertes Luftbild ist keine
 * Karte mehr, sondern ein Negativ, und Ortsnamen würden unlesbar. Damit
 * bleiben auch Pins, Gruppen-Pins und Leaflets eigene Bedienteile (Zoom,
 * Attribution) so, wie sie sind: Sie liegen AUF den hellen Kacheln, nicht
 * auf der Seite. Dem Modus folgt nur der Rahmen des Containers (border-border).
 */

export type KartenHof = PinPunkt

/** Rückfall-Ansicht, wenn (nach Filterung) kein Hof einen Punkt hat:
 *  Österreich als Ganzes statt einer leeren Weltkarte. */
const OESTERREICH_MITTE: [number, number] = [47.7, 13.4]
const OESTERREICH_ZOOM = 7

/** Die halbe Höhe des größten Pins (ausgewählt): So weit ragt ein Pin über seinen Punkt hinaus. */
const PIN_HALB = pinDarstellung('ausgewaehlt').groesse / 2

/**
 * Der äußere Rahmen einer Marke: so groß wie die Trefferfläche (trefferMasse,
 * mindestens 44 px — dieselbe Zahl, mit der gruppierePins entscheidet), das
 * Bild darin mittig. Rahmen und Marke selbst sind ganz rund (Kreis bzw.
 * Pille): Der Browser nimmt Tipps nur innerhalb der Rundung an, also klickt
 * die Fläche genau so, wie die Gruppierung sie rechnet — die Ecken eines
 * Quadrats gehörten sonst zur Marke und reichten in den Nachbarn.
 */
const TREFFER_RUNDUNG = 'rounded-full'

function trefferRahmen(breite: number, hoehe: number, bild: string): Pick<L.DivIconOptions, 'className' | 'html' | 'iconSize' | 'iconAnchor'> {
  const { breite: b, hoehe: h } = trefferMasse(breite, hoehe)
  return {
    className: TREFFER_RUNDUNG,
    html: `<div style="width:${b}px;height:${h}px;border-radius:9999px;display:flex;align-items:center;justify-content:center;">${bild}</div>`,
    iconSize: [b, h],
    iconAnchor: [b / 2, h / 2],
  }
}

/** Die Pille mit dem Namen: in jeder Stufe weiß mit dunkelgrüner Schrift — nur die Scheibe zeigt den Zustand (Board). */
const PILLE = {
  hintergrund: pinDarstellung('normal').hintergrund,
  schrift: pinDarstellung('hervorgehoben').schrift,
  rand: pinDarstellung('normal').rand,
}

/** Text für das HTML einer Marke — ein Hofname ist Fremdtext. */
function ohneMarkup(text: string): string {
  return text.replace(/[<>&"]/g, '')
}

function scheibe(nummer: number, zustand: PinZustand): string {
  const stil = pinDarstellung(zustand)
  return (
    `<div style="width:${stil.groesse}px;height:${stil.groesse}px;border-radius:9999px;flex:none;position:relative;z-index:1;` +
    `background:${stil.hintergrund};color:${stil.schrift};` +
    `display:flex;align-items:center;justify-content:center;` +
    `font-size:13px;font-weight:600;border:2px solid ${stil.rand};` +
    `box-shadow:0 1px 4px rgba(0,0,0,0.35);">${nummer}</div>`
  )
}

function pinIcon(nummer: number, zustand: PinZustand, name?: string): L.DivIcon {
  const stil = pinDarstellung(zustand)
  if (!name) {
    return L.divIcon({ ...trefferRahmen(stil.groesse, stil.groesse, scheibe(nummer, zustand)), className: cn(TREFFER_RUNDUNG, PIN_FOKUS) })
  }
  // Mit Namen (Register N22): die Scheibe mittig in ihrer Trefferfläche, rechts die
  // Pille, unter die Scheibe geschoben. Der Punkt des Hofs bleibt die Mitte der Scheibe.
  const masse = pinNamenMasse(name)
  const links = masse.ankerX - stil.groesse / 2
  const pille =
    `<div style="height:${PILLE_HOEHE}px;margin-left:-6px;padding:0 8px 0 12px;border-radius:9999px;white-space:nowrap;` +
    `display:flex;align-items:center;background:${PILLE.hintergrund};` +
    `color:${PILLE.schrift};font-size:12px;font-weight:700;border:1px solid ${PILLE.rand};` +
    `box-shadow:0 1px 4px rgba(0,0,0,0.25);">${ohneMarkup(pinName(name))}</div>`
  return L.divIcon({
    className: cn(TREFFER_RUNDUNG, PIN_FOKUS),
    html:
      `<div style="width:${masse.breite}px;height:${masse.hoehe}px;border-radius:9999px;display:flex;align-items:center;padding-left:${links}px;">` +
      `${scheibe(nummer, zustand)}${pille}</div>`,
    iconSize: [masse.breite, masse.hoehe],
    iconAnchor: [masse.ankerX, masse.hoehe / 2],
  })
}

/**
 * Der Gruppen-Pin: eine Pille mit „3 Höfe" in den Farben der Pins (dieselben
 * drei Stufen) — die Pillenform unterscheidet ihn von einem nummerierten Pin,
 * und die Zahl allein läse man als Hof Nummer 3. Der Text ist zugleich sein
 * Name für Screenreader.
 */
function gruppenIcon(anzahl: number, zustand: PinZustand): L.DivIcon {
  const stil = pinDarstellung(zustand)
  const { breite, hoehe } = gruppenPinMasse(anzahl)
  const name = gruppenBeschriftung(anzahl)
  return L.divIcon({
    ...trefferRahmen(
      breite,
      hoehe,
      `<div role="img" aria-label="${name}" style="width:${breite}px;height:${hoehe}px;border-radius:9999px;` +
        `background:${stil.hintergrund};color:${stil.schrift};` +
        `display:flex;align-items:center;justify-content:center;white-space:nowrap;` +
        `font-size:12px;font-weight:700;border:2px solid ${stil.rand};` +
        `box-shadow:0 1px 4px rgba(0,0,0,0.35);">${name}</div>`
    ),
    className: cn(TREFFER_RUNDUNG, PIN_FOKUS),
  })
}

function eigenerPinIcon(titel: string): L.DivIcon {
  const p = EIGENER_PIN
  // Der Pin ist nicht antippbar (interactive: false) — ein title zeigte sich
  // nie. Die Beschriftung trägt er deshalb selbst, für Screenreader.
  const beschriftung = titel.replace(/[<>&"]/g, '')
  return L.divIcon({
    className: '',
    html:
      `<div role="img" aria-label="${beschriftung}" style="width:${p.groesse}px;height:${p.groesse}px;border-radius:${p.eckenRadius}px;` +
      `background:${p.hintergrund};color:${p.schrift};` +
      `display:flex;align-items:center;justify-content:center;` +
      `font-size:12px;font-weight:700;border:2px solid ${p.rand};` +
      `box-shadow:0 1px 5px rgba(0,0,0,0.45);">${p.beschriftung}</div>`,
    iconSize: [p.groesse, p.groesse],
    iconAnchor: [p.groesse / 2, p.groesse / 2],
  })
}

/** Mittelpunkt und Umkreis — nur in der Auswertung (Umfeld). */
export type KartenZentrum = { lat: number; lon: number; radiusKm: number; titel: string }

/** Die halbe Breite der Vorschau — die Karte zentriert sie über dem Pin. */
const KURZKARTE_HALB = KURZKARTE_BREITE / 2

/** So lange bleibt die Vorschau, nachdem Zeiger oder Fokus Pin und Vorschau verlassen haben (Board). */
const VORSCHAU_NACHLAUF_MS = 300
/** Abstand der Vorschau zum Punkt des Pins; darüber, wenn oben so viel Platz ist. */
const VORSCHAU_ABSTAND = 26
const VORSCHAU_PLATZ_OBEN = 330

/** Wie viele Pins im sichtbaren Ausschnitt liegen — für die Namen (zeigePinNamen). */
function pinsImBild(map: L.Map, hoefe: readonly KartenHof[]): number {
  const bild = map.getBounds()
  return hoefe.filter((h) => bild.contains([h.lat, h.lon])).length
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
  randlos = false,
  polsterUnten = 0,
  polsterOhneAuswahl = 0,
  zentrum,
  hinweis = null,
  kurzkarte,
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
  /** Ohne eigenen Rahmen und ohne Rundung: Der Kartenmodus am Handy zeigt die
   *  Karte über die volle Breite bis zur Unterleiste. */
  randlos?: boolean
  /** Höhe des Bandes unten in Pixeln (Karussell am Handy, Karte unter dem
   *  Pin im Umfeld). Es liegt nur über der Karte, solange ein Hof gewählt
   *  ist — nur dann hält die Übersicht Platz dafür frei, und ein gewählter
   *  Pin landet darüber statt dahinter (Nr. 52: Ohne Auswahl gehört die
   *  ganze Höhe den Pins, sonst bliebe im Querformat kaum Karte übrig). */
  polsterUnten?: number
  /** Höhe unten, die OHNE Auswahl frei bleibt: der Hinweis „Tippe einen Hof
   *  an" am Handy samt Abstand zur Kante. Die Übersicht hält sie frei, sonst
   *  läge der Hinweis im Querformat über Pins (Nachbesserung Runde 1). */
  polsterOhneAuswahl?: number
  /** Der eigene Hof als Mittelpunkt, samt Umkreis als Kreis (Umfeld). */
  zentrum?: KartenZentrum
  /** Der Satz zu Höfen ohne Kartenpunkt — oben auf der Karte (kartenpunktHinweis). */
  hinweis?: string | null
  /** Am Computer: die Vorschau zu einem Pin (HofKurzkarte). Ohne sie (Handy, Umfeld) gibt es keine. */
  kurzkarte?: (slug: string, id: string) => ReactNode
  onAuswahl: (slug: string) => void
  /** Tipp ins Kartenleere (nicht auf einen Pin). */
  onLeerTipp?: () => void
}) {
  const kartenDiv = useRef<HTMLDivElement>(null)
  const karte = useRef<L.Map | null>(null)
  const pinEbene = useRef<L.LayerGroup | null>(null)
  const zentrumEbene = useRef<L.LayerGroup | null>(null)
  const attribution = useRef<L.Control.Attribution | null>(null)
  // Hat die Nutzerin den Ausschnitt selbst bewegt? Eigene Bewegungen laufen in merker.still().
  const [merker] = useState(erstelleAusschnittMerker)
  // Zählt Leaflets zoomend: Danach gruppieren die Pins neu, immer für
  // map.getZoom() — nie für einen gemerkten Wert, der dem Zoom einen
  // Bildaufbau hinterherliefe (Nachbesserung Runde 1). Ein Zähler statt der
  // Stufe selbst: Endet ein Flug auf der Stufe, auf der er begann, wird
  // trotzdem neu gruppiert — unterwegs kann der Effekt den Zwischen-Zoom des
  // Bogens gelesen haben.
  const [zoomEnden, setZoomEnden] = useState(0)
  // Zeigt die Karte gerade Namen an den Pins? Nach jeder Bewegung neu gefragt —
  // gezeichnet wird nur neu, wenn sich die Antwort ändert (ein Neuzeichnen nähme
  // dem Pin mit dem Fokus sonst den Fokus).
  const [namenSichtbar, setNamenSichtbar] = useState(false)
  // Die Vorschau (am Computer): zu welchem Pin und wo — beim Verschieben wandert sie mit.
  const [vorschauStand, setVorschauStand] = useState<{ slug: string; lage: CSSProperties } | null>(null)
  const vorschauSlug = vorschauStand?.slug ?? null
  const vorschauId = useId()
  const nachlauf = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hinweisRef = useRef<HTMLParagraphElement>(null)
  const hoefeRef = useRef(hoefe)
  const kurzkarteRef = useRef(kurzkarte)
  const vorschauSlugRef = useRef(vorschauSlug)
  // Rückrufe wechseln mit jedem Render, die Handler hängen aber an Karte und
  // Ebene — Refs (im Effekt nachgeführt), damit nichts Altes gefangen bleibt.
  const auswahlRef = useRef(onAuswahl)
  const leerTippRef = useRef(onLeerTipp)
  const polsterRef = useRef(polsterUnten)
  const ohneAuswahlRef = useRef(polsterOhneAuswahl)
  const lageRef = useRef(lage)
  useEffect(() => {
    auswahlRef.current = onAuswahl
    leerTippRef.current = onLeerTipp
    polsterRef.current = polsterUnten
    ohneAuswahlRef.current = polsterOhneAuswahl
    lageRef.current = lage
    hoefeRef.current = hoefe
    kurzkarteRef.current = kurzkarte
    vorschauSlugRef.current = vorschauSlug
  })

  /** Wo die Vorschau steht: am Punkt des Pins, darüber, wenn oben Platz ist, sonst darunter; nie über den Rand. */
  function vorschauLage(slug: string): CSSProperties | null {
    const map = karte.current
    const hof = hoefeRef.current.find((h) => h.slug === slug)
    if (!map || !hof) return null
    const punkt = map.latLngToContainerPoint([hof.lat, hof.lon])
    const links = Math.max(8, Math.min(punkt.x - KURZKARTE_HALB, map.getSize().x - 2 * KURZKARTE_HALB - 8))
    // Darüber, wenn oben Platz für die ganze Vorschau ist — oder wenigstens mehr als darunter.
    const oben = punkt.y > VORSCHAU_PLATZ_OBEN || punkt.y > map.getSize().y - punkt.y
    return oben
      ? { left: links, top: punkt.y - VORSCHAU_ABSTAND, transform: 'translateY(-100%)' }
      : { left: links, top: punkt.y + VORSCHAU_ABSTAND }
  }

  /** Vorschau öffnen (Zeiger oder Fokus am Pin) — ein laufender Nachlauf zählt nicht mehr. */
  function vorschauOeffnen(slug: string) {
    if (!kurzkarteRef.current) return
    if (nachlauf.current) clearTimeout(nachlauf.current)
    nachlauf.current = null
    const lage = vorschauLage(slug)
    setVorschauStand(lage ? { slug, lage } : null)
  }
  /** Zeiger oder Fokus haben Pin bzw. Vorschau verlassen: nach 300 ms zu, außer sie kommen zurück. */
  function vorschauSpaeterZu() {
    if (nachlauf.current) clearTimeout(nachlauf.current)
    nachlauf.current = setTimeout(() => {
      nachlauf.current = null
      setVorschauStand(null)
    }, VORSCHAU_NACHLAUF_MS)
  }
  function vorschauZu() {
    if (nachlauf.current) clearTimeout(nachlauf.current)
    nachlauf.current = null
    setVorschauStand(null)
  }

  // Escape schließt die Vorschau, auch wenn der Zeiger sie geöffnet hat und der Fokus woanders steht.
  useEffect(() => {
    if (!vorschauSlug) return
    const beiTaste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') vorschauZu()
    }
    document.addEventListener('keydown', beiTaste)
    return () => document.removeEventListener('keydown', beiTaste)
  }, [vorschauSlug])

  // Kein Geister-Timer nach dem Abbau.
  useEffect(
    () => () => {
      if (nachlauf.current) clearTimeout(nachlauf.current)
    },
    []
  )

  useEffect(() => {
    if (!kartenDiv.current || karte.current) return
    const map = L.map(kartenDiv.current, {
      center: OESTERREICH_MITTE,
      zoom: OESTERREICH_ZOOM,
      zoomControl: true,
      attributionControl: false,
      // Den Größenwechsel misst useKartenGroesse (ResizeObserver) — nicht
      // zusätzlich Leaflet beim window-resize.
      trackResize: false,
    })
    // Ohne Leaflets Präfix (Flagge, „Leaflet"): „© OpenStreetMap-Mitwirkende"
    // mit Link bleibt sichtbar, ist aber kurz genug für eine Zeile am Handy.
    attribution.current = L.control
      .attribution({ position: attributionOben ? 'topright' : 'bottomright' })
      .setPrefix(false)
      .addTo(map)
    L.tileLayer(KARTEN_KACHELN.url, {
      maxZoom: KARTEN_KACHELN.maxZoom,
      attribution: KARTEN_KACHELN.attribution,
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
    // Jede Bewegung, die nicht aus merker.still() kommt, ist eine der Nutzerin:
    // Ziehen, Zoomen, ein angefahrener Hof, ein aufgezoomter Gruppen-Pin.
    map.on('movestart zoomstart', () => merker.bewegungBeginnt())
    map.on('zoomend', () => setZoomEnden((n) => n + 1))
    map.on('moveend', () => setNamenSichtbar(zeigePinNamen(map.getZoom(), pinsImBild(map, hoefeRef.current))))
    // Beim Zoomen zeichnet die Karte die Pins neu — die Vorschau stünde dann neben einem alten Punkt.
    map.on('zoomstart', () => setVorschauStand(null))
    map.on('move', () => {
      const slug = vorschauSlugRef.current
      if (!slug) return
      const lage = vorschauLage(slug)
      setVorschauStand(lage ? { slug, lage } : null)
    })
    zentrumEbene.current = L.layerGroup().addTo(map)
    pinEbene.current = L.layerGroup().addTo(map)
    karte.current = map
    return () => {
      verwerfeLeerTipp()
      map.remove()
      karte.current = null
      pinEbene.current = null
      zentrumEbene.current = null
      attribution.current = null
    }
    // Bewusst nur beim Einhängen; attributionOben wechselt nie zur Laufzeit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Wie hoch das Band gerade über der Karte liegt — nie mehr als die Karte minus ein Pin. */
  function bandHoehe(map: L.Map): number {
    return Math.max(0, Math.min(polsterRef.current, map.getSize().y - 48))
  }

  /**
   * Die Kartenmitte, mit der `punkt` sichtbar über dem Karussell (Handy) bzw.
   * der Karte unter dem Pin (Umfeld) landet: Beide liegen unten über der
   * Karte, solange ein Hof gewählt ist — die Mitte rückt dann um die halbe
   * Höhe des Bandes nach unten. Ohne Auswahl oder ohne Band die Mitte selbst.
   */
  function mitteUeberDemBand(map: L.Map, punkt: [number, number], zoom: number, gewaehlt: boolean): L.LatLng {
    const band = gewaehlt ? bandHoehe(map) : 0
    if (band === 0) return L.latLng(punkt)
    return map.unproject(map.project(punkt, zoom).add([0, band / 2]), zoom)
  }

  /** Ein angetippter Pin bleibt sichtbar: Läge er unter dem Band, das mit der
   *  Auswahl hereinfährt, rückt die Karte ihn in die Mitte darüber. */
  function pinUeberDasBand(lat: number, lon: number) {
    const map = karte.current
    if (!map) return
    const band = bandHoehe(map)
    if (band === 0) return
    const hoehe = map.getSize().y
    const y = map.latLngToContainerPoint([lat, lon]).y
    if (y <= hoehe - band - 24) return
    map.panBy([0, y - (hoehe - band) / 2], { animate: sanft && !wuenschtRuhe() })
  }

  /** Gruppen-Pin angetippt: hineinzoomen, bis die Gruppe zerfällt. Ein Tipp der
   *  Nutzerin — er zählt als ihre Bewegung, die Übersicht passt sich danach
   *  nicht mehr von selbst ein. */
  function gruppeAufzoomen(mitglieder: PinPunkt[], lat: number, lon: number, gewaehlt: boolean) {
    const map = karte.current
    if (!map) return
    const ziel = zoomZumAufloesen(mitglieder, map.getZoom())
    const mitte = mitteUeberDemBand(map, [lat, lon], ziel, gewaehlt)
    if (sanft && !wuenschtRuhe()) map.flyTo(mitte, ziel, { duration: 0.6 })
    else map.setView(mitte, ziel, { animate: false })
  }

  // Die Ansicht hängt NUR an der Pin-MENGE, nicht an der Nummerierung: Eine
  // Umkreissuche sortiert die Liste um und vergibt damit alle Nummern neu,
  // ohne dass ein Pin verschwindet — würde die Ansicht daran hängen, risse
  // sie der Nutzerin ihren Kartenausschnitt weg. Steht VOR den Pins: So
  // gruppieren sie gleich für die eingepasste Zoomstufe, nicht erst einen
  // Bildaufbau später (sonst blitzte kurz eine Gruppe „21 Höfe" auf).
  const mengenSignatur = [...hoefe.map((h) => h.slug)].sort().join(',')
  useEffect(() => {
    // Mit Zentrum bestimmt der Kreis den Ausschnitt (Effekt unten) — ein
    // Bereichswechsel soll ihn nicht wegreißen.
    if (zentrum) return
    zeigeUebersicht()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mengenSignatur])

  // Zentrum: eigener Pin und Kreis, der Ausschnitt ist der ganze Umkreis —
  // wie die Übersicht oben vor den Pins, damit sie gleich richtig gruppieren.
  useEffect(() => {
    const ebene = zentrumEbene.current
    if (!karte.current || !ebene) return
    ebene.clearLayers()
    if (!zentrum) return
    const mitte = L.latLng(zentrum.lat, zentrum.lon)
    L.circle(mitte, {
      radius: zentrum.radiusKm * 1000,
      color: UMKREIS_KREIS.rand,
      weight: 2,
      dashArray: '6 6',
      fillColor: UMKREIS_KREIS.flaeche,
      fillOpacity: UMKREIS_KREIS.flaechenDeckung,
      interactive: false,
    }).addTo(ebene)
    L.marker(mitte, {
      icon: eigenerPinIcon(zentrum.titel),
      keyboard: false,
      interactive: false,
      zIndexOffset: 1000,
    }).addTo(ebene)
    zeigeUebersicht()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zentrum?.lat, zentrum?.lon, zentrum?.radiusKm, zentrum?.titel])

  // Pins neu setzen, wenn Filter, Auswahl, Zeiger-Hervorhebung oder Zoomstufe
  // (zoomEnden) wechseln. Die Signatur trägt Slug UND Nummer: Fällt per Filter
  // ein koordinatenloser Hof VOR den Pins weg, ändern sich nur die Nummern —
  // auch dann müssen die Pins neu gezeichnet werden, sonst zählt die Karte
  // anders als die Liste.
  const pinSignatur = hoefe.map((h) => `${h.slug}:${h.nummer}:${h.name ?? ''}`).join(',')
  useEffect(() => {
    const map = karte.current
    const ebene = pinEbene.current
    if (!map || !ebene) return
    // Hatte ein Pin den Fokus (Tab, dann Enter), bekommt ihn sein neues Bild zurück —
    // sonst fiele er nach jeder Auswahl an den Anfang der Seite.
    const aktiv = document.activeElement
    const fokusPin = aktiv instanceof HTMLElement && ebene.getLayers().some((l) => l instanceof L.Marker && l.getElement() === aktiv) ? aktiv.dataset.pin : undefined
    ebene.clearLayers()
    const mitNamen = zeigePinNamen(map.getZoom(), pinsImBild(map, hoefe))
    const punkte = mitNamen ? hoefe : hoefe.map((h) => ({ slug: h.slug, nummer: h.nummer, lat: h.lat, lon: h.lon }))
    for (const marke of gruppierePins(punkte, map.getZoom())) {
      if (marke.art === 'pin') {
        const { pin } = marke
        const marker = L.marker([marke.lat, marke.lon], {
          icon: pinIcon(pin.nummer, pinZustand(pin.slug, lage), pin.name),
          keyboard: true,
        })
          .on('click', () => {
            auswahlRef.current(pin.slug)
            pinUeberDasBand(marke.lat, marke.lon)
          })
          .addTo(ebene)
        const element = marker.getElement()
        if (!element) continue
        element.dataset.pin = pin.slug
        element.setAttribute('aria-label', pinBeschriftung({ nummer: pin.nummer, name: hoefe.find((h) => h.slug === pin.slug)?.name }))
        // Enter und Leertaste wirken wie ein Klick (Leaflet macht aus dem Fokus nur einen Knopf).
        element.addEventListener('keydown', (e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return
          e.preventDefault()
          auswahlRef.current(pin.slug)
          pinUeberDasBand(marke.lat, marke.lon)
        })
        element.addEventListener('mouseenter', () => vorschauOeffnen(pin.slug))
        element.addEventListener('mouseleave', vorschauSpaeterZu)
        element.addEventListener('focus', () => vorschauOeffnen(pin.slug))
        element.addEventListener('blur', vorschauSpaeterZu)
        if (kurzkarteRef.current && vorschauSlugRef.current === pin.slug) element.setAttribute('aria-describedby', vorschauId)
        if (fokusPin === pin.slug) element.focus({ preventScroll: true })
      } else {
        const marker = L.marker([marke.lat, marke.lon], {
          icon: gruppenIcon(marke.mitglieder.length, gruppenZustand(marke.mitglieder, lage)),
          keyboard: true,
        })
          .on('click', () => gruppeAufzoomen(marke.mitglieder, marke.lat, marke.lon, lage.ausgewaehlt !== null))
          .addTo(ebene)
        const element = marker.getElement()
        element?.addEventListener('keydown', (e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return
          e.preventDefault()
          gruppeAufzoomen(marke.mitglieder, marke.lat, marke.lon, lage.ausgewaehlt !== null)
        })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinSignatur, lage.ausgewaehlt, lage.hervorgehoben, zoomEnden, namenSichtbar])

  // Der Pin mit offener Vorschau verweist auf sie (aria-describedby), alle anderen nicht.
  useEffect(() => {
    const ebene = pinEbene.current
    if (!ebene) return
    for (const layer of ebene.getLayers()) {
      if (!(layer instanceof L.Marker)) continue
      const element = layer.getElement()
      if (!element?.dataset.pin) continue
      if (kurzkarte && element.dataset.pin === vorschauSlug) element.setAttribute('aria-describedby', vorschauId)
      else element.removeAttribute('aria-describedby')
    }
  }, [vorschauSlug, kurzkarte, vorschauId])

  /**
   * Die Übersicht: mit Zentrum der ganze Umkreis, sonst alle Pins. Polster
   * oben bzw. unten um die Höhe der Attribution, damit kein Pin unter ihr
   * liegt; unten zusätzlich das Band, solange ein Hof gewählt ist, sonst so
   * viel, dass kein Pin unter dem Hinweis liegt (polsterOhneAuswahl). Nie mehr
   * Polster als Platz: Mindestens ein Drittel der Höhe bleibt für die Pins
   * (sonst rechnete Leaflet mit einer negativen Fläche). Läuft still — und
   * danach darf ein Größenwechsel die Übersicht wieder einpassen.
   */
  function zeigeUebersicht() {
    const map = karte.current
    if (!map) return
    const rand = zentrum ? 16 : 32
    const hoehe = map.getSize().y
    const zeile = attribution.current?.getContainer()?.offsetHeight ?? 0
    // Oben liegt der Hinweis auf Höfe ohne Kartenpunkt (samt Abstand) — kein Pin darunter.
    const hinweisHoehe = hinweisRef.current ? hinweisRef.current.offsetHeight + 8 : 0
    const oben = (attributionOben ? zeile : 0) + hinweisHoehe
    // Mit Auswahl liegt das Band über der Karte, zusätzlich zum Rand. Ohne
    // Auswahl nur der Hinweis: Ein Pin muss mit seiner halben Höhe darüber
    // stehen, der Rand zählt dabei mit — sonst schrumpfte die Fläche der Pins
    // doppelt, und im Querformat blieben nur Gruppen.
    const zusatz = lageRef.current.ausgewaehlt ? bandHoehe(map) : Math.max(0, ohneAuswahlRef.current + PIN_HALB - rand)
    const unten = Math.max(0, Math.min((attributionOben ? 0 : zeile) + zusatz, hoehe - oben - 2 * rand - hoehe / 3))
    merker.still(() => {
      if (zentrum) {
        map.fitBounds(L.latLng(zentrum.lat, zentrum.lon).toBounds(zentrum.radiusKm * 2000), {
          paddingTopLeft: [rand, rand + oben],
          paddingBottomRight: [rand, rand + unten],
          animate: false,
        })
      } else if (hoefe.length === 0) {
        map.setView(OESTERREICH_MITTE, OESTERREICH_ZOOM, { animate: false })
      } else if (hoefe.length === 1) {
        map.setView([hoefe[0].lat, hoefe[0].lon], 11, { animate: false })
      } else {
        map.fitBounds(L.latLngBounds(hoefe.map((h) => [h.lat, h.lon] as [number, number])), {
          paddingTopLeft: [rand, rand + oben],
          paddingBottomRight: [rand, rand + unten],
          maxZoom: 12,
          animate: false,
        })
      }
    })
    merker.uebersichtGezeigt()
  }

  // Der Platz des Hinweises steht erst nach dem ersten Bildaufbau fest (die
  // Seite misst ihn): Ändert er sich, passt sich die Übersicht an — solange
  // die Nutzerin nichts bewegt hat und kein Zentrum den Ausschnitt bestimmt.
  useEffect(() => {
    if (zentrum || merker.nutzerinHatBewegt) return
    zeigeUebersicht()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polsterOhneAuswahl])

  // Größenwechsel (Splitscreen, Drehen, eine Zeile darüber): Leaflet misst
  // neu; die Übersicht passt sich nur an, solange die Nutzerin nichts bewegt hat.
  useKartenGroesse(kartenDiv, karte, merker, () => {
    if (!merker.nutzerinHatBewegt) zeigeUebersicht()
  })

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
    // Mindestens 12 — und so nah, dass der Hof als eigener Pin dasteht, nicht in einer Gruppe.
    const zoom = zoomBisEinzeln(hoefe, ziel.slug, Math.max(flugZoom.current ?? map.getZoom(), 12))
    // Der angefahrene Hof ist gewählt: Sein Pin landet über seiner Karussell-Karte, nicht dahinter.
    const mitte = mitteUeberDemBand(map, [ziel.lat, ziel.lon], zoom, true)
    if (sanft && !wuenschtRuhe()) {
      flugZoom.current = zoom
      map.once('moveend', () => {
        flugZoom.current = null
      })
      map.flyTo(mitte, zoom, { duration: 0.6 })
    } else {
      map.setView(mitte, zoom, { animate: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fokus])

  // Fiel der Hof aus der Pin-Menge (Filter), gibt es auch keine Vorschau mehr.
  const vorschauHof = kurzkarte && vorschauStand ? hoefe.find((h) => h.slug === vorschauStand.slug) : undefined

  return (
    // `isolate`: Leaflets Ebenen (400) und Bedienteile (1000) bleiben in der
    // Karte — sonst lägen sie beim Scrollen über der klebenden Kopfzeile (40).
    <div className={cn('relative isolate overflow-hidden', !randlos && 'rounded-2xl border border-border', hoeheKlasse)}>
      <div ref={kartenDiv} className="h-full w-full" />
      {hinweis && (
        // Über den Pins (Ebene 600), neben dem Zoom links oben und unter der Attribution, wenn sie oben steht.
        <p
          ref={hinweisRef}
          className={cn(
            'pointer-events-none absolute right-3 left-14 z-[700] w-fit max-w-[calc(100%-4.25rem)] rounded-xl bg-card px-3 py-2 text-[12.5px] leading-snug text-foreground shadow-md',
            attributionOben ? 'top-8' : 'top-3'
          )}
        >
          {hinweis}
        </p>
      )}
      {vorschauHof && vorschauStand && kurzkarte && (
        <div
          className="absolute z-[1100]"
          style={vorschauStand.lage}
          onMouseEnter={() => vorschauOeffnen(vorschauHof.slug)}
          onMouseLeave={vorschauSpaeterZu}
        >
          {kurzkarte(vorschauHof.slug, vorschauId)}
        </div>
      )}
    </div>
  )
}
