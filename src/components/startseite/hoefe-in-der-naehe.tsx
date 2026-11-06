import type { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { HOEFE_LEER, KARTE_ADRESSE, abholzeileDerKarte, STARTSEITE_CHIPS, STARTSEITE_HOEFE_DECKEL, STARTSEITE_HOEFE_TITEL, hoefeAdresse, type StartseitenHof } from '@/lib/startseite'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN, FOKUS_RAHMEN_INNEN } from '@/components/ui/fokus'
import { FilterChip, FilterChipReihe } from '@/components/ui/chip'
import { EmptyState } from '@/components/ui/empty-state'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { Abzeichen } from '@/components/ui/abzeichen'
import { BildPlatzhalter } from '@/components/ui/bild-platzhalter'
import { HofkarteRahmen, hofkarteKlassen } from '@/components/ui/hofkarte-rahmen'
import { BeitragMarke } from '@/components/hoefe/beitrag-marke'
import { ProduktKurzliste } from '@/components/hoefe/produkt-kurzliste'
import { FOTO_HUELLE } from '@/components/ui/bild-dunkel'

/*
 * „Höfe in deiner Nähe" (Mockups web-k0-startseite, mobil-k0-startseite):
 * Kopf, Hofkarten und „Oder direkt suchen". Die Karten kommen als Kinder
 * herein — die Seite lädt sie hinter einer Suspense-Grenze, damit Kopf und
 * Chips nicht auf die Datenbank warten (Skelett: HofKartenSkelett).
 *
 * Einen Standort kennt die Startseite nicht: Die Entfernung („4 km") des
 * Mockups gibt es erst auf /hoefe, wo die Umkreissuche im Browser rechnet.
 * Statt der Kilometer steht PLZ und Ort.
 *
 * Kein Kicker „Aus der Region" über dem Titel (Entscheidung 10, Morgenbericht 25):
 * „Höfe aus der Region" sagt es schon, der Kicker wiederholte es.
 */

export function HoefeInDerNaehe({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    // group/hoefe: Ohne Höfe (Leerzustand mit data-hoefe-leer) entfällt „Oder direkt suchen" (Board Bild 5) —
    // die Karten laden hinter Suspense, also entscheidet das CSS, nicht der Server.
    <section aria-labelledby="hoefe-titel" className="group/hoefe pt-5 pb-[52px] md:pb-[72px]">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-[22px] px-4 md:gap-[26px] md:px-6">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <h2 id="hoefe-titel" className="font-heading text-[22px] font-semibold md:text-[32px]">
              {STARTSEITE_HOEFE_TITEL}
            </h2>
          </div>
          <span className="flex-1" />
          <Link
            href={KARTE_ADRESSE}
            className={cn(
              'inline-flex h-11 items-center gap-1 rounded-full border border-border px-[18px] text-sm font-medium text-foreground transition-colors duration-[250ms] hover:bg-muted',
              FOKUS_RAHMEN
            )}
          >
            Alle Höfe auf der Karte
            <ChevronRight className="size-4" strokeWidth={1.7} aria-hidden="true" />
          </Link>
        </div>

        {children}

        {/* Am Handy EINE Zeile zum Wischen (Board s1-startseite, Bild 2), im Browser neben dem Satz. */}
        <div className="flex flex-col gap-2 group-has-[[data-hoefe-leer]]/hoefe:hidden md:flex-row md:items-center md:gap-3">
          <span aria-hidden="true" className="text-sm font-semibold text-foreground">
            Oder direkt suchen:
          </span>
          <FilterChipReihe beschriftung="Oder direkt suchen" className="min-w-0 md:flex-1">
            {STARTSEITE_CHIPS.map((chip) => (
              <FilterChip key={chip.label} href={hoefeAdresse(chip.filter)}>
                {chip.label}
              </FilterChip>
            ))}
          </FilterChipReihe>
        </div>
      </div>
    </section>
  )
}

/** Das Foto oder, ohne Foto, der ruhige Platzhalter (V15, Board w1-startseite) — keine Initialen. Im Dunkeln leicht gedämpft. */
function HofBild({ hof, sizes, className }: { hof: StartseitenHof; sizes: string; className?: string }) {
  const { bild } = hofkarteKlassen(hof.pausiert === true)
  if (!hof.foto) return <BildPlatzhalter gedaempft={hof.pausiert === true} className={cn('rounded-none border-0', className)} />
  return (
    <span className={cn('relative block shrink-0 overflow-hidden bg-muted', FOTO_HUELLE, className)}>
      <Image src={hof.foto} alt="" fill sizes={sizes} className={cn('object-cover', bild)} />
    </span>
  )
}

/**
 * Die Abholzeile: ein Termin grün mit „Abholung …" davor (Board w1-startseite), ein Hinweis
 * („Macht gerade Pause – …") halbfett und leise wie auf /hoefe (V18, hofkarteKlassen).
 */
