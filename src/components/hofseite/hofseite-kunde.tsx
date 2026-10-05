'use client'

import { useMemo, useRef, useState, type ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  CalendarDays,
  Check,
  Leaf,
  MapPin,
  MessageCircle,
  Navigation,
  PauseCircle,
  Phone,
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
  gebuehrHinweis,
  hofseiteReiter,
  reiterAdresse,
  verfuegbarText,
  zahlungsarten,
  type HofReiterId,
} from '@/lib/hofseite-kunde'
import { korbErlaubt } from '@/lib/hofseite-vorschau'
import { rueckweg, type KundenSeite } from '@/lib/kunden-kopf'
import { titelbildFoto, titelbildVerlauf } from '@/lib/mein-hof'
import { servicegebuehrSatz } from '@/lib/servicegebuehr'
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
 * Produktraster bleibt in jedem Reiter an derselben Stelle eingehängt — Korb,
 * Produktdetail und Nachbestell-Link überstehen so den Wechsel.
 *
 * Was entschieden wird (Reiter, Abschnitte, Zustände, Zahlung, Gebühr), steht
 * in src/lib/hofseite-kunde.ts und bereiche-anzeige.ts.
 */

type ReorderItem = { productId: string; productName: string; quantity: number }

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

/** Wie lange ein Beitrag her ist — „heute", „vor 3 Stunden", „vor 2 Tagen". */
function vorWieLange(iso: string): string {
  const stunden = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60))
  if (stunden < 1) return 'heute'
  if (stunden < 24) return stunden === 1 ? 'vor 1 Stunde' : `vor ${stunden} Stunden`
  const tage = Math.floor(stunden / 24)
  return tage === 1 ? 'vor 1 Tag' : `vor ${tage} Tagen`
}

