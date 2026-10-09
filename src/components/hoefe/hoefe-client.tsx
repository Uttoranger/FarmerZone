'use client'

import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { List, Map as MapIcon } from 'lucide-react'
import { leseHoefeFilter, schreibeHoefeFilter, type HoefeFilter } from '@/schemas/hoefe-filter'
import {
  berechneHofAuswahl,
  suchForm,
  waehleVorschauImBereich,
  type Bezugspunkt,
  type UmkreisStufe,
} from '@/lib/hofuebersicht'
import {
  MENGEN_HINWEIS,
  alleZuruecksetzen,
  entdeckenKopf,
  ergebnisZahl,
  futterReihe,
  hoefeHref,
  kategorieReihe,
  leerzustand,
  mengenReihe,
  produktTreffer,
  siegelReihe,
  sortenReihe,
  sortierReihe,
  tierReihe,
  zaehleFilter,
  zeigtProdukte,
} from '@/lib/hoefe-entdecken'
import { hofseitenLink } from '@/lib/bereiche-anzeige'
import { LEERE_LAGE, nachLeerTipp, nachPinTipp, nachZeiger, type AuswahlLage } from '@/lib/hoefe-anzeige'
import type { HofUebersichtEintrag } from '@/server/queries/farm'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { Segment } from '@/components/ui/segment'
import HoefeKarussell from '@/components/hoefe/hoefe-karussell'
import { HoefeSuche } from '@/components/hoefe/hoefe-suche'
import { BlattGruppe, EntdeckenFilterblatt } from '@/components/hoefe/entdecken-filterblatt'
import {
  AktiveFilterZeile,
  ChipReihe,
  EntdeckenLeer,
  HofKarte,
  ProduktZeile,
  beimNavigieren,
} from '@/components/hoefe/entdecken-teile'

// Nur clientseitig: Leaflet greift beim Import auf window zu. Die Karte wird
// zudem erst EINGEHÄNGT, wenn sie sichtbar sein soll — wer am Handy nur die
// Liste liest, lädt keine Kacheln.
const HoefeKarte = dynamic(() => import('@/components/hoefe/hoefe-karte'), { ssr: false })

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

