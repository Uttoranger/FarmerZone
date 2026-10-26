'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Check, ChevronLeft, ChevronRight, Clock, FlaskConical, MapPin, Navigation, Share2, ShoppingBasket, Sprout } from 'lucide-react'
import type { PublicFarm } from '@/server/queries/farm'
import type { ActiveStatusPost } from '@/server/queries/status-posts'
import type { SeitenAnsicht } from '@/lib/ansichts-modus'
import { FUTTER_ABSCHNITT_ANKER, angezeigterBereich, kategorieAbschnitte, type KaufSperre } from '@/lib/bereiche-anzeige'
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
  verfuegbarText,
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
import { BEITRAG_PARAMETER, REITER_PARAMETER, beitragKennungSchema } from '@/schemas/hofseite-reiter'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { EmptyState } from '@/components/ui/empty-state'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { StatusBadge } from '@/components/ui/status-badge'
import { useRueckwegKlick } from '@/components/shared/kunden-kopf'
import { teileHof } from '@/components/shared/hof-teilen'
import { ProductGrid, useBereichWunsch, type InDenKorb } from '@/components/farm/product-grid'
import { AktuellVomHof } from '@/components/hofseite/aktuell-vom-hof'
import { VorschauImRahmen } from '@/components/farm/vorschau-im-rahmen'
import { HofseiteSeitenspalte } from '@/components/hofseite/hofseite-seitenspalte'
import { KaufSperreHinweis } from '@/components/hofseite/kauf-sperre-hinweis'
import { HofseiteFotos } from '@/components/hofseite/hofseite-fotos'
import { Titelbild } from '@/components/hofseite/titelbild'
import { Abzeichen, AbzeichenKnopf } from '@/components/ui/abzeichen'
import { TESTHOF_HINWEIS } from '@/lib/gruendungshof'

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
 * Aufbau: Rückweg (am Handy die klebende Hofzeile, Nr. 177), Titelbild mit Name und Aktionen, Hinweis zur Kaufsperre
 * (Pause, keine Abholzeit, ausgebucht — kaufSperre, Register N24), Reiter
 * Übersicht · Produkte (in der Adresse, ?reiter=, geschrieben per
 * replaceState), darunter zweispaltig ab 1024 px: der Inhalt des Reiters und
 * die rechte Spalte (EINE Komponente, hofseite-seitenspalte.tsx). Das
 * Produktraster bleibt in jedem Reiter an derselben Stelle eingehängt — Korb
 * und Nachbestell-Link überstehen so den Wechsel. Die Karten führen zur
 * Produktseite (Nr. 11). In der Übersicht steht zuerst „Aktuell vom Hof“
 * (Register F8/N5, Nr. 128: die aktiven Beiträge, aktuell-vom-hof.tsx), unter
 * lg danach das Schaufenster (Register N5, Nr. 51): Fotomosaik, bis zu vier
 * Produkte, „Alle Produkte (n)"; danach rechte Spalte und Über uns.
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

/*
 * Die Zeilen des Rasters ab lg in der linken Spalte — als ganze Klassen
 * (Tailwind liest nur ganze Wörter): „Aktuell vom Hof“, Über uns und der
 * Inhalt stehen je in einer eigenen Zeile, die rechte Spalte reicht über alle.
 */
const ZEILE_AB = ['lg:row-start-1', 'lg:row-start-2', 'lg:row-start-3'] as const
const ZEILEN_SPANNE = ['', 'lg:row-span-2', 'lg:row-span-3'] as const
const ZEILEN_RASTER = ['', 'lg:grid-rows-[auto_1fr] lg:gap-y-[26px]', 'lg:grid-rows-[auto_auto_1fr] lg:gap-y-[26px]'] as const

