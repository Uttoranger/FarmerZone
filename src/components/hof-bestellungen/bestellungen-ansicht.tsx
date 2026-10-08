import Link from 'next/link'
import { ChevronRight, Inbox, PartyPopper, Printer } from 'lucide-react'
import type { BestellungenSeite, HofBestellDetail, HofListenEintrag } from '@/server/queries/orders'
import type { HofBestellFilter } from '@/schemas/hof-bestellungen'
import { EmptyState } from '@/components/ui/empty-state'
import { FilterChip, FilterChipReihe } from '@/components/ui/chip'
import { StatusBadge } from '@/components/ui/status-badge'
import { FOKUS_RAHMEN_INNEN } from '@/components/ui/fokus'
import { centsAlsEuro } from '@/lib/servicegebuehr'
import { formatEuro } from '@/lib/format'
import { cn } from '@/lib/utils'
import { BestellDetail } from './bestell-detail'
import { KARTE, KICKER, KNOPF_RAHMEN, LEISE } from './stil'

/** `?filter=` nur, wenn es nicht der Standard ist — die Adresse bleibt kurz. */
export function filterSuche(filter: HofBestellFilter): string {
  return filter === 'offen' ? '' : `?filter=${filter}`
}

/**
 * Bestellungen im neuen Design (Gate 5, Nachtlauf Nr. 19). Ab 1024 px Liste
 * je Abholfenster links und die gewählte Bestellung rechts (ersetzt die
 * Tabelle, Mockup web-h3-bestellungen-packen-uebergeben); darunter entweder
 * die Liste (/orders) oder die Bestellung (/orders/[orderId]) über die ganze
 * Breite (Mockups mobil-h3-bestellungen, mobil-h3-bestelldetail).
 *
 * Zeilen und Filter sind echte Links (DESIGN_SYSTEM „Links und Filter"); was
 * sie zeigen, entscheidet src/lib/hof-bestellungen.ts.
 */
export function BestellungenAnsicht({
  seite,
  filter,
  detail,
  modus,
}: {
  seite: BestellungenSeite
  filter: HofBestellFilter
  detail: HofBestellDetail | null
  /** liste = /orders (Handy: Liste), detail = /orders/[orderId] (Handy: Bestellung). */
  modus: 'liste' | 'detail'
}): React.JSX.Element {
  const suche = filterSuche(filter)
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pt-5 pb-12 md:px-8 md:pt-8 xl:px-10">
      <div className={cn('flex flex-col gap-4 md:gap-[18px]', modus === 'detail' && 'hidden lg:flex')}>
        <div className="flex items-end gap-3">
          <div className="min-w-0">
            <h1 className="font-heading text-2xl font-semibold md:text-[26px]">Bestellungen</h1>
            <p className={cn('text-[13px] leading-normal', LEISE)}>{seite.kopfzeile}</p>
          </div>
          <Link
            href="/orders/today/print"
            target="_blank"
            aria-label="Packliste für heute drucken"
            className={cn(KNOPF_RAHMEN, 'ml-auto size-11 px-0 md:w-auto md:px-[18px]')}
          >
            <Printer className="size-4" strokeWidth={1.7} aria-hidden="true" />
            <span className="hidden md:inline" aria-hidden="true">
              Packliste drucken
            </span>
          </Link>
        </div>
        <FilterChipReihe beschriftung="Bestellungen filtern">
          {seite.chips.map((chip) => (
            <FilterChip key={chip.filter} href={`/orders${filterSuche(chip.filter)}`} aktiv={chip.filter === filter}>
              {chip.text}
            </FilterChip>
          ))}
        </FilterChipReihe>
      </div>

      {/* In der Bestellung unter 1024 px kein Abstand oben: Dort beginnt die feste Leiste des Rückwegs am oberen Rand. */}
      <div className={cn('lg:mt-5 lg:flex lg:items-start lg:gap-5 xl:gap-6', modus === 'liste' && 'mt-4')}>
        <div className={cn('lg:w-[320px] lg:shrink-0 xl:w-[420px] 2xl:w-[520px]', modus === 'detail' && 'hidden lg:block')}>
          <BestellListe seite={seite} filter={filter} gewaehlt={detail?.id ?? null} nurBreit={modus === 'liste'} suche={suche} />
        </div>
        <div className={cn('min-w-0 flex-1', modus === 'liste' && 'hidden lg:block')}>
          {detail ? (
            <BestellDetail key={detail.id} bestellung={detail} zurueckSuche={suche} />
          ) : (
            seite.gruppen.length > 0 && (
              <p className={cn(KARTE, 'px-5 py-8 text-center text-[13.5px]', LEISE)}>Wähle links eine Bestellung.</p>
            )
          )}
        </div>
      </div>
    </div>
  )
}

