'use client'

import { KATEGORIE_LABEL } from '@/lib/taxonomie'
import type { ProductCategoryValue } from '@/schemas/product'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { leseHoefeFilter, schreibeHoefeFilter, type HoefeFilter } from '@/schemas/hoefe-filter'
import {
  berechneHofAuswahl,
  holtAbAnTagen,
  tageDerAbholwahl,
  waehleVorschauImBereich,
  type Bezugspunkt,
  type UmkreisStufe,
} from '@/lib/hofuebersicht'
import {
  ABHOLUNG_TEXT,
  ENTDECKEN_KOPF,
  MENGEN_HINWEIS,
  abholungReihe,
  alleZuruecksetzen,
  entdeckenKopf,
  ergebnisZahl,
  futterReihe,
  hoefeHref,
  kategorieReihe,
  leerzustand,
  mengenReihe,
  naechsterAbholtag,
  produktTreffer,
  siegelReihe,
  sortenReihe,
  sortierReihe,
  tierReihe,
  zaehleFilter,
  zahlZeile,
  zeigtProdukte,
  type EntdeckenChip,
} from '@/lib/hoefe-entdecken'
import { hofseitenLink } from '@/lib/bereiche-anzeige'
import { REIHENFOLGE_HINWEIS } from '@/lib/rechtstexte/agb-einbindung'
import { LEERE_LAGE, kartenpunktHinweis, nachLeerTipp, nachPinTipp, nachZeiger, type AuswahlLage } from '@/lib/hoefe-anzeige'
import type { HofUebersichtEintrag } from '@/server/queries/farm'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { Segment } from '@/components/ui/segment'
import { KUNDE_PLATZ_HOEHE } from '@/lib/kunde-shell-masse'
import { KarteLaedt } from '@/components/karte/karte-laedt'
import HoefeKarussell from '@/components/hoefe/hoefe-karussell'
import { HoefeSuche } from '@/components/hoefe/hoefe-suche'
import { HOEFE_ADRESSE, ankunftAusAdresse, useHoefeAdresse } from '@/components/hoefe/use-hoefe-adresse'
import { BlattGruppe, EntdeckenFilterblatt } from '@/components/hoefe/entdecken-filterblatt'
import { HofKurzkarte, KurzkartenInhalt } from '@/components/hoefe/hof-kurzkarte'
import { useUhr } from '@/components/hoefe/use-uhr'
import {
  AktiveFilterZeile,
  ChipReihe,
  EntdeckenLeer,
  HofKarte,
  ProduktZeile,
  beimNavigieren,
  kurzeKategorieReihe,
} from '@/components/hoefe/entdecken-teile'

// Nur clientseitig: Leaflet greift beim Import auf window zu. Die Karte wird
// zudem erst EINGEHÄNGT, wenn sie sichtbar sein soll — wer am Handy nur die
// Liste liest, lädt keine Kacheln. Bis sie da ist, steht der Platzhalter in
// ihrer Größe (Nr. 52): Er füllt den Rahmen, den die Seite der Karte gibt —
// nichts fällt zusammen, nichts springt.
const HoefeKarte = dynamic(() => import('@/components/hoefe/hoefe-karte'), {
  ssr: false,
  loading: () => <KarteLaedt />,
})

/** Ab lg (1024 px) zeigt die Seite den Splitscreen; darunter Liste oder Karte. */
function useIstBreit(): boolean {
  return useSyncExternalStore(
    (melden) => {
      const abfrage = window.matchMedia('(min-width: 1024px)')
      abfrage.addEventListener('change', melden)
      return () => abfrage.removeEventListener('change', melden)
    },
    () => window.matchMedia('(min-width: 1024px)').matches,
    // Der Server rendert die schmale Gestalt — nach der Hydration springt der
    // Splitscreen ein; die schmale Gestalt ist kurz sichtbar, aber bedienbar.
    () => false
  )
}

/** Die Umkreis-Stufen als Segment — Seitenzustand, nie in der URL (ARCHITECTURE §4). */
const UMKREIS_OPTIONEN = [
  { wert: '10', label: '10 km' },
  { wert: '25', label: '25 km' },
  { wert: '50', label: '50 km' },
  { wert: 'alle', label: 'Alle' },
] as const

function stufeAusWert(wert: string): UmkreisStufe {
  return wert === '10' ? 10 : wert === '25' ? 25 : wert === '50' ? 50 : null
}

