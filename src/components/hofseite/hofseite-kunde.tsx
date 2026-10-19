'use client'

import { useMemo, useRef, useState, type ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  CalendarDays,
  Check,
  ChevronRight,
  Leaf,
  MapPin,
  MessageCircle,
  Navigation,
  PauseCircle,
  Share2,
  ShoppingBasket,
  Sprout,
  Tag,
  type LucideIcon,
} from 'lucide-react'
import type { PublicFarm } from '@/server/queries/farm'
import type { ActiveStatusPost } from '@/server/queries/status-posts'
import type { SeitenAnsicht } from '@/lib/ansichts-modus'
import { FUTTER_ABSCHNITT_ANKER, angezeigterBereich } from '@/lib/bereiche-anzeige'
import { buildMapsUrl } from '@/lib/customer-links'
import { hofInitialen } from '@/lib/hof-initialen'
import {
  aktiverReiter,
  alleProdukteText,
  beitragZeitText,
  gebuehrHinweisFuerHof,
  hofseiteReiter,
  reiterAdresse,
  ueberUnsText,
  verfuegbarText,
  zahlungsarten,
  zeigeSchaufenster,
  type HofReiterId,
} from '@/lib/hofseite-kunde'
import { jsonLdSicher } from '@/lib/json-ld'
import { korbErlaubt } from '@/lib/hofseite-vorschau'
import { produktLink } from '@/lib/produktdetail'
import { rueckweg, type KundenSeite } from '@/lib/kunden-kopf'
import { titelbildFoto, titelbildVerlauf } from '@/lib/mein-hof'
import { titelbildAusschnitt } from '@/lib/titelbild'
import { bildStil } from '@/lib/bild-ausschnitt'
import { kundenPausenText } from '@/lib/shop-pause'
import { stripStatusVariables } from '@/lib/status-body'
import { anzeigeBereichVon } from '@/lib/taxonomie'
import { REITER_PARAMETER } from '@/schemas/hofseite-reiter'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { EmptyState } from '@/components/ui/empty-state'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { StatusBadge } from '@/components/ui/status-badge'
import { useRueckwegKlick } from '@/components/shared/kunden-kopf'
import { teileHof } from '@/components/shared/hof-teilen'
import { ProductGrid, useBereichWunsch } from '@/components/farm/product-grid'
import { VorschauImRahmen } from '@/components/farm/vorschau-im-rahmen'
import { HofseiteSeitenspalte } from '@/components/hofseite/hofseite-seitenspalte'
import { HofseiteFotos } from '@/components/hofseite/hofseite-fotos'
import { Titelbild } from '@/components/hofseite/titelbild'
import { Abzeichen, AbzeichenKnopf } from '@/components/ui/abzeichen'

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
 * Aufbau: Rückweg, Titelbild mit Name und Aktionen, Pausen-Hinweis, Reiter
 * Übersicht · Produkte · Beiträge (in der Adresse, ?reiter=, geschrieben per
 * replaceState), darunter zweispaltig ab 1024 px: der Inhalt des Reiters und
 * die rechte Spalte (EINE Komponente, hofseite-seitenspalte.tsx). Das
 * Produktraster bleibt in jedem Reiter an derselben Stelle eingehängt — Korb
 * und Nachbestell-Link überstehen so den Wechsel. Die Karten führen zur
 * Produktseite (Nr. 11). Unter lg steht in der Übersicht zuerst das
 * Schaufenster (Register N5, Nr. 51): Fotostreifen, bis zu vier Produkte,
 * „Alle Produkte (n)"; danach rechte Spalte und Über uns.
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