const KARTE = 'rounded-2xl border border-border bg-card p-[22px]'
const UMRISS_KNOPF = cn(
  'inline-flex h-11 shrink-0 items-center justify-center gap-[7px] rounded-full border border-border px-4 text-[14px] font-medium text-foreground transition-colors duration-[250ms] hover:bg-muted md:px-[18px]',
  FOKUS_RAHMEN
)
const TEXTLINK = cn(
  'inline-flex min-h-11 items-center rounded-md text-[13.5px] font-semibold text-brand-text underline-offset-4 hover:underline',
  FOKUS_RAHMEN
)
/** „Alle Produkte (n)" unter dem Schaufenster — über die volle Breite, darum Radius 14 statt Pille (DESIGN_SYSTEM). */
const ALLE_PRODUKTE_KNOPF = cn(
  'flex min-h-11 w-full items-center justify-center gap-1.5 rounded-[14px] border border-border px-4 text-[14px] font-semibold text-foreground transition-colors duration-[250ms] hover:bg-muted',
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
  const { anordnung, nichtMehrAktuell } = ordneBeitraege(
    gezeigteBeitraege,
    beitragKennungSchema.parse(suche.get(BEITRAG_PARAMETER)),
    beitraegeFehler
  )
  const mitAktuell = offen === 'uebersicht' && anordnung !== null
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

  // Der klebende Block (Hofzeile, Reiter, Chips — Nr. 177) und der Platz der
  // Chips darin: als Zustand, damit das Produktraster seine Chips per Portal
  // dorthin legt, sobald der Platz im Dokument steht.
  const [klebeBlock, setKlebeBlock] = useState<HTMLDivElement | null>(null)
  const [chipPlatz, setChipPlatz] = useState<HTMLDivElement | null>(null)
  // Im Reiter Produkte mit mehr als einer Kategorie kleben die Chips mit
  // (dieselbe Bedingung wie in ProduktAbschnitte). Ihr Platz steht schon im
  // Server-HTML in voller Höhe — das Portal kommt erst nach dem Laden, und
  // der Inhalt darunter soll dann nicht springen.
  const chipsKleben = offen === 'produkte' && kategorieAbschnitte(produkte).length > 1

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
        // Der Anker steht vor dem klebenden Block: Unter dem Kopf beginnt dann der Block.
        const kopf = document.querySelector('header')?.getBoundingClientRect().height ?? 0
        const ziel = anker.getBoundingClientRect().top + window.scrollY - kopf
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
   * Am Handy die Hofzeile (Nr. 177, Board system-sterne-hofseite-orientierung
   * Punkt 2): Zurück zu den Höfen, Hofname, Ort und Zustand und „Teilen"
   * bleiben beim Scrollen oben. Sie ist der erste Teil des EINEN klebenden
   * Blocks (KLEBE_BLOCK), darunter die Reiter und im Reiter Produkte die
   * Chips — ein `sticky` für alle drei, Freigabe 177 Punkt 2. Ab md bleibt die
   * Seite, wie sie war: die Zeile „‹ Alle Höfe" oben, die Reiter kleben allein.
   * In der Vorschau steht die Zeile ebenso; ihre Links behandelt
   * VorschauImRahmen wie alle übrigen.
   */
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
        <span className="truncate font-heading text-[17px] leading-[1.15] font-semibold text-foreground" title={farm.name}>
          {farm.name}
        </span>
        <span className="truncate text-[12px] text-muted-foreground">{hofZeileUnterzeile(farm.city, sperre)}</span>
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

  const rueckwegZeile = (
    <div className="mx-auto hidden max-w-[1200px] px-6 pt-3 md:block">
      <Link
        href={zurueck.href}
        onClick={beimZurueck}
        className={cn('inline-flex min-h-11 items-center rounded-md text-[13.5px] font-medium text-brand-text underline-offset-4 hover:underline', FOKUS_RAHMEN)}
      >
        ‹ Alle Höfe
      </Link>
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
        {rueckwegZeile}
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
  const verfuegbar = verfuegbarText(produkte, sperre)
  const kannBestellen = produkte.length > 0 && sperre === null

  const zeigeUeberUns = offen === 'uebersicht' && Boolean(ueberUns || werte.length > 0 || farm.foundedYear)
  // Ab lg mit Schaufenster ein Raster aus zwei Zeilen: Über uns oben links,
  // das Schaufenster darunter, die rechte Spalte über beide (siehe unten).
  const zweiZeilen = schaufenster && zeigeUeberUns
  // „Aktuell vom Hof“ (samt Satz „nicht mehr aktuell“) steht ab lg oben links
  // in einer eigenen Zeile darüber (Register N5, Ergänzung Nr. 128).
  const mitAktuellTeil = mitAktuell || mitHinweis
  const oben = mitAktuellTeil ? 1 : 0
  const zeilen = oben + (zweiZeilen ? 2 : 1)

  const seitenspalte = (
    <HofseiteSeitenspalte
      hof={farm}
      sperre={sperre}
      zahlungsarten={zahlungsarten(farm)}
      gebuehrKurz={gebuehr?.kurz ?? null}
      gebuehrKorb={gebuehr?.korb ?? null}
      mitKorb={mitKorb}
      jetzt={jetzt}
      produkte={produkte}
      // Am Handy nur in der Übersicht (Mockup mobil-k2-hofseite) — nach dem Schaufenster (Register N5), ohne Schaufenster vor dem Inhalt.
      className={cn('lg:col-start-2 lg:row-start-1', ZEILEN_SPANNE[zeilen - 1], offen !== 'uebersicht' && 'hidden lg:flex')}
    />
  )

  // EINE Karte Über uns — sie steht je nach Fall an genau einer Stelle (siehe unten), nie doppelt.
  const ueberUnsKarte = zeigeUeberUns ? (
    // data-abschnitt: Ziel der Markierung aus Mein Hof für Über uns, Gründungsjahr und Werte (ZIEL_ABSCHNITT, Nr. 50).
    <section data-abschnitt="ueberuns" aria-labelledby="ueber-uns" className={cn(KARTE, 'flex flex-col gap-2.5', schaufenster && cn('lg:col-start-1', ZEILE_AB[oben]))}>
      <h2 id="ueber-uns" className="font-heading text-xl font-semibold text-foreground">
        Über uns
      </h2>
      {ueberUns && (
        <p className="text-[14.5px] leading-relaxed whitespace-pre-line break-words text-muted-foreground">{ueberUns}</p>
      )}
      {(werte.length > 0 || farm.foundedYear) && (
        <ul className="mt-1 flex flex-wrap gap-2">
          {farm.foundedYear && (
            <li>
              <StatusBadge status="neutral">Seit {farm.foundedYear}</StatusBadge>
            </li>
          )}
          {werte.map((w) => (
            <li key={w.id}>
              <StatusBadge status="fertig" className="gap-1">
                <Check className="size-3 shrink-0" strokeWidth={1.9} aria-hidden="true" />
                {w.title}
              </StatusBadge>
            </li>
          ))}
        </ul>
      )}
    </section>
  ) : null

  // Unter lg nach Knöpfen und Reiter, vor dem Schaufenster; ab lg oben links.
  // Der Satz steht über dem Abschnitt — auch, wenn es keinen aktiven Beitrag gibt.
  const aktuellTeil = mitAktuellTeil ? (
    <div className="flex min-w-0 flex-col gap-3 lg:col-start-1 lg:row-start-1">
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
          mitPlus={mitKorb && sperre === null}
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

      {rueckwegZeile}

      {/* Testhof (Register N21, Nr. 119): oben ein ruhiger Hinweis im neutralen Ton, nie orange — Bestellen bleibt möglich (Testbestellungen sind der Zweck). */}
      {farm.istTesthof && (
        <div className="mx-auto max-w-[1200px] px-4 pt-1 pb-3 md:px-6 md:pt-0">
          <Hinweiskarte ton="neutral" symbol={FlaskConical}>{TESTHOF_HINWEIS}</Hinweiskarte>
        </div>
      )}

      {/* ── Titelbild, Name, Aktionen ── */}
      <div className="relative">
        {/* Hochformat ab md ganz statt beschnitten (Register N6, Nr. 72): entscheidet titelbild.tsx. */}
        {/* „Teilen" steht am Handy fest in der Hofzeile (Nr. 177), nicht mehr auf dem Titelbild. */}
        <Titelbild foto={foto} verlauf={titelbildVerlauf(farm.bannerValue)} ausschnitt={titelbildAusschnitt(farm.bannerAusschnitt, farm.bannerFocusY)} hofName={farm.name} />

        <div className="relative mx-auto max-w-[1200px] px-4 md:flex md:items-end md:gap-6 md:px-6">
          {/* Am Handy über dem unteren Rand des Titelbilds, ab 768 px darunter neben dem Hofzeichen. */}
          <div className="absolute inset-x-4 bottom-[calc(100%+1rem)] flex min-w-0 items-end gap-6 md:static md:-mt-11 md:flex-1">
            <span className="relative hidden size-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-[3px] border-background bg-accent font-heading text-[34px] font-semibold text-accent-foreground md:flex">
              {farm.logoUrl ? (
                // Das Logo bekommt keinen Filter (Register N17).
                <Image src={farm.logoUrl} alt={`${farm.name} – Logo`} fill sizes="96px" className="object-cover" style={bildStil(farm.logoAusschnitt, { filter: false })} />
              ) : (
                <span aria-hidden="true">{hofInitialen(farm.name)}</span>
              )}
            </span>
            <div className="min-w-0 md:pb-1">
              {/* Abzeichen „Gründungshof“ direkt über dem Namen (Register K2, Nr. 116) — nur das Ja/Nein, nie die Nummer. */}
              {farm.gruendungshof && (
                <div className="mb-2">
                  {farm.abzeichenBlatt && farm.gruendungSeit ? (
                    <AbzeichenKnopf hofName={farm.name} seit={farm.gruendungSeit} blatt={farm.abzeichenBlatt} />
                  ) : (
                    <Abzeichen aufBild />
                  )}
                </div>
              )}
              <h1 className="line-clamp-2 font-heading text-[28px] leading-[1.1] font-semibold break-words text-accent-foreground md:text-[38px] md:text-foreground">
                {farm.name}
              </h1>
              <p className="mt-1.5 flex items-start gap-1.5 text-[13.5px] text-accent-foreground md:text-sm md:text-muted-foreground">
                <MapPin className="mt-0.5 size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
                <span className="min-w-0 break-words">
                  {farm.address}, {farm.postalCode} {farm.city}
                </span>
              </p>
              {farm.tagline && (
                <p className="mt-1 hidden truncate font-heading text-sm text-muted-foreground italic md:block" title={farm.tagline}>
                  {farm.tagline}
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-3.5 md:shrink-0 md:gap-2.5 md:pt-0 md:pb-1.5">
            <a href={kartenLink} target="_blank" rel="noopener noreferrer" className={cn(UMRISS_KNOPF, 'flex-1 md:flex-none')}>
              <Navigation className="size-4" strokeWidth={1.7} aria-hidden="true" />
              Anfahrt
            </a>
            <button type="button" onClick={() => void teileHof(farm)} className={cn(UMRISS_KNOPF, 'hidden md:inline-flex')}>
              <Share2 className="size-4" strokeWidth={1.7} aria-hidden="true" />
              Teilen
            </button>
            {kannBestellen && (
              <Link
                href={reiterAdresse(pfad, suche.toString(), 'produkte')}
                onNavigate={zeigeReiter('produkte')}
                prefetch={false}
                className={cn(
                  'inline-flex h-11 flex-1 shrink-0 items-center justify-center gap-2 rounded-full bg-accent px-4 text-[14.5px] font-semibold text-accent-foreground transition-opacity duration-[250ms] hover:opacity-90 md:flex-none md:px-[22px]',
                  FOKUS_RAHMEN
                )}
              >
                <ShoppingBasket className="size-4" strokeWidth={1.7} aria-hidden="true" />
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
        <div data-abschnitt={sperre === 'pause' ? 'bestellungen' : undefined} className="mx-auto max-w-[1200px] px-4 pt-5 md:px-6">
          <KaufSperreHinweis sperre={sperre} hofName={farm.name} pauseMessage={farm.pauseMessage} />
        </div>
      )}

      {/* ── Der klebende Block: Hofzeile (nur am Handy), Reiter, Chips (nur am Handy, Reiter Produkte) ── */}
      <div ref={reiterAnker} />
      <div ref={setKlebeBlock} data-klebe-block="" className={cn(KLEBE_BLOCK, 'mt-5 md:mt-7')}>
        {hofZeile}
        <nav aria-label="Bereiche der Hofseite" data-abschnitt="abschnitte" className="border-b border-border">
          <ul className="mx-auto flex max-w-[1200px] gap-7 overflow-x-auto px-4 md:px-6">
            {reiter.map((r) => (
              <li key={r.id}>
                <Link
                  href={reiterAdresse(pfad, suche.toString(), r.id)}
                  onNavigate={zeigeReiter(r.id)}
                  prefetch={false}
                  data-reiter={r.id}
                  aria-current={offen === r.id ? 'page' : undefined}
                  className={cn(
                    'inline-flex min-h-12 items-center border-b-2 px-0.5 text-[15px] whitespace-nowrap transition-colors duration-[250ms]',
                    offen === r.id
                      ? 'border-foreground font-semibold text-foreground'
                      : 'border-transparent font-medium text-muted-foreground hover:text-foreground',
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
        {/* Der Platz der Chip-Reihe: ProduktAbschnitte legt sie per Portal hinein (CHIPS_PX hoch, wächst mit). */}
        {chipsKleben && <div ref={setChipPlatz} data-chips-kleben="" className="min-h-[45px] md:hidden print:hidden" />}
      </div>

      {/* ── Inhalt und rechte Spalte ──
          In der Übersicht zuerst „Aktuell vom Hof“ (Register F8/N5, Nr. 128),
          unter lg danach das Schaufenster (Register N5): Fotomosaik, bis zu
          vier Produkte, „Alle Produkte (n)"; danach die rechte Spalte und Über
          uns. Der Quelltext hat unter lg genau diese Reihenfolge — Tastatur und
          Screenreader folgen ihr, kein `order`. Ab lg stellt das Raster die
          Teile an ihren Ort: „Aktuell vom Hof“ oben links (eigene Zeile), Über
          uns darunter, dann das Schaufenster (Abstand 26 px wie bisher), die
          rechte Spalte über alle Zeilen. Ohne Schaufenster (andere Reiter,
          keine Produkte) steht die Spalte im Quelltext vor dem Inhalt, Über uns
          oben in der Inhaltsspalte. Jeder Teil steht an genau EINER Stelle. */}
      <div
        className={cn(
          'mx-auto flex max-w-[1200px] flex-col gap-[26px] px-4 pt-6 pb-12 md:px-6 md:pt-7 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10 xl:grid-cols-[minmax(0,1fr)_360px]',
          ZEILEN_RASTER[zeilen - 1]
        )}
      >
        {aktuellTeil}

        {!schaufenster && seitenspalte}

        <div className={cn('flex min-w-0 flex-col gap-[26px] lg:col-start-1', ZEILE_AB[zeilen - 1])}>
          {!schaufenster && ueberUnsKarte}

          {offen === 'uebersicht' && sichtbar('gallery') ? (
            <HofseiteFotos fotos={farm.farmPhotos} hofName={farm.name} schaufenster={schaufenster} />
          ) : null}

          {offen === 'uebersicht' ? (
            <div className="-mb-3.5 flex flex-wrap items-baseline gap-x-2.5">
              <h2 className="font-heading text-xl font-semibold text-foreground">Produkte</h2>
              {verfuegbar && <p className="text-[13px] text-muted-foreground">{verfuegbar}</p>}
              <span className="flex-1" />
              {produkte.length > 0 && (
                <Link
                  href={reiterAdresse(pfad, suche.toString(), 'produkte')}
                  onNavigate={zeigeReiter('produkte', { fokusAufReiter: true })}
                  prefetch={false}
                  // Unter lg steht „Alle Produkte (n)" unter dem Schaufenster.
                  className={cn(TEXTLINK, 'max-lg:hidden')}
                >
                  Alle ansehen <span aria-hidden="true">&nbsp;→</span>
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
              chipBlock={chipsKleben ? { platz: chipPlatz } : undefined}
            />
          </div>

          {/* Derselbe Reiterwechsel wie die Reiterleiste (reiterAdresse, zeigeReiter). */}
          {schaufenster && (
            <Link
              href={reiterAdresse(pfad, suche.toString(), 'produkte')}
              onNavigate={zeigeReiter('produkte', { fokusAufReiter: true })}
              prefetch={false}
              className={cn(ALLE_PRODUKTE_KNOPF, '-mt-3.5 lg:hidden')}
            >
              {alleProdukteText(produktAnzahl)}
              <ChevronRight className="size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
            </Link>
          )}
        </div>

        {schaufenster && seitenspalte}
        {schaufenster && ueberUnsKarte}
      </div>
    </>
  )
}
