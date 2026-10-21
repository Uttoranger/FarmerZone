'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import type { ActiveStatusPost } from '@/server/queries/status-posts'
import type { PublicProduct } from '@/server/queries/farm'
import type { InDenKorb } from '@/components/farm/product-grid'
import { BEITRAG_ANLASS } from '@/lib/beitrag-anlass'
import { AKTUELL_ANKER, AKTUELL_VOM_HOF_TEXT, beitragProdukte, beitragZeitText, type BeitragsAnordnung } from '@/lib/hofseite-kunde'
import { formatGrundpreis } from '@/lib/format'
import { zweitePreiszeile } from '@/lib/produktdetail'
import { produktInitiale } from '@/lib/hofuebersicht'
import { stripStatusVariables } from '@/lib/status-body'
import { bildStil } from '@/lib/bild-ausschnitt'
import type { BildAusschnitt } from '@/schemas/bild-ausschnitt'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { StatusBadge } from '@/components/ui/status-badge'

/*
 * „Aktuell vom Hof“ — die aktiven Beiträge oben in der Übersicht der Hofseite
 * (Register F8, N5, T5; Nr. 128; Board system-k2-beitraege-v2, Abschnitte 2,
 * 3 und 6). Was gezeigt wird und in welcher Ordnung, entscheiden die Regeln in
 * src/lib/hofseite-kunde.ts (ordneBeitraege, beitragProdukte); hier wird nur
 * angezeigt und auf- und zugeklappt.
 *
 * - Der Beitrag oben als Karte (Rahmen in Akzentfarbe): Anlass, Zeit, Titel,
 *   zwei Zeilen Text, das Foto klein (am Handy 76 px rechts, ab lg 250 px
 *   links). „Weiterlesen“ klappt an Ort und Stelle auf: der ganze Text, das
 *   Foto groß, alle Produkte.
 * - „Dazu im Hofladen“: höchstens drei verknüpfte Produkte; das „+“ legt über
 *   GENAU den Weg der Produktkarten in den Korb (`onInDenKorb` = ProductGrid,
 *   `inDenKorb`). Zugeklappt am Handy nur das erste mit „· n Produkte“.
 * - Ältere Beiträge als Zeilen, jede ein eigener Beitrag (`article`) mit
 *   Knopf, der ihn an Ort und Stelle aufklappt.
 * - Ein geteilter älterer Beitrag (`?beitrag=`) steht oben; darunter
 *   „Neuester: …“, das die Adresse ohne `?beitrag=` zeigt.
 */

const T = AKTUELL_VOM_HOF_TEXT

type ProduktWeg = {
  /** Die Produktliste der Hofseite (im Shop) — „Dazu im Hofladen“ nimmt nur daraus. */
  produkte: readonly PublicProduct[]
  /** „+“ nur, wo Kaufen wirkt und der Hof nicht pausiert — wie bei allen Kaufwegen. */
  mitPlus: boolean
  onInDenKorb: InDenKorb
  /** Die Produktseite (in der Vorschau des Hofs bleibt sie in der Vorschau). */
  produktLink: (id: string) => string
}