const ANLASS: Record<string, { label: string; symbol: LucideIcon }> = {
  FRESH_PRODUCT: { label: 'Frisches Produkt', symbol: Leaf },
  NEW_SEASON: { label: 'Neue Saison', symbol: CalendarDays },
  PROMOTION: { label: 'Aktion', symbol: Tag },
  ANNOUNCEMENT: { label: 'Mitteilung', symbol: MessageCircle },
}

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
  reorderItems,
  ansicht,
  jetzt,
}: {
  farm: HofseiteHof
  /** Die aktiven Beiträge, der neueste zuerst (Register F8) — page.tsx lädt höchstens fünf. */
  beitraege: ActiveStatusPost[]
  reorderItems?: ReorderItem[]
  ansicht: Pick<SeitenAnsicht, 'art' | 'kaufen'>
  /**
   * Der Zeitpunkt der Anfrage als ISO-Text, einmal auf dem Server bestimmt
   * (page.tsx): Gebührensatz und „vor 2 Tagen" rechnen davon, nicht von der
   * Uhr beim Rendern — sonst wichen Server und Browser ab (Hydration).
   */
  jetzt: string
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

  // Hat der Hof den Abschnitt Status ausgeblendet, gibt es auch den Reiter nicht.
  const gezeigteBeitraege = sichtbar('status') ? beitraege : []
  // EINE Zahl für den Reiter „Produkte · n" und „Alle Produkte (n)": alles, was der Reiter Produkte zeigt.
  const produktAnzahl = produkte.length
  const reiter = hofseiteReiter({ produktAnzahl, beitragAnzahl: gezeigteBeitraege.length })
  const offen = aktiverReiter({ reiter: suche.get(REITER_PARAMETER), bereich: suche.get('bereich') }, reiter)
  const schaufenster = zeigeSchaufenster(offen, produktAnzahl)

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

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: farm.name,
    description: farm.description,
    // Ohne telephone und email (Nr. 60): Die Nummer gibt es erst nach dem Kauf.
    address: {
      '@type': 'PostalAddress',
      streetAddress: farm.address,
      postalCode: farm.postalCode,
      addressLocality: farm.city,
      addressCountry: 'AT',
    },
  }

  const rueckwegZeile = (
    <div className="mx-auto max-w-[1200px] px-4 pt-1 md:px-6 md:pt-3">
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
  const verfuegbar = verfuegbarText(produkte, farm.isPaused)
  const kannBestellen = produkte.length > 0 && !farm.isPaused

  const zeigeUeberUns = offen === 'uebersicht' && Boolean(ueberUns || werte.length > 0 || farm.foundedYear)
  // Ab lg mit Schaufenster ein Raster aus zwei Zeilen: Über uns oben links,
  // das Schaufenster darunter, die rechte Spalte über beide (siehe unten).
  const zweiZeilen = schaufenster && zeigeUeberUns

  const seitenspalte = (
    <HofseiteSeitenspalte
      hof={farm}
      zahlungsarten={zahlungsarten(farm)}
      gebuehrKurz={gebuehr?.kurz ?? null}
      gebuehrKorb={gebuehr?.korb ?? null}
      mitKorb={mitKorb}
      jetzt={jetzt}
      produkte={produkte}
      // Am Handy nur in der Übersicht (Mockup mobil-k2-hofseite) — nach dem Schaufenster (Register N5), ohne Schaufenster vor dem Inhalt.
      className={cn('lg:col-start-2 lg:row-start-1', zweiZeilen && 'lg:row-span-2', offen !== 'uebersicht' && 'hidden lg:flex')}
    />
  )

  // EINE Karte Über uns — sie steht je nach Fall an genau einer Stelle (siehe unten), nie doppelt.
  const ueberUnsKarte = zeigeUeberUns ? (
    // data-abschnitt: Ziel der Markierung aus Mein Hof für Über uns, Gründungsjahr und Werte (ZIEL_ABSCHNITT, Nr. 50).
    <section data-abschnitt="ueberuns" aria-labelledby="ueber-uns" className={cn(KARTE, 'flex flex-col gap-2.5', schaufenster && 'lg:col-start-1 lg:row-start-1')}>
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

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdSicher(jsonLd) }} />
      {ansicht.art === 'vorschau' && <VorschauImRahmen />}

      {rueckwegZeile}

      {/* ── Titelbild, Name, Aktionen ── */}
      <div className="relative">
        {/* Hochformat ab md ganz statt beschnitten (Register N6, Nr. 72): entscheidet titelbild.tsx. */}
        <Titelbild foto={foto} verlauf={titelbildVerlauf(farm.bannerValue)} ausschnitt={titelbildAusschnitt(farm.bannerAusschnitt, farm.bannerFocusY)}>
          <button
            type="button"
            onClick={() => void teileHof(farm)}
            aria-label="Hofseite teilen"
            className={cn(
              'absolute top-3 right-3 flex size-11 items-center justify-center rounded-full bg-primary-foreground/55 text-accent-foreground transition-colors hover:bg-primary-foreground/70 md:hidden',
              FOKUS_RAHMEN
            )}
          >
            <Share2 className="size-5" strokeWidth={1.7} aria-hidden="true" />
          </button>
        </Titelbild>

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

      {/* Pause: Der Hof bleibt sichtbar, nur die Kaufwege sind zu (Knöpfe in den Karten). */}
      {farm.isPaused && (
        <div data-abschnitt="bestellungen" className="mx-auto max-w-[1200px] px-4 pt-5 md:px-6">
          <Hinweiskarte ton="orange" symbol={PauseCircle} titel={`${farm.name} pausiert gerade.`}>
            <span className="break-words">{kundenPausenText(farm.pauseMessage)}</span>
          </Hinweiskarte>
        </div>
      )}

      {/* ── Reiter ── */}
      <div ref={reiterAnker} />
      <nav
        aria-label="Bereiche der Hofseite"
        data-abschnitt="abschnitte"
        className="sticky top-14 z-30 mt-5 border-b border-border bg-background md:top-16 md:mt-7"
      >
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

      {/* ── Inhalt und rechte Spalte ──
          Unter lg in der Übersicht zuerst das Schaufenster (Register N5):
          Fotostreifen, bis zu vier Produkte, „Alle Produkte (n)"; danach die
          rechte Spalte und Über uns. Der Quelltext hat unter lg genau diese
          Reihenfolge — Tastatur und Screenreader folgen ihr, kein `order`.
          Ab lg stellt das Raster die Teile an ihren alten Ort: Über uns oben
          links (Zeile 1), das Schaufenster darunter (Zeile 2, mit dem Abstand
          26 px wie bisher), die rechte Spalte über beide Zeilen. Ohne
          Schaufenster (andere Reiter, keine Produkte) bleibt alles wie bisher:
          die Spalte im Quelltext zuerst, Über uns oben in der Inhaltsspalte.
          Über uns und die Spalte stehen dabei je an genau EINER Stelle. */}
      <div
        className={cn(
          'mx-auto flex max-w-[1200px] flex-col gap-[26px] px-4 pt-6 pb-12 md:px-6 md:pt-7 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10 xl:grid-cols-[minmax(0,1fr)_360px]',
          zweiZeilen && 'lg:grid-rows-[auto_1fr] lg:gap-y-[26px]'
        )}
      >
        {!schaufenster && seitenspalte}

        <div className={cn('flex min-w-0 flex-col gap-[26px] lg:col-start-1', zweiZeilen ? 'lg:row-start-2' : 'lg:row-start-1')}>
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

          {offen === 'beitraege' ? <Beitraege beitraege={gezeigteBeitraege} jetzt={jetzt} /> : null}

          <div id="produkte">
            <ProductGrid
              products={produkte}
              farmId={farm.id}
              farmSlug={farm.slug}
              initialReorderItems={reorderItems && reorderItems.length > 0 ? reorderItems : undefined}
              ownerMode={false}
              isPaused={farm.isPaused}
              kaufen={ansicht.kaufen}
              teil={offen === 'uebersicht' ? 'auswahl' : offen === 'produkte' ? 'alle' : 'keins'}
              gebuehrHinweis={gebuehr?.produkte ?? null}
              gebuehrKorb={gebuehr?.korb ?? null}
              springeZu={futterSprung ? FUTTER_ABSCHNITT_ANKER : null}
              onGesprungen={() => setFutterSprung(false)}
              // Karten führen zur Produktseite (Nr. 11) — aus der Vorschau in deren Vorschau.
              produktLink={(id) => produktLink(farm.slug, id, ansicht.art === 'vorschau')}
              platzUnten={!schaufenster}
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

