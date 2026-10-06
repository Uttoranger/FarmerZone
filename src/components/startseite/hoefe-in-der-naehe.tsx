import type { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronRight, Store } from 'lucide-react'
import { KARTE_ADRESSE, STARTSEITE_CHIPS, STARTSEITE_HOEFE_DECKEL, hoefeAdresse, type StartseitenHof } from '@/lib/startseite'
import { hofInitialen } from '@/lib/hof-initialen'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { FilterChip } from '@/components/ui/chip'
import { EmptyState } from '@/components/ui/empty-state'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { Kicker } from '@/components/startseite/kicker'

/*
 * „Höfe in deiner Nähe" (Mockups web-k0-startseite, mobil-k0-startseite):
 * Kopf, Hofkarten und „Oder direkt suchen". Die Karten kommen als Kinder
 * herein — die Seite lädt sie hinter einer Suspense-Grenze, damit Kopf und
 * Chips nicht auf die Datenbank warten (Skelett: HofKartenSkelett).
 *
 * Einen Standort kennt die Startseite nicht: Die Entfernung („4 km") des
 * Mockups gibt es erst auf /hoefe, wo die Umkreissuche im Browser rechnet.
 * Statt der Kilometer steht PLZ und Ort.
 */

export function HoefeInDerNaehe({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <section aria-labelledby="hoefe-titel" className="pt-5 pb-[52px] md:pb-[72px]">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-[22px] px-4 md:gap-[26px] md:px-6">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Kicker>Aus der Region</Kicker>
            <h2 id="hoefe-titel" className="font-heading text-[22px] font-semibold md:text-[32px]">
              Höfe in deiner Nähe
            </h2>
          </div>
          <span className="flex-1" />
          <Link
            href={KARTE_ADRESSE}
            className={cn(
              'inline-flex h-11 items-center gap-1 rounded-full border border-border px-[18px] text-sm font-medium text-foreground transition-colors duration-[250ms] hover:bg-muted md:h-10',
              FOKUS_RAHMEN
            )}
          >
            Alle Höfe auf der Karte
            <ChevronRight className="size-4" strokeWidth={1.7} aria-hidden="true" />
          </Link>
        </div>

        {children}

        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
          <span id="direkt-suchen" className="mr-1.5 text-sm text-muted-foreground">
            Oder direkt suchen:
          </span>
          <ul aria-labelledby="direkt-suchen" className="flex flex-wrap gap-2 md:gap-2.5">
            {STARTSEITE_CHIPS.map((chip) => (
              <li key={chip.label}>
                <FilterChip href={hoefeAdresse(chip.filter)}>{chip.label}</FilterChip>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

/** Das Foto oder, ohne Foto, die Initialen des Hofs auf ruhiger Fläche. */
function HofBild({ hof, sizes, className }: { hof: StartseitenHof; sizes: string; className?: string }) {
  return (
    <span className={cn('relative block shrink-0 overflow-hidden bg-muted', className)}>
      {hof.foto ? (
        <Image src={hof.foto} alt="" fill sizes={sizes} className="object-cover" />
      ) : (
        <span aria-hidden="true" className="flex h-full items-center justify-center font-heading text-2xl font-semibold text-muted-foreground">
          {hofInitialen(hof.name)}
        </span>
      )}
    </span>
  )
}

/** Die Abholzeile: ein Termin grün, ein Hinweis („Macht gerade Pause") leise. */
function Abholung({ hof, praefix = '' }: { hof: StartseitenHof; praefix?: string }) {
  if (!hof.abholung) return null
  return (
    <span className={cn('block truncate text-[12.5px]', hof.abholungIstTermin ? 'font-semibold text-status-fertig' : 'text-muted-foreground')}>
      {hof.abholungIstTermin ? praefix : ''}
      {hof.abholung}
    </span>
  )
}

/** Die Hofkarten — am Handy waagrecht zum Wischen, im Browser eine Reihe. */
export function HofKarten({ hoefe }: { hoefe: readonly StartseitenHof[] }): React.JSX.Element {
  if (hoefe.length === 0) {
    // Leerzustand mit Ausweg (DESIGN_SYSTEM, „Zustände"): Noch gibt es keine
    // Höfe zu zeigen — wer selbst einen hat, kann den Anfang machen.
    return (
      <EmptyState
        symbol={Store}
        titel="Die ersten Höfe kommen gerade dazu"
        satz="Schau bald wieder vorbei. Du hast selbst einen Hof? Dann mach den Anfang."
        aktion={
          <Link
            href="/register"
            className={cn(
              'inline-flex h-11 items-center rounded-full border border-border px-[18px] text-sm font-semibold text-foreground hover:bg-muted',
              FOKUS_RAHMEN
            )}
          >
            Hof registrieren
          </Link>
        }
      />
    )
  }

  return (
    <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:grid md:grid-cols-2 md:gap-4 md:overflow-visible md:px-0 lg:grid-cols-4">
      {hoefe.map((hof) => (
        <li key={hof.slug} className="w-[250px] shrink-0 snap-start md:w-auto">
          <Link
            href={`/${hof.slug}`}
            title={hof.name}
            className={cn(
              'flex h-full flex-col overflow-hidden rounded-[18px] border border-border bg-card transition-colors duration-[250ms] hover:border-foreground/30',
              FOKUS_RAHMEN
            )}
          >
            <HofBild hof={hof} sizes="(min-width: 1024px) 285px, (min-width: 768px) 50vw, 250px" className="h-[130px] w-full" />
            <span className="flex min-w-0 flex-col gap-1.5 px-4 py-3.5">
              <span className="line-clamp-2 font-heading text-lg leading-snug font-semibold break-words text-foreground">
                {hof.name}
              </span>
              <span className="block truncate text-[12.5px] text-muted-foreground">{hof.ort}</span>
              <Abholung hof={hof} />
              {hof.angebot && <span className="line-clamp-2 text-[12.5px] text-foreground">{hof.angebot}</span>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

/** Laden: dieselben Maße wie die Karten, damit nichts springt (DESIGN_SYSTEM, „Ladeansicht"). */
export function HofKartenSkelett(): React.JSX.Element {
  return (
    <ul
      aria-busy="true"
      aria-label="Höfe werden geladen"
      className="-mx-4 flex animate-pulse gap-3 overflow-hidden px-4 pb-1 md:mx-0 md:grid md:grid-cols-2 md:gap-4 md:px-0 lg:grid-cols-4"
    >
      {Array.from({ length: STARTSEITE_HOEFE_DECKEL }, (_, i) => (
        <li key={i} className="w-[250px] shrink-0 overflow-hidden rounded-[18px] border border-border bg-card md:w-auto">
          <span className="block h-[130px] bg-muted" />
          <span className="flex flex-col gap-2 px-4 py-3.5">
            <span className="block h-5 w-3/4 rounded bg-border" />
            <span className="block h-3 w-1/2 rounded bg-muted" />
            <span className="block h-3 w-2/3 rounded bg-muted" />
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Fehler inline an der Stelle der Karten — mit Ausweg, ohne Technik. */
export function HofKartenFehler(): React.JSX.Element {
  return (
    <Hinweiskarte
      ton="orange"
      titel="Wir konnten die Höfe gerade nicht laden."
      aktion={
        <Link
          href={hoefeAdresse()}
          className={cn('inline-flex h-11 items-center rounded-full border border-border px-4 text-sm font-semibold hover:bg-muted', FOKUS_RAHMEN)}
        >
          Höfe entdecken
        </Link>
      }
    >
      Versuch es gleich noch einmal oder schau direkt in der Übersicht.
    </Hinweiskarte>
  )
}

/** Der erste Hof als Karte vor dem Kartenbild im Kopf (nur ab 1024 px sichtbar). */
export function KartenHof({ hof }: { hof: StartseitenHof | null }): React.JSX.Element | null {
  if (!hof) return null
  return (
    <Link
      href={`/${hof.slug}`}
      title={hof.name}
      className={cn(
        'absolute bottom-[34px] -left-9 flex w-[280px] gap-3 rounded-2xl border border-border bg-card p-3.5 text-foreground shadow-2xl dark:ring-1 dark:ring-border',
        FOKUS_RAHMEN,
        'focus-visible:outline-white'
      )}
    >
      <HofBild hof={hof} sizes="56px" className="size-14 rounded-xl" />
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-heading text-base font-semibold">{hof.name}</span>
        <span className="truncate text-xs text-muted-foreground">{hof.angebot ? `${hof.ort} · ${hof.angebot}` : hof.ort}</span>
        <span className="mt-[3px]">
          <Abholung hof={hof} praefix="Abholung: " />
        </span>
      </span>
    </Link>
  )
}