/**
 * Entdecken (/hoefe) im neuen Design (Nachtlauf Nr. 09, Gate 4). Mockups:
 * web-k1-entdecken-einstieg, web-k1-suche-filter, web-k1-filter-futtermittel,
 * web-k1-leerzustand, mobil-k1-entdecken, mobil-k1-filter.
 *
 * DIE URL IST DER ZUSTAND: Bereich, Kategorien, Sorten, Siegel, Tiere,
 * Menge, Sortierung, Suche und Ansicht stehen in der Adresse — teilbar und
 * reload-fest (src/schemas/hoefe-filter.ts). Die Seite ist statisch (Register
 * N19): Das Server-HTML zeigt die ganze Liste, die Filter liest der Browser
 * aus der Adresse (use-hoefe-adresse.ts) — ein geteilter Filter-Link zeigt kurz
 * die ungefilterte Liste und dann die gefilterte. Jeder Filter ist ein echter
 * Link mit rel="nofollow"; ein gewöhnlicher Klick schreibt die Adresse per
 * history.replaceState (Link-onNavigate), statt die Seite neu vom Server zu
 * holen — gefiltert wird im Browser auf demselben Datensatz. Ersetzen statt
 * anhängen: Ein Filtertipp ist kein Schritt, zu dem „Zurück" führen soll.
 *
 * NICHT in der URL: Bezugspunkt und Umkreis — sie leben nur hier im Zustand.
 *
 * Welche Chips es gibt, was passt und was die Liste zeigt, entscheiden reine
 * Funktionen (src/lib/hoefe-entdecken.ts, berechneHofAuswahl); diese Datei
 * verdrahtet nur. Im Browser ab 1024 px Liste links, Karte rechts im Rahmen
 * der Seite (oder mit „Karte" die Karte allein); darunter die Liste, „Karte"
 * öffnet den Kartenmodus. Die Filter über „Filter" im Blatt (Nr. 234).
 */