export function HofseiteKunde({
  farm,
  activeStatus,
  reorderItems,
  ansicht,
}: {
  farm: PublicFarm
  activeStatus: ActiveStatusPost | null
  reorderItems?: ReorderItem[]
  ansicht: Pick<SeitenAnsicht, 'art' | 'kaufen'>
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

  const beitrag = sichtbar('status') ? activeStatus : null
  const reiter = hofseiteReiter({ produktAnzahl: produkte.length, hatBeitrag: beitrag !== null })
  const offen = aktiverReiter({ reiter: suche.get(REITER_PARAMETER), bereich: suche.get('bereich') }, reiter)

  // ?bereich=futter: einmal zum Futter-Abschnitt springen — nicht bei jedem
  // späteren Wechsel in den Reiter Produkte.
  const [futterSprung, setFutterSprung] = useState(
    () => bereichWunsch === 'FUTTERMITTEL' && produkte.some((p) => anzeigeBereichVon(p.category) === 'FUTTERMITTEL')
  )

  const satz = servicegebuehrSatz(farm, new Date())
  const gebuehr = gebuehrHinweis(satz)
  const mitKorb = korbErlaubt({ isEditMode: false, kaufen: ansicht.kaufen })
  const kartenLink = buildMapsUrl(farm.address, farm.postalCode, farm.city)

  // Vor der Reiterleiste: Nach einem Wechsel steht der neue Reiter oben, wenn
  // die Seite schon darunter gescrollt war.
  const reiterAnker = useRef<HTMLDivElement>(null)

  function zeigeReiter(id: HofReiterId) {
    return (e: { preventDefault: () => void }) => {
      // Wie die Filter auf /hoefe: Die Adresse wird geschrieben, Next gleicht
      // useSearchParams ab — kein Server-Aufruf, kein Eintrag im Verlauf.
      // Zustand `null`, nie window.history.state: Mit Nexts eigenem Zustand
      // hält Next den Aufruf für seinen eigenen und gleicht NICHT ab — die
      // Adresse wechselte, der Reiter nicht (im Browser nachgestellt).
      e.preventDefault()
      window.history.replaceState(null, '', reiterAdresse(pfad, window.location.search, id))
      const anker = reiterAnker.current
      if (!anker) return
      const kopf = document.querySelector('header')?.getBoundingClientRect().height ?? 0
      const ziel = anker.getBoundingClientRect().top + window.scrollY - kopf
      if (window.scrollY > ziel) window.scrollTo({ top: ziel })
    }
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: farm.name,
    description: farm.description,
    telephone: farm.phone,
    email: farm.email,
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
            satz="Schau bald wieder vorbei – oder ruf direkt am Hof an."
            aktion={
              <>
                <a href={`tel:${farm.phone}`} className={UMRISS_KNOPF}>
                  <Phone className="size-4" strokeWidth={1.7} aria-hidden="true" />
                  Anrufen
                </a>
                <Link href="/hoefe" className={UMRISS_KNOPF}>
                  Andere Höfe entdecken
                </Link>
              </>
            }
          />
        </div>
      </>
    )
  }

  const foto = titelbildFoto(farm)
  const ueberUns = sichtbar('about') ? (farm.aboutText ?? farm.description).trim() : ''
  const werte = sichtbar('values') ? farm.farmValues.slice(0, 6) : []
  const verfuegbar = verfuegbarText(produkte, farm.isPaused)
  const kannBestellen = produkte.length > 0 && !farm.isPaused

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {ansicht.art === 'vorschau' && <VorschauImRahmen />}

      {rueckwegZeile}

      {/* ── Titelbild, Name, Aktionen ── */}
      <div className="relative">
        <div data-abschnitt="titelbild" className="relative h-[220px] w-full overflow-hidden bg-muted md:h-[300px]">
          {foto ? (
            <Image
              src={foto}
              alt=""
              fill
              sizes="100vw"
              priority
              className="object-cover"
              style={{ objectPosition: `50% ${farm.bannerFocusY}%` }}
            />
          ) : (
            // Der Verlauf ist ein Wert des Hofs (Titelbild-Einstellung), kein Farbliteral im Code.
            <div className="absolute inset-0" style={{ background: titelbildVerlauf(farm.bannerValue) }} />
          )}
          {/* Am Handy steht der Name auf dem Bild: dunkler Schleier, theme-fest (DESIGN_SYSTEM, Bild-Overlays). */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-linear-to-t from-primary-foreground/75 via-primary-foreground/10 to-transparent md:hidden"
          />
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
        </div>

        <div className="relative mx-auto max-w-[1200px] px-4 md:flex md:items-end md:gap-6 md:px-6">
          {/* Am Handy über dem unteren Rand des Titelbilds, ab 768 px darunter neben dem Hofzeichen. */}
          <div className="absolute inset-x-4 bottom-[calc(100%+1rem)] flex min-w-0 items-end gap-6 md:static md:-mt-11 md:flex-1">
            <span className="relative hidden size-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-[3px] border-background bg-accent font-heading text-[34px] font-semibold text-accent-foreground md:flex">
              {farm.logoUrl ? (
                <Image src={farm.logoUrl} alt={`${farm.name} – Logo`} fill sizes="96px" className="object-cover" />
              ) : (
                <span aria-hidden="true">{hofInitialen(farm.name)}</span>
              )}
            </span>
            <div className="min-w-0 md:pb-1">
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
            <a href={`tel:${farm.phone}`} className={cn(UMRISS_KNOPF, 'flex-1 md:flex-none')}>
              <Phone className="size-4" strokeWidth={1.7} aria-hidden="true" />
              Anrufen
            </a>
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

      {/* ── Inhalt und rechte Spalte ── */}
      <div className="mx-auto max-w-[1200px] px-4 pt-6 pb-12 md:px-6 md:pt-7 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10 xl:grid-cols-[minmax(0,1fr)_360px]">
        <HofseiteSeitenspalte
          hof={farm}
          zahlungsarten={zahlungsarten(farm)}
          gebuehrKurz={gebuehr?.kurz ?? null}
          gebuehrKorb={gebuehr?.korb ?? null}
          mitKorb={mitKorb}
          // Am Handy nur in der Übersicht, dort vor dem Inhalt (Mockup mobil-k2-hofseite).
          className={cn('mb-[26px] lg:col-start-2 lg:row-start-1 lg:mb-0', offen !== 'uebersicht' && 'hidden lg:flex')}
        />

        <div className="flex min-w-0 flex-col gap-[26px] lg:col-start-1 lg:row-start-1">
          {offen === 'uebersicht' && (ueberUns || werte.length > 0 || farm.foundedYear) ? (
            <section aria-labelledby="ueber-uns" className={cn(KARTE, 'flex flex-col gap-2.5')}>
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
          ) : null}

          {offen === 'uebersicht' && sichtbar('gallery') ? <HofseiteFotos fotos={farm.farmPhotos} /> : null}

          {offen === 'uebersicht' ? (
            <div className="-mb-3.5 flex flex-wrap items-baseline gap-x-2.5">
              <h2 className="font-heading text-xl font-semibold text-foreground">Produkte</h2>
              {verfuegbar && <p className="text-[13px] text-muted-foreground">{verfuegbar}</p>}
              <span className="flex-1" />
              {produkte.length > 0 && (
                <Link
                  href={reiterAdresse(pfad, suche.toString(), 'produkte')}
                  onNavigate={zeigeReiter('produkte')}
                  prefetch={false}
                  className={TEXTLINK}
                >
                  Alle ansehen <span aria-hidden="true">&nbsp;→</span>
                </Link>
              )}
            </div>
          ) : null}

          {offen === 'beitraege' && beitrag ? <Beitrag beitrag={beitrag} /> : null}

          <div id="produkte">
            <ProductGrid
              products={produkte}
              farmId={farm.id}
              farmSlug={farm.slug}
              hof={{ name: farm.name, address: farm.address, postalCode: farm.postalCode, city: farm.city }}
              initialReorderItems={reorderItems && reorderItems.length > 0 ? reorderItems : undefined}
              ownerMode={false}
              isPaused={farm.isPaused}
              kaufen={ansicht.kaufen}
              teil={offen === 'uebersicht' ? 'auswahl' : offen === 'produkte' ? 'alle' : 'keins'}
              gebuehrHinweis={gebuehr?.produkte ?? null}
              gebuehrKorb={gebuehr?.korb ?? null}
              springeZu={futterSprung ? FUTTER_ABSCHNITT_ANKER : null}
              onGesprungen={() => setFutterSprung(false)}
            />
          </div>
        </div>
      </div>
    </>
  )
}