/** Eine Gruppe der Filterzeile im Browser: leiser Name davor, damit „Pferde" nicht neben „Ballen & mehr" rätselt. */
function FilterGruppe({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span aria-hidden="true" className="text-[13px] text-muted-foreground">
        {titel}
      </span>
      {children}
    </div>
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
 * reload-fest (src/schemas/hoefe-filter.ts). Jeder Filter ist ein echter
 * Link; ein gewöhnlicher Klick schreibt die Adresse per
 * history.replaceState (Link-onNavigate), statt die dynamische Seite neu vom
 * Server zu holen — gefiltert wird im Browser auf demselben Datensatz.
 * Ersetzen statt anhängen: Ein Filtertipp ist kein Schritt, zu dem „Zurück"
 * führen soll.
 *
 * NICHT in der URL: Bezugspunkt und Umkreis — sie leben nur hier im Zustand.
 *
 * Welche Chips es gibt, was passt und was die Liste zeigt, entscheiden reine
 * Funktionen (src/lib/hoefe-entdecken.ts, berechneHofAuswahl); diese Datei
 * verdrahtet nur. Im Browser ab 1024 px Liste links, Karte randlos rechts;
 * darunter die Liste mit einer Karten-Vorschau und die Filter im Blatt.
 */
export function HoefeClient({ hoefe }: { hoefe: HofUebersichtEintrag[] }): React.JSX.Element {
  const router = useRouter()
  const pfad = usePathname()
  const istBreit = useIstBreit()
  const suchParameter = useSearchParams()
  const filter = useMemo(() => leseHoefeFilter(suchParameter), [suchParameter])
  const { bereich, ansicht } = filter

  const schreibeUrl = useCallback(
    (neu: HoefeFilter) => {
      const query = schreibeHoefeFilter(neu)
      window.history.replaceState(null, '', query ? `${pfad}?${query}` : pfad)
    },
    [pfad]
  )
  const setzeFilter = (aenderung: Partial<HoefeFilter>) => schreibeUrl({ ...filter, ...aenderung })

  const [lage, setLage] = useState<AuswahlLage>(LEERE_LAGE)
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

  // Wie hoch das Karussell-Band am Handy WIRKLICH ist: Die Karte hält seine
  // Pins darüber frei (fitBounds-Polster), gedeckelt auf die halbe Kartenhöhe.
  const [bandHoehe, setBandHoehe] = useState(176)
  const bandMessen = useCallback((el: HTMLDivElement | null) => {
    if (!el) return
    const beobachter = new ResizeObserver(([eintrag]) => {
      const kartenHoehe = el.parentElement?.clientHeight ?? 0
      const deckel = kartenHoehe > 0 ? Math.round(kartenHoehe / 2) : 260
      setBandHoehe(Math.min(Math.round(eintrag.contentRect.height), deckel))
    })
    beobachter.observe(el)
    return () => beobachter.disconnect()
  }, [])

  // DIE Ableitung — Bereich/Facetten → Umkreis → Sortierung → Suche (rein,
  // getestet). Liste, Produkttreffer UND Karte lesen `gefiltert`.
  const { gefiltert, vorschlaege, suchbegriffe, sucheAktiv, sucheLeertDieListe, vorschauKategorien } = useMemo(
    () => berechneHofAuswahl(hoefe, { ...filter, bezugspunkt, umkreis }),
    [hoefe, filter, bezugspunkt, umkreis]
  )
  const produkte = useMemo(() => produktTreffer(gefiltert, filter), [gefiltert, filter])
  const alsProdukte = zeigtProdukte(filter)
  const anzahl = alsProdukte ? produkte.length : gefiltert.length
  const zahlText = ergebnisZahl(filter, anzahl)
  const kopf = entdeckenKopf(filter)
  const leer = leerzustand({ sucheLeertDieListe, umkreis, filter })

  const reihen = useMemo(
    () => ({
      kategorien: kategorieReihe(hoefe, filter),
      futter: futterReihe(hoefe, filter),
      sorten: sortenReihe(hoefe, filter),
      mengen: mengenReihe(filter),
      siegel: siegelReihe(hoefe, filter),
      tiere: tierReihe(hoefe, filter),
      sortierung: sortierReihe(filter),
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
  const ohneKoordinaten = gefiltert.filter((h) => h.latitude == null || h.longitude == null).length
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
  }))

  /** Vorschlag übernommen → Such-Marke, das Feld wird frei für den nächsten Begriff. */
  function suchMarkeHinzufuegen(name: string) {
    setzeFilter({
      suchMarken: filter.suchMarken.some((m) => suchForm(m) === suchForm(name))
        ? filter.suchMarken
        : [...filter.suchMarken, name],
      suchtext: '',
    })
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

  const statusText = sucheAktiv ? (anzahl === 0 ? leer.titel + '.' : `${zahlText} gefunden.`) : ''

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
  const zuruecksetzenLink =
    zaehleFilter(filter, aktiverUmkreis) > 0 || filter.suchMarken.length > 0 || filter.suchtext.trim() !== '' ? (
      <Link
        href={hoefeHref(zuruecksetzenZiel)}
        onNavigate={beimNavigieren(zuruecksetzenZiel, schreibeUrl, umkreisAufheben)}
        prefetch={false}
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

  const koordinatenHinweis = ohneKoordinaten > 0 && (
    // Höfe ohne Koordinaten erscheinen nie als Pin — nur die Liste führt alle.
    <p className="text-[12.5px] text-muted-foreground">
      {ohneKoordinaten === 1
        ? 'Ein Hof hat noch keinen Kartenpunkt – du findest ihn in der Liste.'
        : `${ohneKoordinaten} Höfe haben noch keinen Kartenpunkt – du findest sie in der Liste.`}
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
                <ProduktZeile treffer={treffer} bereich={bereich} />
              </li>
            )
          })}
        </ul>
      )
    }
    return (
      <ol className="flex flex-col gap-3" aria-label="Höfe">
        {gefiltert.map((hof) => {
          const vorschau = waehleVorschauImBereich(hof, bereich, vorschauKategorien, 4, suchbegriffe)
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
                produktNamen={vorschau.produkte.filter((p) => p.verfuegbar).map((p) => p.name)}
                split={split}
                ausgewaehlt={sichtbareLage.ausgewaehlt === hof.slug}
                onAuswaehlen={() => hofAnfahren(hof.slug)}
                onFotoTipp={() => router.push(hofseitenLink(hof.slug, bereich))}
              />
            </li>
          )
        })}
      </ol>
    )
  }

  const filterReihenBrowser = (
    <div className="hidden flex-col gap-3 lg:flex">
      <ChipReihe beschriftung="Kategorie" chips={reihen.kategorien} onWahl={schreibeUrl} />
      <ChipReihe beschriftung="Futtersorte" chips={reihen.futter} onWahl={schreibeUrl} />
      <ChipReihe beschriftung="Sorte" chips={reihen.sorten} onWahl={schreibeUrl} />
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {umkreisSegment && <FilterGruppe titel="Umkreis">{umkreisSegment}</FilterGruppe>}
        {reihen.mengen.length > 0 && (
          <FilterGruppe titel="Menge">
            <ChipReihe beschriftung="Menge" chips={reihen.mengen} onWahl={schreibeUrl} />
          </FilterGruppe>
        )}
        {reihen.tiere.length > 0 && (
          <FilterGruppe titel="Für Tiere">
            <ChipReihe beschriftung="Für Tiere" chips={reihen.tiere} onWahl={schreibeUrl} />
          </FilterGruppe>
        )}
        {reihen.siegel.length > 0 && (
          <FilterGruppe titel="Siegel">
            <ChipReihe beschriftung="Siegel" chips={reihen.siegel} onWahl={schreibeUrl} />
          </FilterGruppe>
        )}
        <ChipReihe beschriftung="Sortierung" chips={reihen.sortierung} onWahl={schreibeUrl} />
        <span className="flex-1" />
        <span className="text-[13px] text-muted-foreground">{zahlText}</span>
      </div>
    </div>
  )

  const filterblatt = (
    <EntdeckenFilterblatt
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

  const kopfbereich = (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-4 pt-5 md:px-6 md:pt-7">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {/* break-words + line-clamp: Ein Suchbegriff darf 100 Zeichen lang sein. */}
          <h1 className="line-clamp-3 font-heading text-[26px] leading-tight font-semibold break-words text-foreground md:text-[30px]">
            {kopf.titel}
          </h1>
          <p className="mt-1 text-[14px] text-muted-foreground">{kopf.unterzeile}</p>
        </div>
        <div className="lg:hidden">{filterblatt}</div>
      </div>
      {/* EIN Feld „Ort oder Produkt" plus „Standort nutzen" (Nr. 46, freigabe.md §12) —
          vorher Produktsuche und darunter eine Karte mit eigenem Postleitzahl-Feld. */}
      <HoefeSuche
        suchtext={filter.suchtext}
        vorschlaege={vorschlaege}
        status={statusText}
        treffer={anzahl}
        bezugspunkt={bezugspunkt}
        onSuchtext={(wert) => setzeFilter({ suchtext: wert })}
        onUebernehmen={suchMarkeHinzufuegen}
        onBezugspunkt={setBezugspunkt}
        onAufheben={() => {
          setBezugspunkt(null)
          setUmkreis(null)
        }}
      />
      {filterReihenBrowser}
      {futterHinweis}
      <AktiveFilterZeile filter={filter} onWahl={schreibeUrl} umkreis={aktiverUmkreis} onUmkreisAufheben={umkreisAufheben} />
    </div>
  )

  if (istBreit) {
    // BROWSER-SPLITSCREEN: Liste links, Karte rechts dauerhaft sichtbar und
    // randlos bis an den rechten Fensterrand (Mockup). Die linke Kante folgt
    // dem Seiteninhalt (max. 1200 px, zentriert); die Anordnung ist mit dem
    // Betreiber entschieden, nicht spiegeln.
    return (
      <div>
        {kopfbereich}
        <div className="mt-5 grid grid-cols-[minmax(0,600px)_minmax(0,1fr)] items-start gap-6 pb-12 pl-[max(1.5rem,calc((100vw-1200px)/2+1.5rem))]">
          <div className="min-w-0">{ergebnisse(true)}</div>
          {/* Unter der Kopfzeile (64 px) plus Luft; die Höhe füllt das Fenster. */}
          <div className="sticky top-20 flex h-[calc(100dvh-6rem)] min-h-[420px] flex-col gap-2">
            {koordinatenHinweis}
            <div className="isolate min-h-0 flex-1 overflow-hidden rounded-l-2xl border-y border-l border-border">
              <HoefeKarte
                hoefe={kartenHoefe}
                lage={sichtbareLage}
                fokus={fokus}
                hoeheKlasse="h-full"
                onAuswahl={pinGewaehlt}
                onLeerTipp={() => setLage((l) => nachLeerTipp(l))}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  const karussellHoefe = mitPunkt.map(({ hof }) => hof)
  const auswahlMitPunkt =
    sichtbareLage.ausgewaehlt !== null && karussellHoefe.some((h) => h.slug === sichtbareLage.ausgewaehlt)
  const zurListe = { ...filter, ansicht: 'liste' as const }
  const zurKarte = { ...filter, ansicht: 'karte' as const }

  return (
    <div>
      {kopfbereich}
      <div className="mx-auto mt-4 flex max-w-[1200px] flex-col gap-3 px-4 pb-10 md:px-6">
        {ansicht === 'karte' ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] text-muted-foreground">{zahlText}</span>
              <Link
                href={hoefeHref(zurListe)}
                onNavigate={beimNavigieren(zurListe, schreibeUrl)}
                prefetch={false}
                className={cn(
                  'inline-flex h-11 items-center gap-1.5 rounded-full border border-border bg-card px-4 text-[13.5px] font-semibold text-foreground hover:bg-muted',
                  FOKUS_RAHMEN
                )}
              >
                <List className="size-4" strokeWidth={1.7} aria-hidden="true" />
                Liste zeigen
              </Link>
            </div>
            {/* Vollflächen-Karte mit Karussell am unteren Rand. `isolate`:
                Karussell und Hinweis (z-[900]) bleiben in dieser Stapelebene,
                sonst lägen sie beim Scrollen über der Kopfzeile;
                `overflow-hidden` clippt das hinausgeglittene Karussell. */}
            <div className="relative isolate overflow-hidden rounded-2xl border border-border">
              <HoefeKarte
                hoefe={kartenHoefe}
                lage={sichtbareLage}
                fokus={fokus}
                sanft
                attributionOben
                hoeheKlasse="h-[60vh] min-h-[320px]"
                polsterUnten={bandHoehe}
                onAuswahl={pinGewaehlt}
                onLeerTipp={() => setLage((l) => nachLeerTipp(l))}
              />
              {!auswahlMitPunkt && kartenHoefe.length > 0 && (
                <p
                  className="pointer-events-none absolute inset-x-0 bottom-4 z-[900] mx-auto w-fit rounded-full bg-card px-4 py-2 text-sm text-foreground shadow-md"
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
              />
            </div>
            {/* Auch die Karte braucht die Leermeldung — eine leere Karte ohne Wort wäre keine Rückmeldung. */}
            {anzahl === 0 && ergebnisse(false)}
            {koordinatenHinweis}
          </>
        ) : (
          <>
            {/* Die Karten-Vorschau (Mockup mobil-k1-entdecken): ein Bild, kein
                Kartendienst — Leaflet lädt erst, wer sie öffnet. */}
            <Link
              href={hoefeHref(zurKarte)}
              onNavigate={beimNavigieren(zurKarte, schreibeUrl)}
              prefetch={false}
              aria-label="Karte öffnen"
              className={cn('relative block h-[120px] overflow-hidden rounded-2xl border border-border bg-accent', FOKUS_RAHMEN)}
            >
              {/* Der dunkle Schleier: primary-foreground ist im neuen Design in
                  beiden Themes fast schwarz — theme-fest wie jedes Bild-Overlay
                  (DESIGN_SYSTEM.md), aber ein Token statt Tailwind-Schwarz. */}
              <span aria-hidden="true" className="absolute inset-0 bg-linear-150 from-primary-foreground/25 via-transparent via-55% to-primary/25" />
              <span aria-hidden="true" className="absolute top-[58px] -left-6 h-1.5 w-[520px] rotate-[-8deg] rounded-full bg-accent-foreground/15" />
              <span aria-hidden="true" className="absolute -top-6 left-[30%] h-[200px] w-1 rotate-[12deg] rounded-full bg-accent-foreground/12" />
              {['left-[26%] top-[30%]', 'left-[58%] top-[52%]', 'left-[78%] top-[24%]'].map((lage) => (
                <span
                  key={lage}
                  aria-hidden="true"
                  className={cn('absolute size-3.5 rounded-full border-[2.5px] border-primary-foreground bg-primary', lage)}
                />
              ))}
              <span className="absolute right-3 bottom-3 inline-flex h-9 items-center gap-1.5 rounded-full bg-card px-3.5 text-[13px] font-semibold text-foreground">
                <MapIcon className="size-4" strokeWidth={1.7} aria-hidden="true" />
                Karte öffnen
              </span>
            </Link>
            <p className="text-[13px] text-muted-foreground">{zahlText}</p>
            {ergebnisse(false)}
          </>
        )}
      </div>
    </div>
  )
}