function Abholung({ hof }: { hof: StartseitenHof }) {
  const text = abholzeileDerKarte(hof)
  if (!text) return null
  const { abholung } = hofkarteKlassen(hof.pausiert === true)
  return (
    <span className={cn('block text-[14px]', hof.abholungIstTermin ? 'font-semibold text-status-fertig' : cn(abholung, 'text-muted-foreground'))}>
      {text}
    </span>
  )
}

/**
 * Die Hofkarten (Board w1-/s1-startseite, Bild 2; Nacharbeit 226) — am Handy untereinander über die
 * volle Breite, im Browser drei nebeneinander: oben das Bild, darunter „Gründungshof", Name, PLZ und
 * Ort, die Abholzeile und bis zu drei Produkte mit Preis samt „inkl. Plattformgebühr". Ein
 * pausierter Hof steht ausgegraut und gestrichelt da (V18, HofkarteRahmen). Die ganze Karte ist EIN
 * Link. Mit `jetzt` (Zeitpunkt der Seite, ISO-Text) trägt das Bild die Marke „Neu · vor …“
 * (BeitragMarke, Register N22, Nr. 129); ohne (Block „Höfe-Auswahl“) keine Marke.
 */
export function HofKarten({ hoefe, jetzt }: { hoefe: readonly StartseitenHof[]; jetzt?: string }): React.JSX.Element {
  if (hoefe.length === 0) {
    // Leerzustand mit Ausweg (DESIGN_SYSTEM, „Leerzustände"; Board Bild 5): die Karten-Form des
    // EmptyState, linksbündig, der Knopf über die volle Breite. Das Symbol bleibt (Register N9: Symbol,
    // Satz, Aktion — Register vor Board).
    return (
      <EmptyState
        titel={HOEFE_LEER.titel}
        satz={HOEFE_LEER.satz}
        ausweg={
          <Link
            href={HOEFE_LEER.adresse}
            data-hoefe-leer=""
            className={cn(
              'inline-flex h-12 w-full items-center justify-center rounded-[14px] border border-foreground/70 bg-card px-[18px] text-[15px] font-semibold text-foreground hover:bg-muted',
              FOKUS_RAHMEN
            )}
          >
            {HOEFE_LEER.knopf}
          </Link>
        }
      />
    )
  }

  return (
    <ul className="grid gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-3">
      {hoefe.map((hof) => {
        const pausiert = hof.pausiert === true
        return (
          <li key={hof.slug} className="min-w-0">
            <HofkarteRahmen pausiert={pausiert} className="h-full hover:border-foreground/30">
              <Link
                href={`/${hof.slug}`}
                title={hof.name}
                // Der Satz der Marke für den Screenreader hängt am einen Link der Karte.
                aria-describedby={jetzt !== undefined && hof.neuerBeitrag ? `beitrag-marke-startseite-${hof.slug}` : undefined}
                className={cn('flex h-full flex-col rounded-2xl', FOKUS_RAHMEN_INNEN)}
              >
                <span className="relative block">
                  <HofBild hof={hof} sizes="(min-width: 1024px) 380px, (min-width: 768px) 50vw, 100vw" className="h-24 w-full" />
                  {/* Am Bild oben links, wie auf /hoefe — keine zweite Zeile. */}
                  {jetzt !== undefined && (
                    <BeitragMarke
                      beitrag={hof.neuerBeitrag}
                      jetzt={jetzt}
                      beschreibungId={`beitrag-marke-startseite-${hof.slug}`}
                      className="absolute top-2.5 left-2.5"
                    />
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1 px-3 pt-3 pb-3.5">
                  {/* Abzeichen klein über dem Namen (Register K2, Nr. 116) — die Karte bleibt der Link. */}
                  {hof.gruendungshof && <Abzeichen groesse="klein" className="self-start" />}
                  <span className="line-clamp-2 text-[17px] leading-snug font-bold break-words text-foreground">{hof.name}</span>
                  <span className="block truncate text-[13px] text-muted-foreground">{hof.ort}</span>
                  <Abholung hof={hof} />
                  {hof.produkte && hof.produkte.length > 0 ? (
                    <ProduktKurzliste produkte={hof.produkte} className="mt-1.5" />
                  ) : (
                    hof.angebot && <span className="line-clamp-2 text-[13px] text-foreground">{hof.angebot}</span>
                  )}
                </span>
              </Link>
            </HofkarteRahmen>
          </li>
        )
      })}
    </ul>
  )
}

/** Laden: dieselben Maße wie die Karten, damit nichts springt (DESIGN_SYSTEM, „Ladeansicht"). */
export function HofKartenSkelett(): React.JSX.Element {
  return (
    <ul
      aria-busy="true"
      aria-label="Höfe werden geladen"
      className="grid animate-pulse gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-3"
    >
      {Array.from({ length: STARTSEITE_HOEFE_DECKEL }, (_, i) => (
        <li key={i} className="overflow-hidden rounded-2xl border border-border bg-card">
          <span className="block h-24 bg-muted" />
          <span className="flex flex-col gap-2 px-3 pt-3 pb-3.5">
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