/** Der Beitrag des Hofs (aktiver Status) im Reiter „Beiträge". */
function Beitrag({ beitrag }: { beitrag: ActiveStatusPost }): ReactNode {
  const anlass = ANLASS[beitrag.anlass] ?? ANLASS.ANNOUNCEMENT
  const Symbol = anlass.symbol
  return (
    <article aria-labelledby="beitrag-titel" className={cn(KARTE, 'flex flex-col gap-3')}>
      <div className="flex flex-wrap items-center gap-2.5">
        <StatusBadge status="fertig" className="gap-1">
          <Symbol className="size-3 shrink-0" strokeWidth={1.7} aria-hidden="true" />
          {anlass.label}
        </StatusBadge>
        <span className="text-[13px] text-muted-foreground">Aktuell · {vorWieLange(beitrag.publishedAt)}</span>
      </div>
      <h2 id="beitrag-titel" className="font-heading text-xl font-semibold break-words text-foreground">
        {beitrag.title}
      </h2>
      <p className="text-[14.5px] leading-relaxed whitespace-pre-wrap break-words text-muted-foreground">
        {stripStatusVariables(beitrag.body)}
      </p>
      {beitrag.photoUrl && (
        <div className="relative aspect-[3/2] max-h-72 w-full overflow-hidden rounded-xl bg-muted">
          <Image src={beitrag.photoUrl} alt={beitrag.title} fill sizes="(min-width: 1024px) 760px, 100vw" className="object-contain" />
        </div>
      )}
    </article>
  )
}