function BestellListe({
  seite,
  filter,
  gewaehlt,
  nurBreit,
  suche,
}: {
  seite: BestellungenSeite
  filter: HofBestellFilter
  gewaehlt: string | null
  /** Auf /orders steht die gewählte Bestellung nur ab 1024 px daneben — am Handy ist nichts gewählt. */
  nurBreit: boolean
  suche: string
}): React.JSX.Element {
  if (seite.gruppen.length === 0) return <LeereListe seite={seite} filter={filter} />
  return (
    <div className="flex flex-col gap-5">
      {seite.gruppen.map((gruppe) => (
        <section key={gruppe.schluessel} aria-label={gruppe.titel}>
          <h2 className={cn(KICKER, 'mb-2.5')}>{gruppe.titel}</h2>
          <ul className="flex flex-col gap-2.5">
            {gruppe.bestellungen.map((b) => (
              <li key={b.id}>
                <ListenZeile eintrag={b} href={`/orders/${b.id}${suche}`} gewaehlt={b.id === gewaehlt} nurBreit={nurBreit} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function ListenZeile({
  eintrag,
  href,
  gewaehlt,
  nurBreit,
}: {
  eintrag: HofListenEintrag
  href: string
  gewaehlt: boolean
  nurBreit: boolean
}): React.JSX.Element {
  return (
    <Link
      href={href}
      aria-current={gewaehlt && !nurBreit ? 'page' : undefined}
      title={eintrag.kunde}
      className={cn(
        'flex min-h-[64px] items-center gap-3 rounded-[13px] border px-3.5 py-3 transition-colors duration-[250ms] hover:bg-muted',
        !gewaehlt && 'border-border bg-card',
        // Hell trägt der grüne Rand allein: eine grüne Tönung drückte den leisen Text unter 4,5:1.
        gewaehlt && !nurBreit && 'border-accent/60 bg-card dark:bg-accent/10',
        gewaehlt && nurBreit && 'border-border bg-card lg:border-accent/60 lg:dark:bg-accent/10',
        FOKUS_RAHMEN_INNEN
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="truncate text-sm font-semibold">{eintrag.kunde}</span>
          <span className={cn('shrink-0 text-[12.5px] font-medium', LEISE)}>· {eintrag.nummer}</span>
        </span>
        <span className={cn('mt-0.5 block truncate text-[12.5px]', LEISE)}>{eintrag.positionen || 'Alle Artikel fehlen'}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-sm font-semibold tabular-nums">{formatEuro(centsAlsEuro(eintrag.gesamtCents))}</span>
        <span className={cn('hidden text-[11.5px] sm:block lg:hidden xl:block', LEISE)}>{eintrag.zahlart}</span>
        {/* Schmale Spalte (Handy, Liste neben der Bestellung bei 1024 px): Marke unter dem Betrag. */}
        <StatusBadge status={eintrag.marke.ton} className="sm:hidden lg:inline-flex xl:hidden">
          {eintrag.marke.text}
        </StatusBadge>
      </span>
      <StatusBadge status={eintrag.marke.ton} className="hidden shrink-0 sm:inline-flex lg:hidden xl:inline-flex">
        {eintrag.marke.text}
      </StatusBadge>
      <ChevronRight className={cn('size-4 shrink-0 lg:hidden', LEISE)} strokeWidth={1.7} aria-hidden="true" />
    </Link>
  )
}

function LeereListe({ seite, filter }: { seite: BestellungenSeite; filter: HofBestellFilter }): React.JSX.Element {
  if (!seite.hatBestellungen) {
    return (
      <EmptyState
        symbol={Inbox}
        titel="Noch keine Bestellungen"
        satz="Teile deine Hofseite, damit Kundinnen bei dir bestellen können."
        aktion={
          <Link href="/farm-page" className={KNOPF_RAHMEN}>
            Zu Mein Hof
          </Link>
        }
      />
    )
  }
  if (filter === 'offen') {
    return (
      <EmptyState
        symbol={PartyPopper}
        titel="Alles erledigt"
        satz="Gerade wartet keine Bestellung auf dich."
        aktion={
          <Link href="/orders?filter=erledigt" className={KNOPF_RAHMEN}>
            Erledigte ansehen
          </Link>
        }
      />
    )
  }
  return (
    <EmptyState
      symbol={Inbox}
      titel="Keine Bestellungen in dieser Ansicht"
      satz="Wähle einen anderen Filter."
      aktion={
        <Link href="/orders?filter=alle" className={KNOPF_RAHMEN}>
          Alle Bestellungen zeigen
        </Link>
      }
    />
  )
}