/**
 * Die Beiträge des Hofs im Reiter „Beiträge“ (Register F8): alle aktiven, der
 * neueste zuerst mit „Aktuell“. Wie viele es höchstens sind, sagt die Abfrage
 * (HOFSEITE_BEITRAEGE_MAX), nicht die Anzeige.
 */
function Beitraege({ beitraege, jetzt }: { beitraege: ActiveStatusPost[]; jetzt: string }): ReactNode {
  return (
    <ul className="flex flex-col gap-3">
      {beitraege.map((beitrag, index) => (
        <li key={beitrag.id}>
          <Beitrag beitrag={beitrag} neuester={index === 0} jetzt={jetzt} />
        </li>
      ))}
    </ul>
  )
}

/** Ein Beitrag des Hofs; der neueste trägt „Aktuell“ und den grünen Rahmen (Mockup mobil-k2-hofseite-beitraege-alle-aktiven). */
function Beitrag({ beitrag, neuester, jetzt }: { beitrag: ActiveStatusPost; neuester: boolean; jetzt: string }): ReactNode {
  const anlass = ANLASS[beitrag.anlass] ?? ANLASS.ANNOUNCEMENT
  const Symbol = anlass.symbol
  // Eine Kennung je Karte: Mehrere Beiträge auf einer Seite dürfen sich nicht dieselbe teilen.
  const titelId = `beitrag-titel-${beitrag.id}`
  return (
    <article aria-labelledby={titelId} className={cn(KARTE, 'flex flex-col gap-3', neuester && 'border-accent')}>
      <div className="flex flex-wrap items-center justify-between gap-x-2.5 gap-y-1">
        {/* Symbol und Anlass in EINER Zeile: StatusBadge setzt seinen Inhalt in einen Block, ein Symbol stünde sonst über dem Wort (Mockup: daneben). */}
        <StatusBadge status="fertig">
          <span className="inline-flex items-center gap-1">
            <Symbol className="size-3 shrink-0" strokeWidth={1.7} aria-hidden="true" />
            {anlass.label}
          </span>
        </StatusBadge>
        <span className="text-[13px] text-muted-foreground">{beitragZeitText(neuester, beitrag.publishedAt, jetzt)}</span>
      </div>
      <h2 id={titelId} className="font-heading text-xl font-semibold break-words text-foreground">
        {beitrag.title}
      </h2>
      <p className="text-[14.5px] leading-relaxed whitespace-pre-wrap break-words text-muted-foreground">
        {stripStatusVariables(beitrag.body)}
      </p>
      {beitrag.photoUrl && (
        <div className="relative aspect-[3/2] max-h-72 w-full overflow-hidden rounded-xl bg-muted">
          {/* Mit Ausschnitt füllt das Foto den Rahmen; ohne steht es ganz wie bisher (Register N17, Nr. 98). */}
          <Image
            src={beitrag.photoUrl}
            alt={beitrag.title}
            fill
            sizes="(min-width: 1024px) 760px, 100vw"
            className={beitrag.fotoAusschnitt ? 'object-cover' : 'object-contain'}
            style={bildStil(beitrag.fotoAusschnitt)}
          />
        </div>
      )}
    </article>
  )
}
