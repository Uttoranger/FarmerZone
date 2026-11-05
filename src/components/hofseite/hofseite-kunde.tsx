'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { ArrowRight, Check, ChevronLeft, ChevronRight, Clock, MapPin, Share2, Sprout } from 'lucide-react'
import type { PublicFarm } from '@/server/queries/farm'
import type { ActiveStatusPost } from '@/server/queries/status-posts'
import type { SeitenAnsicht } from '@/lib/ansichts-modus'
import { FUTTER_ABSCHNITT_ANKER, angezeigterBereich, type KaufSperre } from '@/lib/bereiche-anzeige'
import { buildMapsUrl } from '@/lib/customer-links'
import { hofInitialen } from '@/lib/hof-initialen'
import {
  AKTUELL_ANKER,
  AKTUELL_VOM_HOF_TEXT,
  adresseOhneBeitrag,
  aktiverReiter,
  alleProdukteText,
  gebuehrHinweisFuerHof,
  hofseiteReiter,
  ordneBeitraege,
  reiterAdresse,
  scrollVerhalten,
  springeZuAktuell,
  ueberUnsText,
  zahlungsarten,
  zeigeSchaufenster,
  type HofReiterId,
} from '@/lib/hofseite-kunde'
import { korbErlaubt } from '@/lib/hofseite-vorschau'
import { HOFZEILE_ZURUECK, KLEBE_BLOCK, KLEBE_BLOCK_VAR, hofZeileUnterzeile } from '@/lib/hofseite-orientierung'
import { produktLink } from '@/lib/produktdetail'
import { rueckweg, type KundenSeite } from '@/lib/kunden-kopf'
import { titelbildFoto, titelbildVerlauf } from '@/lib/mein-hof'
import { titelbildAusschnitt } from '@/lib/titelbild'
import { bildStil } from '@/lib/bild-ausschnitt'
import { anzeigeBereichVon } from '@/lib/taxonomie'
import { BEITRAG_PARAMETER, REITER_PARAMETER, leseBeitragKennung } from '@/schemas/hofseite-reiter'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { EmptyState } from '@/components/ui/empty-state'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { Marke } from '@/components/ui/marke'
import { useRueckwegKlick } from '@/components/shared/kunden-kopf'
import { teileHof } from '@/components/shared/hof-teilen'
import { ProductGrid, useBereichWunsch, type InDenKorb } from '@/components/farm/product-grid'
import { AktuellVomHof } from '@/components/hofseite/aktuell-vom-hof'
import { VorschauImRahmen } from '@/components/farm/vorschau-im-rahmen'
import { textlinkKlassen } from '@/components/ui/textlink'
import { HofseiteSeitenspalte, PFEIL_LINK, SPALTEN_KARTE, UEBERZEILE } from '@/components/hofseite/hofseite-seitenspalte'
import { KaufSperreHinweis, PAUSIERT_GERADE } from '@/components/hofseite/kauf-sperre-hinweis'
import { useBestellstopp } from '@/components/notbremse-band'
import { HofseiteFotos } from '@/components/hofseite/hofseite-fotos'
import { Titelbild } from '@/components/hofseite/titelbild'
import { Abzeichen, AbzeichenKnopf } from '@/components/ui/abzeichen'
import { TesthofHinweis } from '@/components/hofseite/testhof-hinweis'

/*
 * Die Hofseite für Kundinnen im neuen Design (Nachtlauf Nr. 10, Gate 4).
 * Mockups: web-k2-hofseite (Übersicht), web-k2-alle-produkte-nach-kategorie
 * (Reiter Produkte), mobil-k2-hofseite, mobil-k2-produkte.
 *
 * Es gibt sie genau einmal: Nur FarmPageView bindet sie ein, und zwar für die
 * Seite /[farmSlug] — Kundinnen UND die Vorschau des Hofs (?vorschau=1, dieselbe
 * Route). Was die Vorschau anders macht, kommt fertig entschieden als
 * `ansicht` (ansichtsModus): Kaufen ist dort wirkungslos (korbErlaubt). Die
 * KundeShell legt die Seite herum (page.tsx), damit auch die Vorschau die
 * echte Navigation zeigt.
 *
 * Aufbau seit Nr. 235 nach den Boards w1-/s1-hofseite: am Handy oben die klebende
 * Hofzeile (Nr. 177); ab 1024 px zwei Spalten von oben an — links Titelbild (gerundet in
 * der Spalte), Logo, Abzeichen, Name, Leitspruch, Anschrift und die Knöpfe Route · Teilen ·
 * Bestellen, der Hinweis zur Kaufsperre (Pause, keine Abholzeit, ausgebucht — kaufSperre,
 * Register N24), die Reiter Übersicht · Produkte (in der Adresse, ?reiter=, geschrieben per
 * replaceState) und der Inhalt; rechts die Spalte (EINE Komponente,
 * hofseite-seitenspalte.tsx) neben dem Titelbild. Das
 * Produktraster bleibt in jedem Reiter an derselben Stelle eingehängt — Korb
 * und Nachbestell-Link überstehen so den Wechsel. Die Karten führen zur
 * Produktseite (Nr. 11). In der Übersicht steht zuerst „Aktuell vom Hof“
 * (Register F8/N5, Nr. 128: die aktiven Beiträge, aktuell-vom-hof.tsx), danach
 * das Schaufenster (Register N5, Nr. 51): Fotos, bis zu vier Produkte, am Handy
 * „Alle Produkte (n)"; unter lg danach die Spalte und Über uns.
 *
 * Was entschieden wird (Reiter, Abschnitte, Zustände, Zahlung, Gebühr), steht
 * in src/lib/hofseite-kunde.ts und bereiche-anzeige.ts.
 */