export function AktuellVomHof({
  anordnung,
  jetzt,
  neuesterHref,
  onNeuester,
  ...weg
}: ProduktWeg & {
  anordnung: BeitragsAnordnung<ActiveStatusPost>
  /** Der Zeitpunkt der Anfrage (ISO) vom Server — „vor 2 Stunden“ rechnet davon, nie von der Uhr beim Rendern. */
  jetzt: string
  /** Die Hofseite ohne `?beitrag=` — Ziel von „Neuester: …“. */
  neuesterHref: string
  onNeuester: (e: { preventDefault: () => void }) => void
}): React.JSX.Element {
  const { karte, karteIstNeuester, neuester, zeilen, anzahl } = anordnung
  return (
    // scroll-mt: Kopfzeile und Reiterleiste kleben oben — ein Sprung hierher endet darunter.
    // data-abschnitt: Ziel einer Markierung aus Mein Hof (vorschau-im-rahmen.tsx), wie die übrigen Abschnitte.
    <section id={AKTUELL_ANKER} data-abschnitt={AKTUELL_ANKER} aria-labelledby="aktuell-titel" className="flex scroll-mt-32 flex-col gap-2.5 lg:gap-3">
      <div className="flex flex-wrap items-baseline gap-x-2 lg:gap-x-2.5">
        {/* tabIndex -1: Nach „Neuester: …“ geht der Fokus hierher — der Link verschwindet mit dem Wechsel. */}
        <h2 id="aktuell-titel" tabIndex={-1} className="font-heading text-[19px] font-semibold text-foreground outline-none lg:text-[21px]">
          {T.titel}
        </h2>
        <span className="text-[13px] text-muted-foreground">{T.anzahl(anzahl)}</span>
      </div>

      {/* key: Wechselt der Beitrag oben, beginnt die Karte zugeklappt. */}
      <BeitragKarte key={karte.id} beitrag={karte} neuester={karteIstNeuester} jetzt={jetzt} {...weg} />

      {neuester && (
        <Link
          href={neuesterHref}
          onNavigate={onNeuester}
          prefetch={false}
          className={cn(
            'flex min-h-11 items-center gap-2 rounded-[14px] border border-border px-3 text-[13.5px] text-foreground transition-colors duration-[250ms] hover:bg-muted lg:max-w-[520px]',
            FOKUS_RAHMEN
          )}
        >
          <span className="min-w-0 flex-1 truncate">
            <span className="font-semibold">{T.neuester}</span> {neuester.title}
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.7} aria-hidden="true" />
        </Link>
      )}

      {zeilen.length > 0 && (
        <ul className="flex flex-col gap-2 lg:max-w-[520px]">
          {zeilen.map((beitrag) => (
            <li key={beitrag.id}>
              <BeitragZeile beitrag={beitrag} jetzt={jetzt} {...weg} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** Der Beitrag oben: kurz (zwei Zeilen, Register N5), „Weiterlesen“ klappt ihn auf. */
function BeitragKarte({
  beitrag,
  neuester,
  jetzt,
  ...weg
}: ProduktWeg & {
  beitrag: ActiveStatusPost
  neuester: boolean
  jetzt: string
}) {
  const [offen, setOffen] = useState(false)
  const anlass = BEITRAG_ANLASS[beitrag.anlass]
  // Kennungen je Beitrag: Mehrere Beiträge auf einer Seite dürfen sich keine teilen.
  const titelId = `beitrag-titel-${beitrag.id}`
  const inhaltId = `beitrag-inhalt-${beitrag.id}`
  const produkteId = `beitrag-produkte-${beitrag.id}`
  const produkte = beitragProdukte(beitrag.linkedProductIds, weg.produkte)

  return (
    <article aria-labelledby={titelId} className="flex flex-col gap-2.5 rounded-2xl border border-accent bg-card p-3.5 lg:gap-3 lg:p-[18px]">
      <div className="flex gap-5">
        {beitrag.photoUrl && !offen && (
          // Ab lg links, 250 px — am Handy steht das Foto klein rechts neben dem Titel. Aufgeklappt steht es groß beim Text.
          <span className="relative hidden h-[188px] w-[250px] shrink-0 overflow-hidden rounded-[14px] bg-muted lg:block">
            <Image src={beitrag.photoUrl} alt={beitrag.title} fill sizes="250px" className="object-cover" style={bildStil(beitrag.fotoAusschnitt)} />
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-x-2.5 gap-y-1 lg:justify-start">
            <StatusBadge status="fertig" symbol={anlass.symbol}>
              {anlass.wort}
            </StatusBadge>
            <span className="text-[12.5px] text-muted-foreground lg:text-[13px]">{beitragZeitText(neuester, beitrag.publishedAt, jetzt)}</span>
          </div>

          <div id={inhaltId} className="flex flex-col gap-2.5">
            <div className="flex items-start gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <h3 id={titelId} className="font-heading text-[18px] leading-tight font-semibold break-words text-foreground lg:text-[22px]">
                  {beitrag.title}
                </h3>
                <p
                  className={cn(
                    'text-[13.5px] leading-normal break-words text-muted-foreground lg:text-[14.5px]',
                    offen ? 'whitespace-pre-wrap' : 'line-clamp-2'
                  )}
                >
                  {stripStatusVariables(beitrag.body)}
                </p>
              </div>
              {beitrag.photoUrl && !offen && (
                <span className="relative size-[76px] shrink-0 overflow-hidden rounded-xl bg-muted lg:hidden">
                  <Image
                    src={beitrag.photoUrl}
                    alt={beitrag.title}
                    fill
                    sizes="76px"
                    className="object-cover"
                    style={bildStil(beitrag.fotoAusschnitt)}
                  />
                </span>
              )}
            </div>
            {beitrag.photoUrl && offen && (
              // Aufgeklappt groß, am Handy wie am Computer (Freigabe 128 Punkt 3); ab lg so breit wie die Zeilen darunter.
              <FotoGross src={beitrag.photoUrl} titel={beitrag.title} ausschnitt={beitrag.fotoAusschnitt} className="lg:max-w-[520px]" />
            )}
          </div>

          <button
            type="button"
            aria-expanded={offen}
            aria-controls={produkte.length > 0 ? `${inhaltId} ${produkteId}` : inhaltId}
            onClick={() => setOffen(!offen)}
            className={cn(
              '-my-1.5 inline-flex min-h-11 items-center gap-1 self-start rounded-md text-[13.5px] font-semibold text-brand-text lg:text-[14px]',
              FOKUS_RAHMEN
            )}
          >
            {offen ? T.weniger : T.weiterlesen}
            <ChevronDown
              className={cn('size-4 transition-transform duration-[250ms] motion-reduce:transition-none', offen && 'rotate-180')}
              strokeWidth={1.7}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      {/* Unter Foto und Text über die ganze Breite der Karte — ab lg zweispaltig (Board §3: „darunter die Produkte“). */}
      {produkte.length > 0 && <DazuImHofladen id={produkteId} zeilen={produkte} alle={offen} {...weg} />}
    </article>
  )
}

/** Ein älterer Beitrag als Zeile: Symbol, Titel, Anlass · Zeit — der Knopf klappt ihn an Ort und Stelle auf. */
function BeitragZeile({ beitrag, jetzt, ...weg }: ProduktWeg & { beitrag: ActiveStatusPost; jetzt: string }) {
  const [offen, setOffen] = useState(false)
  const anlass = BEITRAG_ANLASS[beitrag.anlass]
  const Symbol = anlass.symbol
  const titelId = `beitrag-titel-${beitrag.id}`
  const inhaltId = `beitrag-inhalt-${beitrag.id}`
  const produkte = beitragProdukte(beitrag.linkedProductIds, weg.produkte)

  return (
    <article aria-labelledby={titelId} className="rounded-[14px] border border-border">
      {/* Überschrift um den Knopf (Muster „Aufklappen“): Der Titel bleibt eine Überschrift, der Knopf ein Knopf. */}
      <h3>
        <button
          type="button"
          aria-expanded={offen}
          aria-controls={inhaltId}
          onClick={() => setOffen(!offen)}
          className={cn('flex min-h-[52px] w-full items-center gap-2.5 rounded-[14px] px-3 py-2 text-left', FOKUS_RAHMEN)}
        >
          <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-accent/15 text-brand-text">
            <Symbol className="size-4" strokeWidth={1.7} aria-hidden="true" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span id={titelId} className={cn('text-[13.5px] font-semibold text-foreground', offen ? 'break-words' : 'truncate')}>
              {beitrag.title}
            </span>
            <span className="text-[12px] text-muted-foreground">
              {anlass.wort} · {beitragZeitText(false, beitrag.publishedAt, jetzt)}
            </span>
          </span>
          <ChevronDown
            className={cn(
              'size-4 shrink-0 text-muted-foreground transition-transform duration-[250ms] motion-reduce:transition-none',
              offen && 'rotate-180'
            )}
            strokeWidth={1.7}
            aria-hidden="true"
          />
        </button>
      </h3>
      <div id={inhaltId} hidden={!offen} className="flex flex-col gap-2.5 px-3 pb-3">
        {offen && (
          <>
            <p className="text-[13.5px] leading-normal whitespace-pre-wrap break-words text-muted-foreground">{stripStatusVariables(beitrag.body)}</p>
            {beitrag.photoUrl && <FotoGross src={beitrag.photoUrl} titel={beitrag.title} ausschnitt={beitrag.fotoAusschnitt} />}
            {produkte.length > 0 && <DazuImHofladen zeilen={produkte} alle {...weg} />}
          </>
        )}
      </div>
    </article>
  )
}

/** Das Foto groß (aufgeklappt): mit Ausschnitt füllend, ohne ganz wie bisher (Register N17, Nr. 98). */
function FotoGross({ src, titel, ausschnitt, className }: { src: string; titel: string; ausschnitt: BildAusschnitt | null; className?: string }) {
  return (
    <span className={cn('relative block aspect-[3/2] max-h-72 w-full overflow-hidden rounded-xl bg-muted', className)}>
      <Image
        src={src}
        alt={titel}
        fill
        sizes="(min-width: 1024px) 520px, 100vw"
        className={ausschnitt ? 'object-cover' : 'object-contain'}
        style={bildStil(ausschnitt)}
      />
    </span>
  )
}

/** „Dazu im Hofladen“: zugeklappt am Handy das erste Produkt mit „· n Produkte“, sonst alle (ab lg zweispaltig). */
function DazuImHofladen({
  id,
  zeilen,
  alle,
  mitPlus,
  onInDenKorb,
  produktLink,
}: Omit<ProduktWeg, 'produkte'> & {
  id?: string
  zeilen: ReturnType<typeof beitragProdukte<PublicProduct>>
  alle: boolean
}) {
  return (
    <div id={id} className="flex flex-col gap-2 border-t border-border pt-2.5 lg:pt-3">
      <p className="text-[12px] font-semibold text-foreground">
        {T.dazu}
        {!alle && zeilen.length > 1 && <span className="font-medium text-muted-foreground lg:hidden">{T.produktAnzahl(zeilen.length)}</span>}
      </p>
      <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2 lg:gap-x-[18px] lg:gap-y-3">
        {zeilen.map(({ produkt, ausverkauft }, index) => (
          <li key={produkt.id} className={cn(!alle && index > 0 && 'max-lg:hidden')}>
            <BeitragProdukt produkt={produkt} ausverkauft={ausverkauft} mitPlus={mitPlus} onInDenKorb={onInDenKorb} href={produktLink(produkt.id)} />
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Ein Produkt unter dem Beitrag: Bild 44 px, Name und Preis mit denselben
 * Helfern wie die Produktliste, die Zeile führt zur Produktseite. Ausverkauft
 * gedimmt (Bild entsättigt, Text leise — nie über opacity, Kontrast) mit
 * „derzeit aus“ und ohne „+“.
 */
function BeitragProdukt({
  produkt,
  ausverkauft,
  mitPlus,
  onInDenKorb,
  href,
}: {
  produkt: PublicProduct
  ausverkauft: boolean
  mitPlus: boolean
  onInDenKorb: InDenKorb
  href: string
}) {
  const bild = produkt.imageUrl ?? produkt.categoryImageUrl
  const istFoto = produkt.imageUrl !== null
  const grundpreis = zweitePreiszeile(produkt)
  return (
    <div className="flex items-center gap-2.5">
      <Link href={href} title={produkt.name} className={cn('flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-lg', FOKUS_RAHMEN)}>
        <span className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-muted">
          {bild ? (
            <Image
              src={bild}
              // Das Produktfoto heißt wie das Produkt; die Kategorie-Illustration ist Schmuck.
              alt={istFoto ? produkt.name : ''}
              fill
              sizes="44px"
              className={cn(istFoto ? 'object-cover' : 'object-contain p-1 dark:brightness-[0.85] dark:saturate-[0.9]', ausverkauft && 'grayscale')}
              style={istFoto ? bildStil(produkt.bildAusschnitt, { filter: !ausverkauft }) : undefined}
            />
          ) : (
            <span aria-hidden="true" className="font-heading text-base font-semibold text-brand-text">
              {produktInitiale(produkt.name)}
            </span>
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={cn('truncate text-[14px] font-semibold', ausverkauft ? 'text-muted-foreground' : 'text-foreground')}>{produkt.name}</span>
          <span className="truncate text-[12.5px] text-muted-foreground">{formatGrundpreis(produkt.price, produkt.unit, produkt.unitSize)}</span>
          {grundpreis && <span className="truncate text-xs text-muted-foreground">{grundpreis}</span>}
        </span>
      </Link>
      {ausverkauft ? (
        <span className="shrink-0 text-[12.5px] font-medium text-muted-foreground">{T.derzeitAus}</span>
      ) : mitPlus ? (
        <button
          type="button"
          onClick={() => onInDenKorb(produkt)}
          aria-label={T.inDenKorb(produkt.name)}
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-full border border-accent/45 bg-accent/15 text-brand-text transition-colors duration-[250ms] hover:bg-accent/25',
            FOKUS_RAHMEN
          )}
        >
          <Plus className="size-5" strokeWidth={1.7} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  )
}