export function HoefeClient({
  hoefe,
  jetzt,
}: {
  hoefe: HofUebersichtEintrag[]
  /** Der Zeitpunkt des Servers beim Bauen der Seite (ISO-Text): Bis zur Hydration rechnet die Seite damit, danach mit der Uhr des Browsers (useUhr, Register N22). */
  jetzt: string
}): React.JSX.Element {
  const router = useRouter()
  const istBreit = useIstBreit()
  const uhr = useUhr(jetzt)
  // Auf dem Server und beim Hydrieren null: der leere Filter, wie im Server-HTML.
  const adresse = useHoefeAdresse()
  const filter = useMemo(() => leseHoefeFilter(new URLSearchParams(adresse ?? '')), [adresse])
  const { bereich, ansicht } = filter

  const schreibeUrl = useCallback((neu: HoefeFilter) => HOEFE_ADRESSE.ersetze(schreibeHoefeFilter(neu)), [])
  const setzeFilter = (aenderung: Partial<HoefeFilter>) => schreibeUrl({ ...filter, ...aenderung })

  const [lage, setLage] = useState<AuswahlLage>(LEERE_LAGE)
  // Der Suchtext, mit dem die Kundin ABGESENDET ankam (Startseite, Kopfzeile, 404 — nicht der, den diese
  // Seite beim Tippen selbst in die Adresse schrieb): Das Suchfeld löst ihn einmal wie Enter auf (Nr. 84)
  // und vergisst ihn dann; ein neu aufgebautes Feld (Liste ↔ Karte) fragt nicht noch einmal. Gelesen erst,
  // wenn die Adresse feststeht — beim Hydrieren kennt die Seite sie noch nicht (null).
  const [ankunftsText, setAnkunftsText] = useState<string | null>(null)
  const ankunft = ankunftAusAdresse(ankunftsText, adresse)
  if (ankunft !== ankunftsText) setAnkunftsText(ankunft)
  // Zählt jede Pin-Anfahrt, damit dieselbe Nummer zweimal hintereinander wirkt.
  const [fokus, setFokus] = useState(0)
  // Der Bezugspunkt der Umkreissuche lebt NUR hier: kein localStorage, kein
  // Konto, keine URL-Parameter — „Ort ändern" macht ihn spurlos fort.
  const [bezugspunkt, setBezugspunkt] = useState<Bezugspunkt | null>(null)
  const [umkreis, setUmkreis] = useState<UmkreisStufe>(null)
  // Ohne Bezugspunkt wirkt kein Umkreis — dann steht er auch in keiner Filter-Anzeige.
  const aktiverUmkreis = bezugspunkt ? umkreis : null
  const eintraege = useRef(new Map<string, HTMLLIElement>())
  // Der Stand beim Öffnen des Filter-Blatts — „Abbrechen" stellt ihn wieder her.
  const blattStand = useRef<{ filter: HoefeFilter; umkreis: UmkreisStufe } | null>(null)

  // Wie hoch das Karussell-Band am Handy WIRKLICH ist: Solange ein Hof gewählt
  // ist, landet sein Pin darüber, und die Übersicht hält Platz dafür frei
  // (HoefeKarte deckelt das Polster selbst, Nr. 52).
  const [bandHoehe, setBandHoehe] = useState(176)
  const bandMessen = useCallback((el: HTMLDivElement | null) => {
    if (!el) return
    const beobachter = new ResizeObserver(([eintrag]) => {
      setBandHoehe(Math.round(eintrag.contentRect.height))
    })
    beobachter.observe(el)
    return () => beobachter.disconnect()
  }, [])

  // Wie viel Platz der Hinweis „Tippe einen Hof an" unten braucht, samt
  // Abstand zur Kante (unter 768 px über dem Warenkorb-Knopf): Ohne Auswahl
  // hält die Übersicht ihn frei — sonst deckte er im Querformat Pins zu
  // (Nachbesserung Runde 1). Gemessen am Kasten der Karte, auch nach dem Drehen.
  // Startwert wie unter 768 px gemessen (36 + 28 px), damit die erste Übersicht schon passt.
  const [hinweisPlatz, setHinweisPlatz] = useState(64)
  const hinweisMessen = useCallback((el: HTMLParagraphElement | null) => {
    const kasten = el?.offsetParent
    if (!el || !(kasten instanceof HTMLElement)) return
    const beobachter = new ResizeObserver(() => setHinweisPlatz(Math.round(kasten.clientHeight - el.offsetTop)))
    beobachter.observe(el)
    beobachter.observe(kasten)
    return () => beobachter.disconnect()
  }, [])

  // Der Kartenmodus am Handy beginnt genau unter der klebenden Kopfzeile:
  // Wer aus der gescrollten Liste kommt oder über einem Testumgebungs-Balken
  // steht (nur Vorschau und lokal, er scrollt mit), sähe die Unterkante der
  // Karte sonst hinter der Unterleiste. In der Produktion steht er schon dort.
  const kartenmodus = useRef<HTMLDivElement>(null)
  const imKartenmodus = !istBreit && ansicht === 'karte'
  useEffect(() => {
    const element = kartenmodus.current
    if (!imKartenmodus || !element) return
    const kopfHoehe = Number.parseFloat(getComputedStyle(element).getPropertyValue('--kunde-kopf')) || 0
    const ziel = Math.max(0, element.getBoundingClientRect().top + window.scrollY - kopfHoehe)
    if (Math.abs(window.scrollY - ziel) > 1) window.scrollTo({ top: ziel, behavior: 'instant' })
  }, [imKartenmodus])

  // DIE Ableitung — Bereich/Facetten → Umkreis → Sortierung → Suche (rein,
  // getestet). Liste, Produkttreffer UND Karte lesen `gefiltert`.
  const {
    gefiltert,
    vorschlaege,
    suchbegriffe,
    sucheLeertDieListe,
    abholungLeertDieListe,
    abholBasis,
    vorschauKategorien,
  } = useMemo(() => berechneHofAuswahl(hoefe, { ...filter, bezugspunkt, umkreis, jetzt: uhr }), [hoefe, filter, bezugspunkt, umkreis, uhr])
  const produkte = useMemo(() => produktTreffer(gefiltert, filter), [gefiltert, filter])
  const alsProdukte = zeigtProdukte(filter)
  const anzahl = alsProdukte ? produkte.length : gefiltert.length
  const zahlText = ergebnisZahl(filter, anzahl)
  // „5 Höfe · 2 holen heute ab · nach Entfernung" — die Statusmeldung über der Liste (Register N22).
  const holenHeute = useMemo(() => {
    const heute = tageDerAbholwahl('heute', uhr)
    return gefiltert.filter((hof) => holtAbAnTagen(hof, heute, uhr)).length
  }, [gefiltert, uhr])
  const zahlZeilenText = zahlZeile({ filter, anzahl, holenHeute, mitBezugspunkt: bezugspunkt !== null, jetzt: uhr })
  const kopf = entdeckenKopf(filter)
  // Typografische Anführungszeichen „…“ (Liste Lauf 32, hoefe): Der Titel der Suche endet sonst mit einem geraden ".
  const titel = typografischerTitel(kopf.titel)
  // Bei einer Produktsuche steht unter „Standort nutzen“ der Satz „Produkte statt Höfe, …“ (auch im Web), die
  // Unterzeile unter der h1 entfällt dann; am Handy weichen Chip-Reihen und Reihenfolge-Satz (Board s1-hoefe Bild 2).
  const produktSuche = alsProdukte && kopf.unterzeile === ENTDECKEN_KOPF.sucheUnterzeile
  const leerGrund = leerzustand({
    sucheLeertDieListe,
    umkreis,
    filter,
    abholung: abholungLeertDieListe ? { naechster: naechsterAbholtag(abholBasis, uhr) } : null,
  })
  // „Mit 25 km sind es 2 Höfe mit Fleisch.“ (Liste Lauf 32, hoefe Bild 4): dieselbe Ableitung wie die Liste, nur mit
  // der nächsten Umkreis-Stufe — so stimmt die Zahl mit dem, was der Knopf zeigt. Ohne Treffer bleibt der allgemeine Satz.
  const naechsteStufe = leerGrund.ausweg.art === 'umkreis' ? leerGrund.ausweg.stufe : null
  const mitNaechsterStufe = useMemo(
    () => (naechsteStufe === null || alsProdukte ? 0 : berechneHofAuswahl(hoefe, { ...filter, bezugspunkt, umkreis: naechsteStufe, jetzt: uhr }).gefiltert.length),
    [hoefe, filter, bezugspunkt, naechsteStufe, alsProdukte, uhr]
  )
  const leer = naechsteStufe !== null && mitNaechsterStufe > 0 ? { ...leerGrund, satz: umkreisSatz(naechsteStufe, mitNaechsterStufe, filter.kategorien) } : leerGrund

  const reihen = useMemo(
    () => ({
      kategorien: kategorieReihe(hoefe, filter),
      futter: futterReihe(hoefe, filter),
      sorten: sortenReihe(hoefe, filter),
      mengen: mengenReihe(filter),
      siegel: siegelReihe(hoefe, filter),
      tiere: tierReihe(hoefe, filter),
      sortierung: sortierReihe(filter),
      abholung: abholungReihe(filter),
    }),
    [hoefe, filter]
  )

  // Fällt der gewählte (oder überfahrene) Hof aus der Liste, erlischt die
  // Hervorhebung mit ihm — sonst stünde sie beim Aufheben unerklärt wieder da.
  const sichtbareLage = useMemo<AuswahlLage>(() => {
    const vorhanden = new Set(gefiltert.map((h) => h.slug))
    const behalten = (slug: string | null) => (slug && vorhanden.has(slug) ? slug : null)
    return { ausgewaehlt: behalten(lage.ausgewaehlt), hervorgehoben: behalten(lage.hervorgehoben) }
  }, [gefiltert, lage])
  // Höfe ohne Kartenpunkt erscheinen nie als Pin — nur die Liste führt alle. Der Hinweis steht AUF der
  // Karte (Register N22): am Computer mit ihren Nummern, am Handy „du findest ihn in der Liste".
  const nummernOhnePunkt = gefiltert.flatMap((h, i) => (h.latitude == null || h.longitude == null ? [i + 1] : []))
  const kartenHinweis = kartenpunktHinweis(nummernOhnePunkt, istBreit)
  /** Die Pin-Menge: gefilterte Höfe MIT Koordinaten, Nummern = Listenindex. */
  const mitPunkt = useMemo(
    () =>
      gefiltert
        .map((hof, index) => ({ hof, nummer: index + 1 }))
        .filter(({ hof }) => hof.latitude != null && hof.longitude != null),
    [gefiltert]
  )
  const kartenHoefe = mitPunkt.map(({ hof, nummer }) => ({
    slug: hof.slug,
    nummer,
    lat: hof.latitude as number,
    lon: hof.longitude as number,
    // Der Name an der Pille — die Karte zeigt ihn ab Zoom 12 oder bei höchstens 12 Pins im Bild (Register N22).
    name: hof.name,
  }))

  // Standort-Marke „Du“ und gestrichelter Kreis, sobald ein Umkreis gilt (Liste Lauf 32, hoefe Bild 4) — dieselbe
  // Zeichnung wie die Umfeld-Karte der Region; der Kreis bestimmt dann den Ausschnitt.
  const kartenZentrum =
    bezugspunkt && aktiverUmkreis !== null ? { lat: bezugspunkt.lat, lon: bezugspunkt.lon, radiusKm: aktiverUmkreis, titel: 'Dein Standort' } : undefined

  /** Die Pin-Vorschau am Computer (HofKurzkarte): zwei Produktzeilen, Auswahl wie auf der Hofkarte. */
  const pinVorschau = (slug: string, id: string) => {
    const hof = gefiltert.find((h) => h.slug === slug)
    if (!hof) return null
    const auswahl = waehleVorschauImBereich(hof, bereich, vorschauKategorien, 2, suchbegriffe)
    return (
      <HofKurzkarte art="tooltip" hof={hof} bereich={bereich} id={id}>
        <KurzkartenInhalt hof={hof} schaufenster={auswahl} jetzt={jetzt} />
      </HofKurzkarte>
    )
  }

  /**
   * Vorschlag übernommen → der Name steht im Feld, keine eigene Zeile „Suche: …“ darunter (Liste Lauf 32, hoefe
   * Bild 2: „Suche steht im Feld“; Abnahme Lauf 32, hoefe 9). Such-Marken aus einer älteren Adresse bleiben als
   * Einträge stehen und lassen sich entfernen; neue entstehen hier nicht mehr (Nr. 271).
   */
  function suchMarkeHinzufuegen(name: string) {
    setzeFilter({ suchtext: name })
  }

  /** Pin angetippt → Eintrag hervorheben und in den Blick rollen. */
  function pinGewaehlt(slug: string) {
    setLage((l) => nachPinTipp(l, slug))
    eintraege.current.get(slug)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  /** Eintrag gewählt bzw. Karussell zentriert → Pin hervorheben und anfahren. */
  function hofAnfahren(slug: string) {
    setLage((l) => nachPinTipp(l, slug))
    setFokus((f) => f + 1)
  }

  const merkeEintrag = (slug: string) => (el: HTMLLIElement | null) => {
    if (el) eintraege.current.set(slug, el)
    else eintraege.current.delete(slug)
  }

  const umkreisSegment = bezugspunkt && (
    <Segment
      beschriftung="Umkreis"
      optionen={UMKREIS_OPTIONEN}
      wert={umkreis === null ? 'alle' : String(umkreis)}
      onWertChange={(wert) => setUmkreis(stufeAusWert(wert))}
    />
  )

  // „Zurücksetzen" heißt ALLES: die Filter in der Adresse und der Umkreis im
  // Zustand — sonst bliebe die Liste nach dem Zurücksetzen still eingeschränkt.
  const zuruecksetzenZiel = alleZuruecksetzen(filter)
  const umkreisAufheben = () => setUmkreis(null)
  // „Ort ändern" bzw. der Eintrag „Rund um …" im Kartenmodus: Ohne Bezugspunkt wirkt auch kein Umkreis.
  const ortAufheben = () => {
    setBezugspunkt(null)
    setUmkreis(null)
  }
  const zuruecksetzenLink =
    zaehleFilter(filter, aktiverUmkreis) > 0 || filter.suchMarken.length > 0 || filter.suchtext.trim() !== '' ? (
      <Link
        href={hoefeHref(zuruecksetzenZiel)}
        onNavigate={beimNavigieren(zuruecksetzenZiel, schreibeUrl, umkreisAufheben)}
        prefetch={false}
        rel="nofollow"
        className={cn('inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-status-fertig hover:bg-muted', FOKUS_RAHMEN)}
      >
        Zurücksetzen
      </Link>
    ) : null

  const futterHinweis = bereich === 'FUTTERMITTEL' && (
    <p className="text-[13px] text-muted-foreground">
      Bei Futtermitteln zeigen wir Angebote statt Höfe. {MENGEN_HINWEIS}
    </p>
  )

  /** Die Ergebnisse: Produkte (Suche, Futter) oder Höfe; leer mit Ausweg. */
  const ergebnisse = (split: boolean) => {
    if (anzahl === 0) {
      return <EntdeckenLeer leer={leer} onWahl={schreibeUrl} onUmkreis={setUmkreis} />
    }
    if (alsProdukte) {
      const gesehen = new Set<string>()
      return (
        <ul className="flex flex-col gap-3" aria-label="Gefundene Produkte">
          {produkte.map((treffer) => {
            // Ein Pin-Tipp rollt zum ERSTEN Produkt seines Hofs.
            const erstes = !gesehen.has(treffer.hof.slug)
            gesehen.add(treffer.hof.slug)
            return (
              <li
                key={`${treffer.hof.slug}:${treffer.produkt.id}`}
                ref={erstes ? merkeEintrag(treffer.hof.slug) : undefined}
                className="scroll-mt-24"
              >
                <ProduktZeile treffer={treffer} bereich={bereich} jetzt={jetzt} />
              </li>
            )
          })}
        </ul>
      )
    }
    return (
      <ol className="flex flex-col gap-3" aria-label="Höfe">
        {gefiltert.map((hof) => {
          const schaufenster = waehleVorschauImBereich(hof, bereich, vorschauKategorien, 3, suchbegriffe)
          return (
            <li
              key={hof.slug}
              ref={merkeEintrag(hof.slug)}
              onMouseEnter={() => setLage((l) => nachZeiger(l, hof.slug))}
              onMouseLeave={() => setLage((l) => nachZeiger(l, null))}
              // Tastatur-Gegenstück zum Zeiger: Fokus im Eintrag hebt denselben Pin hervor.
              onFocus={() => setLage((l) => nachZeiger(l, hof.slug))}
              onBlur={() => setLage((l) => nachZeiger(l, null))}
              // Ein Pin-Tipp rollt den Eintrag unter die klebende Kopfzeile, nicht dahinter.
              className="scroll-mt-24"
            >
              <HofKarte
                hof={hof}
                bereich={bereich}
                schaufenster={schaufenster}
                split={split}
                jetzt={jetzt}
                ausgewaehlt={sichtbareLage.ausgewaehlt === hof.slug}
                onAuswaehlen={() => hofAnfahren(hof.slug)}
                onFotoTipp={() => router.push(hofseitenLink(hof.slug, bereich))}
                fliess
              />
            </li>
          )
        })}
      </ol>
    )
  }

  // Die Hauptparameter der Reihenfolge (§ 4a Abs. 1 Z 1 FAGG, Register O4) stehen über der Liste wie
  // im Board (w1-/s1-hoefe, Nr. 234; vorher darunter) — nie über einer leeren. Der Wortlaut bleibt der
  // aus agb-einbindung.ts (das Board kürzt ihn, „Offen für Recht"). Die Zahlzeile sagt nach jedem
  // Filter neu, wie viele Höfe passen — seit Nr. 234 nur noch für Vorleser: Sichtbar zeigt das Board
  // an ihrer Stelle den Satz zur Reihenfolge.
  const reihenfolgeHinweis = (
    <>
      <p role="status" className="sr-only">
        {zahlZeilenText}
      </p>
      {/* Pflichtangabe (§ 4a FAGG): bei jeder Breite und auch bei der Produktsuche — nie ausblenden (Runde 1 Nr. 252). */}
      {anzahl > 0 && <p className="text-[13px] text-muted-foreground">{REIHENFOLGE_HINWEIS}</p>}
    </>
  )

  /** Das Filter-Blatt; kompakt im Kartenmodus am Handy (ein runder Knopf, Zahl als Zähler). */
  const filterblatt = (kompakt: boolean) => (
    <EntdeckenFilterblatt
      kompakt={kompakt}
      anzahlFilter={zaehleFilter(filter, aktiverUmkreis)}
      anzeigenText={`${zahlText} anzeigen`}
      zuruecksetzen={zuruecksetzenLink}
      onOeffnen={() => {
        blattStand.current = { filter, umkreis }
      }}
      onAbbrechen={() => {
        const stand = blattStand.current
        if (!stand) return
        schreibeUrl(stand.filter)
        setUmkreis(stand.umkreis)
      }}
    >
      {umkreisSegment && <BlattGruppe titel="Umkreis">{umkreisSegment}</BlattGruppe>}
      <BlattGruppe titel={ABHOLUNG_TEXT.frage}>
        <p className="text-[12.5px] text-muted-foreground">{ABHOLUNG_TEXT.erklaerung}</p>
        <ChipReihe beschriftung={ABHOLUNG_TEXT.beschriftung} chips={reihen.abholung} onWahl={schreibeUrl} umbrechen />
      </BlattGruppe>
      <BlattGruppe titel="Was suchst du?">
        <ChipReihe beschriftung="Kategorie" chips={reihen.kategorien} onWahl={schreibeUrl} umbrechen />
      </BlattGruppe>
      {reihen.futter.length > 0 && (
        <BlattGruppe titel="Futtersorte">
          <ChipReihe beschriftung="Futtersorte" chips={reihen.futter} onWahl={schreibeUrl} umbrechen />
        </BlattGruppe>
      )}
      {reihen.sorten.length > 0 && (
        <BlattGruppe titel="Sorte">
          <ChipReihe beschriftung="Sorte" chips={reihen.sorten} onWahl={schreibeUrl} umbrechen />
        </BlattGruppe>
      )}
      {reihen.mengen.length > 0 && (
        <BlattGruppe titel="Menge (nur bei Futtermitteln)">
          <ChipReihe beschriftung="Menge" chips={reihen.mengen} onWahl={schreibeUrl} umbrechen />
          <p className="text-[12.5px] text-muted-foreground">{MENGEN_HINWEIS}</p>
        </BlattGruppe>
      )}
      {reihen.tiere.length > 0 && (
        <BlattGruppe titel="Für Tiere">
          <ChipReihe beschriftung="Für Tiere" chips={reihen.tiere} onWahl={schreibeUrl} umbrechen />
        </BlattGruppe>
      )}
      {reihen.siegel.length > 0 && (
        <BlattGruppe titel="Siegel">
          <ChipReihe beschriftung="Siegel" chips={reihen.siegel} onWahl={schreibeUrl} umbrechen />
        </BlattGruppe>
      )}
      {reihen.sortierung.length > 0 && (
        <BlattGruppe titel="Reihenfolge">
          <ChipReihe beschriftung="Sortierung" chips={reihen.sortierung} onWahl={schreibeUrl} umbrechen />
        </BlattGruppe>
      )}
    </EntdeckenFilterblatt>
  )

  /** EIN Feld „Ort oder Produkt" plus „Standort nutzen" (Nr. 46, freigabe.md §12) —
   *  vorher Produktsuche und darunter eine Karte mit eigenem Postleitzahl-Feld.
   *  Kompakt im Kartenmodus am Handy: nur das Feld (Nr. 52). */
  const suchfeld = (kompakt: boolean) => (
    <HoefeSuche
      kompakt={kompakt}
      suchtext={filter.suchtext}
      vorschlaege={vorschlaege}
      bezugspunkt={bezugspunkt}
      ankunftsText={ankunftsText ?? ''}
      onSuchtext={(wert) => setzeFilter({ suchtext: wert })}
      onUebernehmen={suchMarkeHinzufuegen}
      onBezugspunkt={setBezugspunkt}
      onAufheben={ortAufheben}
      onAnkunftErledigt={() => setAnkunftsText('')}
      // Aufgelöst: Die Adresse trägt den Suchtext jetzt mit der Kennung der Seite, ein Neuladen löst nicht noch einmal auf.
      onAnkunftAufgeloest={() => schreibeUrl(leseHoefeFilter(new URLSearchParams(window.location.search)))}
    />
  )

  // Liste | Karte als Links mit aria-current wie jeder Filter in der Adresse (Board w1-hoefe): Die Ansicht steht in der URL.
  const ansichtChips: EntdeckenChip[] = [
    { schluessel: 'liste', label: 'Liste', aktiv: ansicht !== 'karte', ziel: { ...filter, ansicht: 'liste' } },
    { schluessel: 'karte', label: 'Karte', aktiv: ansicht === 'karte', ziel: { ...filter, ansicht: 'karte' } },
  ]

  /**
   * Die Filter über der Liste (Boards w1-/s1-hoefe, Nr. 234): EINE kurze Kategorie-Reihe (fünf Chips,
   * kurzeKategorieReihe), darunter die Abholung und daneben „Filter" sowie „Liste | Karte". Alles
   * Weitere — übrige Kategorien, Umkreis, Menge, Tiere, Siegel, Reihenfolge — steht im Filter-Blatt.
   * Futtersorte und Sorte erscheinen im Browser unter der Reihe, sobald es sie gibt (am Handy im Blatt).
   */
  const filterReihen = (
    <div className={cn('flex flex-col gap-2', produktSuche && 'max-md:hidden')}>
      <ChipReihe beschriftung="Kategorie" chips={kurzeKategorieReihe(reihen.kategorien)} onWahl={schreibeUrl} />
      {(reihen.futter.length > 0 || reihen.sorten.length > 0) && (
        <div className="hidden flex-col gap-2 lg:flex">
          <ChipReihe beschriftung="Futtersorte" chips={reihen.futter} onWahl={schreibeUrl} />
          <ChipReihe beschriftung="Sorte" chips={reihen.sorten} onWahl={schreibeUrl} />
        </div>
      )}
      <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-3">
        <ChipReihe beschriftung={ABHOLUNG_TEXT.beschriftung} chips={reihen.abholung} onWahl={schreibeUrl} className="min-w-0" />
        <div className="flex flex-wrap items-center gap-2">
          {filterblatt(false)}
          <ChipReihe beschriftung="Ansicht" chips={ansichtChips} onWahl={schreibeUrl} umbrechen />
        </div>
      </div>
    </div>
  )

  const kopfbereich = (
    // Inhalt 1098 px wie im Board (1440 − 2 × 171 px Rand; Abnahme Lauf 32, hoefe 8) — alle Spalten dieser Seite.
    <div className="mx-auto flex max-w-[1146px] flex-col gap-4 px-4 md:px-6 md:pt-7">
      {/* Am Handy ein Kopfstreifen mit Linie und h1 20 px (Liste Lauf 32, hoefe 390), ab 768 px wie bisher. */}
      <div className="-mx-4 flex items-start gap-3 border-b border-border bg-card px-4 py-3 md:mx-0 md:border-0 md:bg-transparent md:px-0 md:py-0">
        <div className="min-w-0 flex-1">
          {/* break-words + line-clamp: Ein Suchbegriff darf 100 Zeichen lang sein. */}
          <h1 className="line-clamp-3 font-heading text-[20px] leading-tight font-semibold break-words text-foreground md:text-[30px]">
            {titel}
          </h1>
          {/* Die Unterzeile nur am Handy — im Browser zeigt das Board keine (w1-hoefe, Bild 1); bei der Suche steht ihr Satz unter dem Feld. */}
          {!produktSuche && <p className="mt-1 text-[14px] text-muted-foreground lg:hidden">{kopf.unterzeile}</p>}
        </div>
      </div>
      {suchfeld(false)}
      {produktSuche && <p className="text-[14px] text-muted-foreground">{`${kopf.unterzeile}.`}</p>}
      {filterReihen}
      {futterHinweis}
      {/* Der getippte Suchtext steht im Feld — keine Zeile „Aktive Filter: Suche“ (Liste Lauf 32, hoefe Bild 2). */}
      <AktiveFilterZeile filter={filter} onWahl={schreibeUrl} umkreis={aktiverUmkreis} onUmkreisAufheben={umkreisAufheben} suchtextImFeld />
    </div>
  )

  if (istBreit) {
    const karte = (
      <HoefeKarte
        hoefe={kartenHoefe}
        lage={sichtbareLage}
        fokus={fokus}
        hinweis={kartenHinweis}
        zentrum={kartenZentrum}
        kurzkarte={pinVorschau}
        hoeheKlasse="h-full"
        onAuswahl={pinGewaehlt}
        onLeerTipp={() => setLage((l) => nachLeerTipp(l))}
      />
    )
    if (ansicht === 'karte') {
      // KARTE IM BROWSER (Umschalter „Karte", Nr. 234): die Karte über die Breite des Inhalts, die
      // Pin-Vorschau führt zum Hof. Leer steht die Leermeldung über ihr.
      return (
        <div>
          {kopfbereich}
          <div className="mx-auto mt-4 flex max-w-[1146px] flex-col gap-3 px-6 pb-12">
            {reihenfolgeHinweis}
            {anzahl === 0 && ergebnisse(true)}
            <div className="h-[calc(100dvh-6rem)] min-h-[420px]">{karte}</div>
          </div>
        </div>
      )
    }
    // BROWSER-SPLITSCREEN: Liste links, Karte rechts, beide im Rahmen der Seite (Board w1-hoefe:
    // die Karte endet bündig mit dem Inhalt; vorher randlos bis an den Fensterrand).
    return (
      <div data-ansicht="split">
        {kopfbereich}
        <div className="mx-auto mt-4 grid max-w-[1146px] grid-cols-[minmax(0,480px)_minmax(0,1fr)] items-start gap-4 px-6 pb-12">
          <div className="flex min-w-0 flex-col gap-3">
            {reihenfolgeHinweis}
            {ergebnisse(true)}
          </div>
          {/* Unter der Kopfzeile (64 px) plus Luft; die Höhe füllt das Fenster. */}
          <div className="sticky top-20 h-[calc(100dvh-6rem)] min-h-[420px]">{karte}</div>
        </div>
      </div>
    )
  }

  const karussellHoefe = mitPunkt.map(({ hof }) => hof)
  const auswahlMitPunkt =
    sichtbareLage.ausgewaehlt !== null && karussellHoefe.some((h) => h.slug === sichtbareLage.ausgewaehlt)

  if (ansicht === 'karte') {
    // KARTENMODUS AM HANDY (unter lg, Nr. 52; seit Nr. 271 nach Board s1-hoefe Bild 5): oben der Kopf der
    // Liste (kopfbereich), darunter die Karte über die volle Breite bis genau zur Oberkante der Unterleiste
    // (ab md bis zum Fensterrand). Die Höhe ist 100dvh ohne Kopf und Unterleiste (Maße aus der KundeShell);
    // der Kopf zieht die Karte als Flex-Zeile ab — Kopf und Karte zusammen füllen genau den Platz.
    return (
      <>
        {/* Eine Mindesthöhe erst ab md: Darunter steht die Unterleiste fest am
            Fensterrand — eine Mindesthöhe über dem Platz schöbe die Karte samt
            Karussell im Querformat (740 × 360) hinter die Leiste. */}
        {/* In niedrigen Fenstern (Handy quer, Höhe bis 500 px) bliebe neben dem Kopf keine Karte: Dort wächst der
            Bereich mit, und die Karte selbst nimmt den ganzen Platz zwischen Kopfzeile und Unterleiste (darunter). */}
        <div ref={kartenmodus} className={cn('flex flex-col md:min-h-[280px] [@media(max-height:500px)]:h-auto', KUNDE_PLATZ_HOEHE)}>
          {/* Seit Nr. 271 derselbe Kopf wie die Liste (Board s1-hoefe Bild 5; Abnahme Lauf 32, hoefe 12): sichtbare h1
              mit Unterzeile, das beschriftete Suchfeld, die Kategorie-Chips und die Reihe „Filter · Liste · Karte“,
              darunter die Karte im übrigen Platz. Vorher eine Werkzeugzeile mit kompakter Suche und „≡ Liste“. */}
          <div className="shrink-0 pb-3">{kopfbereich}</div>
          {/* `isolate`: Karussell, Hinweis und Leermeldung (z-[900]) bleiben in
              dieser Stapelebene, sonst lägen sie beim Scrollen über der
              Kopfzeile; `overflow-hidden` clippt das hinausgeglittene Karussell. */}
          <div className="relative isolate min-h-0 flex-1 overflow-hidden [@media(max-height:500px)]:h-[calc(100dvh-var(--kunde-kopf)-var(--kunde-unterleiste))] [@media(max-height:500px)]:flex-none">
            <HoefeKarte
              hoefe={kartenHoefe}
              lage={sichtbareLage}
              fokus={fokus}
              sanft
              randlos
              hoeheKlasse="h-full"
              polsterUnten={bandHoehe}
              polsterOhneAuswahl={hinweisPlatz}
              hinweis={kartenHinweis}
              zentrum={kartenZentrum}
              onAuswahl={pinGewaehlt}
              onLeerTipp={() => setLage((l) => nachLeerTipp(l))}
            />
            {/* Über der Unterleiste und frei vom erhobenen Warenkorb-Knopf (--kunde-ueberstand). */}
            {!auswahlMitPunkt && kartenHoefe.length > 0 && (
              <p
                ref={hinweisMessen}
                className="pointer-events-none absolute inset-x-0 bottom-[calc(var(--kunde-ueberstand)+2.75rem)] z-[900] mx-auto w-fit rounded-full bg-card px-4 py-2 text-sm text-foreground shadow-md md:bottom-4"
                aria-hidden="true"
              >
                Tippe einen Hof an
              </p>
            )}
            <HoefeKarussell
              hoefe={karussellHoefe}
              ausgewaehlt={auswahlMitPunkt ? sichtbareLage.ausgewaehlt : null}
              sichtbar={auswahlMitPunkt}
              bereich={bereich}
              gewaehlteKategorien={vorschauKategorien}
              suchbegriffe={suchbegriffe}
              onZentriert={hofAnfahren}
              bandRef={bandMessen}
              jetzt={jetzt}
            />
            {/* Auch die Karte braucht die Leermeldung — eine leere Karte ohne
                Wort wäre keine Rückmeldung. Sie liegt über der Karte, weil
                darunter kein Platz mehr ist. */}
            {anzahl === 0 && <div className="absolute inset-x-3 top-3 z-[900]">{ergebnisse(false)}</div>}
          </div>
        </div>
      </>
    )
  }

  return (
    <div>
      {kopfbereich}
      <div className="mx-auto mt-4 flex max-w-[1146px] flex-col gap-3 px-4 pb-10 md:px-6">
        {reihenfolgeHinweis}
        {ergebnisse(false)}
      </div>
    </div>
  )
}

/** „„Eier" in deiner Nähe“ → „„Eier“ in deiner Nähe“: das schließende Anführungszeichen typografisch (Liste Lauf 32, hoefe). */
export function typografischerTitel(titel: string): string {
  return titel.replace(/"( in deiner Nähe)$/, '“$1')
}

/** „Mit 25 km sind es 2 Höfe mit Fleisch & Wurst.“ — mit Kategorie nur, wenn genau eine gewählt ist. */
export function umkreisSatz(km: number, anzahl: number, kategorien: readonly ProductCategoryValue[]): string {
  const hoefe = anzahl === 1 ? '1 Hof' : `${anzahl} Höfe`
  const mit = kategorien.length === 1 ? ` mit ${KATEGORIE_LABEL[kategorien[0]!]}` : ''
  return `Mit ${km} km sind es ${hoefe}${mit}.`
}