type ReorderItem = { productId: string; productName: string; quantity: number }

/**
 * Der Hof, wie die Hofseite ihn bekommt: ohne Telefon und E-Mail (Nr. 60,
 * Mockups web/mobil-k2-hofseite-ohne-telefon). Beide kommen erst mit der
 * Bestellung — in der Kasse vor dem Kaufknopf, danach auf Bestätigung und
 * Bestellseite. page.tsx entfernt sie auf dem Server (entferneKontaktdaten).
 */
export type HofseiteHof = Omit<PublicFarm, 'phone' | 'email'>

/** Ein Umriss-Knopf ohne Fläche — Leerzustand („Andere Höfe entdecken"). */
const UMRISS_KNOPF = cn(
  'inline-flex h-11 shrink-0 items-center justify-center gap-[7px] rounded-full border border-border px-4 text-[14px] font-medium text-foreground transition-colors duration-[250ms] hover:bg-muted md:px-[18px]',
  FOKUS_RAHMEN
)
/**
 * Die drei Knöpfe unter dem Namen (Board w1-/s1-hofseite): Route · Teilen · Bestellen, alle
 * gleich — Rand im Feldrand, Fläche der Karte, Radius 12, 14 px fett. Grün ist auf der Hofseite
 * „Zur Kasse" im Mini-Warenkorb (Board), nicht „Bestellen".
 */
const KOPF_KNOPF = cn(
  'inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-input bg-card px-3.5 text-[14px] font-bold text-foreground transition-colors duration-[250ms] hover:bg-muted',
  FOKUS_RAHMEN
)
/**
 * Der Zustand klein in der Hofzeile, wie das Board ihn schreibt: „Braunau am Inn · nimmt Bestellungen an",
 * bei Pause „· pausiert gerade" (das Wort der Pause-Karte). Nur die Darstellung des Satzes aus `hofZeileUnterzeile`
 * (src/lib/hofseite-orientierung.ts): nach dem Ort klein weiter; ohne Ort bleibt der Anfang groß.
 */
function hofzeileKlein(ort: string, sperre: KaufSperre, bestellstopp: boolean): string {
  const zeile = hofZeileUnterzeile(ort, sperre, bestellstopp)
  const trenner = zeile.indexOf(' · ')
  // Die Pause geht der Notbremse vor (hofZeileZustand) — dann das Wort der Pause-Karte, auch ohne Ort
  // (dann steht es am Anfang und beginnt groß).
  if (sperre === 'pause') {
    return trenner < 0 ? `${PAUSIERT_GERADE.charAt(0).toLocaleUpperCase('de')}${PAUSIERT_GERADE.slice(1)}` : `${zeile.slice(0, trenner + 3)}${PAUSIERT_GERADE}`
  }
  if (trenner < 0) return zeile
  const zustand = zeile.slice(trenner + 3)
  // Klein weiter nur, wo der Zustand mit Verb oder Adverb beginnt („nimmt …", „noch nicht …", „gerade …"); „Bestellen
  // geht gerade nicht" (Notbremse) und „Bestellen ist … nicht möglich" (gesperrt) beginnen mit einem Hauptwort.
  const klein = sperre === 'keine-abholzeit' || sperre === 'ausgebucht' || (sperre === null && !bestellstopp)
  return klein ? `${zeile.slice(0, trenner + 3)}${zustand.charAt(0).toLocaleLowerCase('de')}${zustand.slice(1)}` : zeile
}

/** „Alle Produkte (n)" unter dem Schaufenster am Handy — über die volle Breite, darum Radius 14 statt Pille (DESIGN_SYSTEM). */
const ALLE_PRODUKTE_KNOPF = cn(
  'flex min-h-11 w-full items-center justify-center gap-1.5 rounded-[14px] border border-input bg-card px-4 text-[14px] font-bold text-foreground transition-colors duration-[250ms] hover:bg-muted',
  FOKUS_RAHMEN
)

export function HofseiteKunde({
  farm,
  beitraege,
  beitraegeFehler,
  reorderItems,
  ansicht,
  jetzt,
  sperre,
}: {
  farm: HofseiteHof
  /**
   * Die aktiven Beiträge, der neueste zuerst (Register F8) — page.tsx lädt die
   * fünf neuesten und hängt einen älteren aus `?beitrag=` an (ordneBeitraege).
   */
  beitraege: ActiveStatusPost[]
  /**
   * Das Laden der Beiträge ist gescheitert (page.tsx, ladeBeitraege): Die Seite
   * zeigt sich wie ohne Beiträge und sagt zu `?beitrag=` nichts — den Beitrag
   * kann es geben (Nr. 134).
   */
  beitraegeFehler: boolean
  reorderItems?: ReorderItem[]
  ansicht: Pick<SeitenAnsicht, 'art' | 'kaufen'>
  /**
   * Der Zeitpunkt der Anfrage als ISO-Text, einmal auf dem Server bestimmt
   * (page.tsx): Gebührensatz und „vor 2 Tagen" rechnen davon, nicht von der
   * Uhr beim Rendern — sonst wichen Server und Browser ab (Hydration).
   */
  jetzt: string
  /**
   * Die Kaufsperre (Register N24), einmal auf dem Server mit `jetzt` gerechnet
   * (kaufSperre in page.tsx). Alle Kaufwege der Seite lesen sie — Kaufknöpfe,
   * „+“ in „Aktuell vom Hof“, „Jetzt bestellen“, Mini-Warenkorb —, nie die Pause selbst.
   */
  sperre: KaufSperre
}): React.JSX.Element {
  const suche = useSearchParams()
  const pfad = usePathname()
  const bereichWunsch = useBereichWunsch()
  const produkte = useMemo(() => farm.products.filter((p) => p.isAvailable), [farm.products])
  // Notbremse (Register N34, Nr. 189): Zustand der Hofzeile, „Bestellen“ und „+“ lesen sie wie die
  // Kaufknöpfe des Produktrasters; den Grund sagt das Band unter dem Kopf. Die Sperre bleibt die des Hofs.
  const bestellstopp = useBestellstopp() !== null

  function sichtbar(key: string): boolean {
    const s = farm.sectionsConfig.find((x) => x.key === key)
    return s ? s.visible : true
  }

  // Der Rückweg führt in den Bereich, den der Hof anbietet — ein reiner
  // Futterhof zurück zur Futter-Übersicht (angezeigterBereich, ARCHITECTURE §4).
  const bereich = useMemo(() => angezeigterBereich(produkte, bereichWunsch), [produkte, bereichWunsch])
  const kundenSeite: KundenSeite = { art: 'hofseite', hofSlug: farm.slug, bereich }
  const zurueck = rueckweg(kundenSeite, false)
  const beimZurueck = useRueckwegKlick(kundenSeite, 'zeile')

  // Hat der Hof den Abschnitt Status ausgeblendet, gibt es auch „Aktuell vom Hof“ nicht.
  const gezeigteBeitraege = sichtbar('status') ? beitraege : []
  // EINE Zahl für den Reiter „Produkte · n" und „Alle Produkte (n)": alles, was der Reiter Produkte zeigt.
  const produktAnzahl = produkte.length
  const reiter = hofseiteReiter({ produktAnzahl })
  const offen = aktiverReiter({ reiter: suche.get(REITER_PARAMETER), bereich: suche.get('bereich') }, reiter)
  const schaufenster = zeigeSchaufenster(offen, produktAnzahl)

  // „Aktuell vom Hof“ (Register F8, Nr. 128): nur in der Übersicht. `?beitrag=`
  // ist eine Systemgrenze — dieselbe Prüfung wie in page.tsx, die den Beitrag lädt.
  const beitragKennung = leseBeitragKennung(suche.get(BEITRAG_PARAMETER))
  const { anordnung, nichtMehrAktuell } = ordneBeitraege(gezeigteBeitraege, beitragKennung, beitraegeFehler)
  // Bei Pause geht die Übersicht von der Pause-Karte direkt zu den Produkten (Board w1-/s1-hofseite Bild 4) —
  // ein geteilter Link auf einen Beitrag (`?beitrag=`) zeigt ihn trotzdem: Wer ihn öffnet, will genau ihn lesen.
  const mitAktuell = offen === 'uebersicht' && anordnung !== null && (sperre !== 'pause' || beitragKennung !== null)
  const mitHinweis = offen === 'uebersicht' && nichtMehrAktuell

  // Ein alter Link `?reiter=beitraege` springt einmal zu „Aktuell vom Hof“ —
  // ohne Abschnitt bleibt die Seite oben; mit reduzierter Bewegung ohne Animation.
  const zuAktuell = springeZuAktuell(suche.get(REITER_PARAMETER), mitAktuell)
  useEffect(() => {
    if (!zuAktuell) return
    const reduziert = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    document.getElementById(AKTUELL_ANKER)?.scrollIntoView({ behavior: scrollVerhalten(reduziert), block: 'start' })
  }, [zuAktuell])

  // Der Weg in den Korb der Produktkarten (ProductGrid, `inDenKorb`) — das „+“
  // in „Aktuell vom Hof“ nimmt GENAU ihn, kein zweiter Warenkorb.
  const korbWeg = useRef<InDenKorb>(null)

  // ?bereich=futter: einmal zum Futter-Abschnitt springen — nicht bei jedem
  // späteren Wechsel in den Reiter Produkte.
  const [futterSprung, setFutterSprung] = useState(
    () => bereichWunsch === 'FUTTERMITTEL' && produkte.some((p) => anzeigeBereichVon(p.category) === 'FUTTERMITTEL')
  )

  // Mit den Zahlarten des Hofs und der Bar-Ausnahme bis zum SEPA-Start (B1).
  const gebuehr = gebuehrHinweisFuerHof(farm, new Date(jetzt))
  const mitKorb = korbErlaubt({ isEditMode: false, kaufen: ansicht.kaufen })
  const kartenLink = buildMapsUrl(farm.address, farm.postalCode, farm.city)

  // Vor der Reiterleiste: Nach einem Wechsel steht der neue Reiter oben, wenn
  // die Seite schon darunter gescrollt war.
  const reiterAnker = useRef<HTMLDivElement>(null)

  // Der klebende Block (am Handy nur die Hofzeile, seit Nr. 235) — als Zustand, damit die Messung unten
  // beginnt, sobald er im Dokument steht.
  const [klebeBlock, setKlebeBlock] = useState<HTMLDivElement | null>(null)

  // Die echte Höhe des Blocks an der Wurzel: scroll-padding in globals.css
  // rechnet damit, auch wenn größere Schrift die Reiter umbricht. Die festen
  // Zahlen dort gelten nur bis zur ersten Messung.
  useEffect(() => {
    if (!klebeBlock || typeof ResizeObserver === 'undefined') return
    const wurzel = document.documentElement
    const beobachter = new ResizeObserver(() => wurzel.style.setProperty(KLEBE_BLOCK_VAR, `${klebeBlock.offsetHeight}px`))
    beobachter.observe(klebeBlock)
    return () => {
      beobachter.disconnect()
      wurzel.style.removeProperty(KLEBE_BLOCK_VAR)
    }
  }, [klebeBlock])

  function zeigeReiter(id: HofReiterId, { fokusAufReiter = false }: { fokusAufReiter?: boolean } = {}) {
    return (e: { preventDefault: () => void }) => {
      // Wie die Filter auf /hoefe: Die Adresse wird geschrieben, Next gleicht
      // useSearchParams ab — kein Server-Aufruf, kein Eintrag im Verlauf.
      // Zustand `null`, nie window.history.state: Mit Nexts eigenem Zustand
      // hält Next den Aufruf für seinen eigenen und gleicht NICHT ab — die
      // Adresse wechselte, der Reiter nicht (im Browser nachgestellt).
      e.preventDefault()
      window.history.replaceState(null, '', reiterAdresse(pfad, window.location.search, id))
      const anker = reiterAnker.current
      if (anker) {
        // Der Anker ist der Anfang der Inhaltsspalte: Er soll unter dem Kopf und der klebenden Hofzeile stehen.
        const kopf = document.querySelector('header')?.getBoundingClientRect().height ?? 0
        const ziel = anker.getBoundingClientRect().top + window.scrollY - kopf - (klebeBlock?.offsetHeight ?? 0)
        if (window.scrollY > ziel) window.scrollTo({ top: ziel })
      }
      // Ein Link im Inhalt („Alle ansehen", „Alle Produkte (n)") verschwindet
      // mit dem Wechsel — der Fokus fiele auf <body>. Er geht deshalb auf den
      // neuen Reiter (Merkmal data-reiter der Reiterleiste), ohne Scrollen:
      // Wohin die Seite gehört, hat der Anker oben entschieden.
      if (fokusAufReiter) document.querySelector<HTMLElement>(`[data-reiter="${id}"]`)?.focus({ preventScroll: true })
    }
  }

  // „Neuester: …“: dieselbe Seite ohne ?beitrag= — wie ein Reiterwechsel ohne
  // Server-Aufruf, der neueste steht dann oben. Der Link verschwindet mit dem
  // Wechsel; der Fokus geht auf die Überschrift des Abschnitts.
  function zeigeNeuesten(e: { preventDefault: () => void }) {
    e.preventDefault()
    window.history.replaceState(null, '', adresseOhneBeitrag(pfad, window.location.search))
    document.getElementById('aktuell-titel')?.focus({ preventScroll: true })
  }

  /*
   * Am Handy die Hofzeile (Nr. 177; seit Nr. 235 nach Board s1-hofseite ganz oben): Zurück
   * zu den Höfen, Hofname, Ort und Zustand und „Teilen" bleiben beim Scrollen oben — sie
   * ist das Einzige, was am Handy klebt (KLEBE_BLOCK; Reiter und Chips stehen im Fluss).
   * Weil sie von Anfang an oben steht, gibt es keinen zweiten Zurück-Knopf im Titelbild
   * mehr (Entscheidung 5 aus Nr. 195 ist damit erfüllt: Zurück ist immer zu sehen). Im
   * Reiter Produkte zeigt das Board am Handy keinen Kopf — dann ist der Name hier die h1.
   * Ab md bleibt die Zeile weg. In der Vorschau steht sie ebenso; ihre Links behandelt
   * VorschauImRahmen wie alle übrigen.
   */
  const nameAlsTitel = offen === 'produkte'
  const hofZeile = (
    <div data-hofzeile="" className="flex h-12 items-center gap-1 px-2 md:hidden print:hidden">
      <Link
        href={zurueck.href}
        onClick={beimZurueck}
        aria-label={HOFZEILE_ZURUECK}
        className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl text-foreground hover:bg-muted', FOKUS_RAHMEN)}
      >
        <ChevronLeft className="size-[22px]" strokeWidth={1.9} aria-hidden="true" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        {nameAlsTitel ? (
          <h1 className="truncate font-heading text-[17px] leading-[1.15] font-semibold text-foreground" title={farm.name}>
            {farm.name}
          </h1>
        ) : (
          <span className="truncate font-heading text-[17px] leading-[1.15] font-semibold text-foreground" title={farm.name}>
            {farm.name}
          </span>
        )}
        <span className="truncate text-[12px] text-muted-foreground">{hofzeileKlein(farm.city, sperre, bestellstopp)}</span>
      </div>
      <button
        type="button"
        onClick={() => void teileHof(farm)}
        aria-label="Hofseite teilen"
        className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl text-foreground hover:bg-muted', FOKUS_RAHMEN)}
      >
        <Share2 className="size-5" strokeWidth={1.7} aria-hidden="true" />
      </button>
    </div>
  )

  // Leer: noch keine Produkte und keine Abholzeiten — der Hof richtet sich ein.
  if (produkte.length === 0 && farm.pickupSlots.length === 0) {
    return (
      <>
        {ansicht.art === 'vorschau' && <VorschauImRahmen />}
        {/* Ohne Reiter besteht der Block nur aus der Hofzeile (ab md leer). */}
        <div ref={setKlebeBlock} data-klebe-block="" className={KLEBE_BLOCK}>
          {hofZeile}
        </div>
        <div className="mx-auto flex max-w-xl flex-col gap-5 px-4 pt-6 pb-16">
          <h1 className="font-heading text-[28px] leading-tight font-semibold break-words text-foreground">{farm.name}</h1>
          <EmptyState
            symbol={Sprout}
            titel="Dieser Hof richtet gerade seinen Shop ein"
            satz="Schau bald wieder vorbei."
            ausweg={
              <Link href="/hoefe" className={UMRISS_KNOPF}>
                Andere Höfe entdecken
              </Link>
            }
          />
        </div>
      </>
    )
  }

  const foto = titelbildFoto(farm)
  const ueberUns = sichtbar('about') ? (ueberUnsText(farm) ?? '') : ''
  const werte = sichtbar('values') ? farm.farmValues.slice(0, 6) : []
  const kannBestellen = produkte.length > 0 && sperre === null && !bestellstopp
  const zeigeUeberUns = offen === 'uebersicht' && Boolean(ueberUns || werte.length > 0 || farm.foundedYear)
  const pause = sperre === 'pause'

  /*
   * Die rechte Spalte (EINE Komponente). Ab 1024 px rechts neben allem, ab dem Titelbild
   * (Board w1-hofseite), über beide Zeilen des Rasters. Darunter nur in der Übersicht, nach
   * dem Schaufenster und vor „Über uns" (Register N5) — in den anderen Reitern ausgeblendet.
   */
  const seitenspalte = (
    <HofseiteSeitenspalte
      hof={farm}
      sperre={sperre}
      zahlungsarten={zahlungsarten(farm)}
      gebuehrHinweis={gebuehr?.produkte ?? null}
      gebuehrKorb={gebuehr?.korb ?? null}
      mitKorb={mitKorb}
      jetzt={jetzt}
      produkte={produkte}
      className={cn('lg:col-start-2 lg:row-start-1', zeigeUeberUns && 'lg:row-span-2', offen !== 'uebersicht' && 'hidden lg:flex')}
    />
  )

  // „Über uns" (Board w1-hofseite Bild 2): Überzeile, darunter eine Karte mit „Seit …", dem Text und den Werten als Häkchenliste.
  const ueberUnsTeil = zeigeUeberUns ? (
    // data-abschnitt: Ziel der Markierung aus Mein Hof für Über uns, Gründungsjahr und Werte (ZIEL_ABSCHNITT, Nr. 50).
    <section data-abschnitt="ueberuns" aria-labelledby="ueber-uns" className="flex min-w-0 flex-col gap-2 lg:col-start-1 lg:row-start-2">
      <h2 id="ueber-uns" className={cn(UEBERZEILE, 'mt-1')}>
        Über uns
      </h2>
      <div className={SPALTEN_KARTE}>
        {farm.foundedYear && (
          <span className="self-start">
            <Marke art="erledigt" form="schild">
              Seit {farm.foundedYear}
            </Marke>
          </span>
        )}
        {ueberUns && <p className="text-[15px] leading-relaxed break-words whitespace-pre-line text-foreground">{ueberUns}</p>}
        {werte.length > 0 && (
          <ul className="flex flex-col gap-1 text-[14px] text-foreground">
            {werte.map((w) => (
              <li key={w.id} className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-status-fertig" strokeWidth={2.2} aria-hidden="true" />
                <span className="min-w-0 break-words">{w.title}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  ) : null

  // Unter den Reitern, vor dem Schaufenster (Register N5, Ergänzung Nr. 128). Der Satz „nicht mehr aktuell“
  // steht über dem Abschnitt — auch, wenn es keinen aktiven Beitrag gibt.
  const aktuellTeil =
    mitAktuell || mitHinweis ? (
      <div className="flex min-w-0 flex-col gap-3">
        {mitHinweis && (
          <Hinweiskarte ton="neutral" symbol={Clock}>
            {AKTUELL_VOM_HOF_TEXT.nichtMehrAktuell}
          </Hinweiskarte>
        )}
        {anordnung && mitAktuell && (
          <AktuellVomHof
            anordnung={anordnung}
            jetzt={jetzt}
            produkte={produkte}
            mitPlus={mitKorb && sperre === null && !bestellstopp}
            onInDenKorb={(p) => korbWeg.current?.(p)}
            produktLink={(id) => produktLink(farm.slug, id, ansicht.art === 'vorschau')}
            neuesterHref={adresseOhneBeitrag(pfad, suche.toString())}
            onNeuester={zeigeNeuesten}
          />
        )}
      </div>
    ) : null

  return (
    <>
      {/* Das JSON-LD des Hofs baut seit Nr. 117 die Seite auf dem Server (src/app/(public)/[farmSlug]/page.tsx). */}
      {ansicht.art === 'vorschau' && <VorschauImRahmen />}

      {/* ── Am Handy die klebende Hofzeile (ab md leer) ── */}
      <div ref={setKlebeBlock} data-klebe-block="" className={KLEBE_BLOCK}>
        {hofZeile}
      </div>

      {/* Testhof (Register N21, Nr. 119/207): oben ein ruhiger Hinweis im neutralen Ton, nie orange — Bestellen bleibt möglich (Testbestellungen sind der Zweck). */}
      <TesthofHinweis farm={farm} className="pt-3 md:pt-4" />

      {/*
        ── Zwei Spalten ab 1024 px (Board w1-hofseite): links Titelbild, Kopf, Reiter und Inhalt,
        rechts die Spalte ab dem Titelbild. Das Raster hat zwei Zeilen: oben alles bis zum Schaufenster,
        darunter „Über uns"; die Spalte reicht über beide, ihre Überhöhe nimmt die zweite Zeile (1fr).
        Unter 1024 px eine Spalte in genau der Reihenfolge des Quelltexts (Register N5): Kopf, Reiter,
        „Aktuell vom Hof", Schaufenster, Spalte, Über uns — Tastatur und Screenreader folgen ihr, kein `order`.
      */}
      <div
        className={cn(
          'mx-auto flex max-w-[1152px] flex-col gap-3 px-4 pt-4 pb-12 md:px-6 lg:grid lg:pb-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-x-16 lg:gap-y-3',
          zeigeUeberUns && 'lg:grid-rows-[auto_1fr]'
        )}
      >
        <div ref={reiterAnker} className="flex min-w-0 flex-col gap-3 lg:col-start-1 lg:row-start-1">
          {/* ── Titelbild und Kopf — im Reiter Produkte am Handy nicht (Board s1-hofseite Bild 3) ── */}
          <div className={cn('flex flex-col gap-3', nameAlsTitel && 'max-md:hidden')}>
            {/* Hochformat ab md ganz statt beschnitten (Register N6, Nr. 72): entscheidet titelbild.tsx. */}
            <Titelbild
              foto={foto}
              verlauf={titelbildVerlauf(farm.bannerValue)}
              ausschnitt={titelbildAusschnitt(farm.bannerAusschnitt, farm.bannerFocusY)}
              hofName={farm.name}
              flach={offen === 'produkte'}
            />

            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between md:gap-4">
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex min-w-0 items-center gap-3">
                  {/* Das Hof-Zeichen ist rund (Freigabe §19 Nr. 98: „Register vor Board“ — das Board zeigt ein abgerundetes
                      Quadrat) — mit Logo und ohne (dann die Initialen auf der grünen Tönung). Der Ausschnitt des Logos (N17) gilt unverändert. */}
                  <span className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-[3px] border-card bg-zustand-laeuft-grund font-heading text-[18px] font-semibold text-zustand-laeuft">
                    {farm.logoUrl ? (
                      // Das Logo bekommt keinen Filter (Register N17).
                      <Image src={farm.logoUrl} alt={`${farm.name} – Logo`} fill sizes="56px" className="object-cover" style={bildStil(farm.logoAusschnitt, { filter: false })} />
                    ) : (
                      <span aria-hidden="true">{hofInitialen(farm.name)}</span>
                    )}
                  </span>
                  <div className="flex min-w-0 flex-col items-start gap-1">
                    {/* Abzeichen „Gründungshof“ direkt über dem Namen (Register K2, Nr. 116) — nur das Ja/Nein, nie die Nummer. */}
                    {farm.gruendungshof &&
                      (farm.abzeichenBlatt && farm.gruendungSeit ? (
                        <AbzeichenKnopf hofName={farm.name} seit={farm.gruendungSeit} blatt={farm.abzeichenBlatt} />
                      ) : (
                        <Abzeichen />
                      ))}
                    {/* Unter dem Titelbild, nie darauf: dunkle Schrift auf dem Grund in beiden Themes (Kontrast). */}
                    <h1 className={cn('line-clamp-2 font-heading text-[26px] leading-[1.1] font-semibold break-words text-foreground md:text-[30px]', nameAlsTitel && 'max-md:hidden')}>
                      {farm.name}
                    </h1>
                  </div>
                </div>
                {farm.tagline && (
                  <p className="text-[15px] break-words text-foreground" title={farm.tagline}>
                    „{farm.tagline}“
                  </p>
                )}
                <p className="text-[14px] break-words text-muted-foreground">
                  {farm.address}, {farm.postalCode} {farm.city}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 md:shrink-0 md:flex-nowrap">
                <a href={kartenLink} target="_blank" rel="noopener noreferrer" className={KOPF_KNOPF}>
                  <MapPin className="size-4" strokeWidth={1.7} aria-hidden="true" />
                  Route
                </a>
                <button type="button" onClick={() => void teileHof(farm)} className={KOPF_KNOPF}>
                  <Share2 className="size-4" strokeWidth={1.7} aria-hidden="true" />
                  Teilen
                </button>
                {kannBestellen && (
                  <Link href={reiterAdresse(pfad, suche.toString(), 'produkte')} onNavigate={zeigeReiter('produkte')} prefetch={false} className={KOPF_KNOPF}>
                    <span className="md:hidden">Bestellen</span>
                    <span className="hidden md:inline">Jetzt bestellen</span>
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Kaufsperre (Pause, keine Abholzeit, ausgebucht — Register N24): Der Hof und seine Produkte bleiben
              sichtbar und in ihrer Reihenfolge, nur die Kaufwege sind zu. Die Karte nennt den Grund; das Ziel
              der Markierung aus Mein Hof („Bestellungen“, Pause) trägt sie nur bei Pause. */}
          {sperre !== null && (
            <div data-abschnitt={pause ? 'bestellungen' : undefined}>
              <KaufSperreHinweis sperre={sperre} hofName={farm.name} pauseMessage={farm.pauseMessage} hofseite />
            </div>
          )}

          {/* ── Reiter: zwei gleich breite Hälften, der offene mit grüner Linie (Board). Bei Pause am Handy
              keine Reiter (Board s1-hofseite Bild 4): Die Übersicht zeigt das Angebot, „Alle ansehen" führt weiter. ── */}
          <nav aria-label="Bereiche der Hofseite" data-abschnitt="abschnitte" className={cn('border-b border-border', pause && !nameAlsTitel && 'max-md:hidden')}>
            <ul className="flex">
              {reiter.map((r) => (
                <li key={r.id} className="flex-1">
                  <Link
                    href={reiterAdresse(pfad, suche.toString(), r.id)}
                    onNavigate={zeigeReiter(r.id)}
                    prefetch={false}
                    data-reiter={r.id}
                    aria-current={offen === r.id ? 'page' : undefined}
                    className={cn(
                      '-mb-px flex min-h-11 w-full items-center justify-center border-b-[3px] px-2 text-[15px] whitespace-nowrap transition-colors duration-[250ms]',
                      offen === r.id
                        ? 'border-status-fertig font-bold text-foreground'
                        : 'border-transparent font-semibold text-muted-foreground hover:text-foreground',
                      FOKUS_RAHMEN,
                      'focus-visible:-outline-offset-2'
                    )}
                  >
                    {r.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {aktuellTeil}

          {offen === 'uebersicht' && sichtbar('gallery') ? (
            <HofseiteFotos fotos={farm.farmPhotos} hofName={farm.name} schaufenster={schaufenster} />
          ) : null}

          {offen === 'uebersicht' && produkte.length > 0 ? (
            <div className="-mb-1 flex min-h-11 items-center justify-between gap-3">
              <h2 className={cn(UEBERZEILE, 'mt-1')}>Produkte</h2>
              {/* Bei Pause ohne „Alle ansehen" (Board Bild 4): am Handy führt „Alle Produkte (n)" weiter, im Browser der Reiter. */}
              {!pause && (
                <Link
                  href={reiterAdresse(pfad, suche.toString(), 'produkte')}
                  onNavigate={zeigeReiter('produkte', { fokusAufReiter: true })}
                  prefetch={false}
                  className={cn(textlinkKlassen(), PFEIL_LINK)}
                >
                  Alle ansehen
                  <ArrowRight className="size-4 shrink-0" strokeWidth={2.2} aria-hidden="true" />
                </Link>
              )}
            </div>
          ) : null}

          <div id="produkte">
            <ProductGrid
              products={produkte}
              farmId={farm.id}
              farmSlug={farm.slug}
              hofName={farm.name}
              pauseMessage={farm.pauseMessage}
              initialReorderItems={reorderItems && reorderItems.length > 0 ? reorderItems : undefined}
              ownerMode={false}
              sperre={sperre}
              kaufen={ansicht.kaufen}
              teil={offen === 'uebersicht' ? 'auswahl' : offen === 'produkte' ? 'alle' : 'keins'}
              gebuehrHinweis={gebuehr?.produkte ?? null}
              gebuehrKorb={gebuehr?.korb ?? null}
              springeZu={futterSprung ? FUTTER_ABSCHNITT_ANKER : null}
              onGesprungen={() => setFutterSprung(false)}
              // Karten führen zur Produktseite (Nr. 11) — aus der Vorschau in deren Vorschau.
              produktLink={(id) => produktLink(farm.slug, id, ansicht.art === 'vorschau')}
              platzUnten={!schaufenster}
              inDenKorb={korbWeg}
            />
          </div>

          {/* Derselbe Reiterwechsel wie die Reiterleiste (reiterAdresse, zeigeReiter) — am Handy unter dem Schaufenster (Register N5). */}
          {schaufenster && (
            <Link
              href={reiterAdresse(pfad, suche.toString(), 'produkte')}
              onNavigate={zeigeReiter('produkte', { fokusAufReiter: true })}
              prefetch={false}
              className={cn(ALLE_PRODUKTE_KNOPF, 'lg:hidden')}
            >
              {alleProdukteText(produktAnzahl)}
              <ChevronRight className="size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
            </Link>
          )}

          {/* Der Satz zur Gebühr unter den Produkten (Board w1-hofseite Bild 2); im Reiter Produkte steht er am Ende der Abschnitte. */}
          {schaufenster && gebuehr && <p className="text-[13px] text-muted-foreground">{gebuehr.produkte}</p>}
        </div>

        {seitenspalte}
        {ueberUnsTeil}
      </div>
    </>
  )
}
