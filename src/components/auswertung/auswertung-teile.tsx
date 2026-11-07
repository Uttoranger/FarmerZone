import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { LadePunkt } from '@/components/ui/lade-punkt'
import { FilterChip, FilterChipReihe } from '@/components/ui/chip'
import { DIAGRAMM_BALKEN, DIAGRAMM_VERGLEICH } from '@/components/ui/diagramm-farbe'
import { RUNDUNG } from '@/components/ui/rundung'
import { StatusBadge } from '@/components/ui/status-badge'
import { KARTE, KNOPF_RAHMEN, LEISE } from '@/components/hof-bestellungen/stil'
import { centsAlsEuro, einheitLabel, formatEuro, formatZahl, mitAnzahl } from '@/lib/format'
import { UMSATZ_LEER, zahlartZeile, type GebuehrenKarteText, type GrenzeStand, type Kennzahlen, type TeilenKarte as TeilenKarteDaten } from '@/lib/auswertung'
import { MARKE } from '@/lib/marke'
import { UMSATZ_TEXT, type Balken, type KanalAnteil, type Periode, type TopProdukt, type Vergleichssatz } from '@/lib/umsatz'
import { AUSWERTUNG_MAX_ZURUECK, auswertungHref } from '@/schemas/auswertung'
import { cn } from '@/lib/utils'
import type { GebuehrenImZeitraum } from '@/server/queries/auswertung'

/** Fußsatz der Karte „Was lief am besten“, wörtlich nach Board s2-/w2-auswertung. */
const TOP_PRODUKTE_FUSS = `Nur Bestellungen über ${MARKE}, Warenpreis.`

/** Fußsatz der Teilen-Karte, wörtlich nach Board s2-/w2-auswertung (Liste Lauf 32 auswertung). */
export const TEILEN_FUSS = 'Gezählt werden Besuche, keine Bestellungen.'

/** Der Satz im leeren Diagramm (G4, Board s2-/w2-auswertung Bild 4). */
export const UMSATZ_LEER_SATZ = 'Verkaufst du auch am Markt oder ab Hof? Trag es ein, dann siehst du hier alles zusammen.'

/*
 * Die Teile der Auswertung im neuen Design (Nachtlauf Nr. 22c, Mockup
 * web-h5-auswertung-abrechnung-teilen-wirkung). Alles serverseitig
 * gezeichnet; Zahlen und Sätze haben src/lib/auswertung.ts bzw.
 * src/lib/umsatz.ts entschieden. Balken sind Kästen mit Token-Klassen, damit
 * beide Themes ohne JavaScript-Umschaltung stimmen (kein Recharts nötig).
 */

const euro = (cent: number) => formatEuro(centsAlsEuro(cent))
const euroGanz = (cent: number) => formatEuro(centsAlsEuro(cent), 0)

const KARTEN_TITEL = 'font-heading text-[17px] font-semibold text-foreground'

// ─── Zeitraum ───────────────────────────────────────────────────────────────

const PERIODEN: { key: Periode; label: string }[] = [
  { key: 'woche', label: 'Woche' },
  { key: 'monat', label: 'Monat' },
  { key: 'jahr', label: 'Jahr' },
]

const PFEIL = cn(
  'relative inline-flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors duration-[250ms] hover:bg-muted hover:text-foreground',
  FOKUS_RAHMEN
)

/**
 * Woche · Monat · Jahr als Chip-Gruppe (G11) und darunter in eigener Zeile, mittig, ‹ Zeitraum ›
 * (Liste Lauf 32 auswertung) — alles Links, jeder Zeitraum hat seine Adresse.
 */
export function ZeitraumWahl({ periode, zurueck, zeitraum }: { periode: Periode; zurueck: number; zeitraum: string }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <FilterChipReihe beschriftung="Zeitraum">
        {PERIODEN.map((p) => (
          <FilterChip key={p.key} href={auswertungHref(p.key, 0)} aktiv={p.key === periode} ladePunkt>
            {p.label}
          </FilterChip>
        ))}
      </FilterChipReihe>
      <div className="flex items-center justify-center gap-1">
        {zurueck < AUSWERTUNG_MAX_ZURUECK ? (
          <Link href={auswertungHref(periode, zurueck + 1)} aria-label="Zeitraum davor" className={PFEIL}>
            <ChevronLeft className="size-5" strokeWidth={1.7} aria-hidden="true" />
            <LadePunkt />
          </Link>
        ) : (
          <span className="size-11" />
        )}
        <h2 className="min-w-[9rem] text-center font-heading text-lg font-semibold text-foreground">{zeitraum}</h2>
        {zurueck > 0 ? (
          <Link href={auswertungHref(periode, zurueck - 1)} aria-label="Zeitraum danach" className={PFEIL}>
            <ChevronRight className="size-5" strokeWidth={1.7} aria-hidden="true" />
            <LadePunkt />
          </Link>
        ) : (
          <span className="size-11" />
        )}
      </div>
    </div>
  )
}

// ─── Kennzahlen ─────────────────────────────────────────────────────────────

function Kachel({ titel, wert, satz }: { titel: string; wert: string; satz: string }): React.JSX.Element {
  return (
    <div className={cn(KARTE, 'flex min-w-0 flex-col px-4 py-4 md:px-[18px]')}>
      {/* Normale Schreibung, fett — wie im Board s2-/w2-auswertung (nicht als Versal-Kicker). */}
      <dt className="text-[13px] leading-snug font-semibold text-foreground">{titel}</dt>
      <dd className="mt-1.5 font-heading text-[26px] leading-tight font-semibold text-foreground tabular-nums md:text-[30px]">{wert}</dd>
      <dd className={cn('text-xs leading-normal', LEISE)}>{satz}</dd>
    </div>
  )
}

/**
 * Vier Kennzahlen des gewählten Zeitraums: über die Plattform · Bestellungen ·
 * Ø Bestellung · Nicht abgeholt. Im Mockup heißt die erste „Warenumsatz" —
 * neben „€ 206" in der Umsatzkarte stand dann „€ 0" ohne Erklärung. Seit
 * Nr. 53 sagen beide, was sie zählen (UMSATZ_TEXT): hier nur Bestellungen.
 */
export function KennzahlenReihe({
  k,
  zeitraum,
  satzZeitraum = zeitraum,
}: {
  k: Kennzahlen
  zeitraum: string
  /** Der Zeitraum im Satz unter dem Betrag: „im Februar", „1.–7. März" (zeitraumImSatz, Board s2-/w2-auswertung). */
  satzZeitraum?: string
}): React.JSX.Element {
  return (
    <section aria-labelledby="auswertung-kennzahlen">
      <h2 id="auswertung-kennzahlen" className="sr-only">
        Kennzahlen {zeitraum}
      </h2>
      {/* Eine Beschreibungsliste; jede Kachel ist eine Gruppe aus dt und dd (div in dl ist erlaubt). */}
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kachel titel={UMSATZ_TEXT.ueberPlattform} wert={euroGanz(k.warenCents)} satz={`abgeholt ${satzZeitraum}`} />
        <Kachel titel="Bestellungen" wert={formatZahl(k.bestellungen)} satz={zahlartZeile(k) ?? 'noch keine abgeholt'} />
        <Kachel titel="Ø Bestellung" wert={k.durchschnittCents === null ? '–' : euro(k.durchschnittCents)} satz="Warenpreis" />
        <Kachel titel="Nicht abgeholt" wert={formatZahl(k.nichtAbgeholt)} satz="kostenlos für dich" />
      </dl>
    </section>
  )
}

// ─── Über deine geteilten Links ─────────────────────────────────────────────

/**
 * Teilen-Wirkung (Nr. 21) im gewählten Zeitraum: Summe und je Kanal ein Balken
 * nach Besuchen. Nur Besuche, kein Euro-Betrag (Register T1); der Satz zur
 * Zählung kommt aus `TEILEN_ZAEHLUNG_HINWEIS`, damit er überall gleich lautet.
 */
export function TeilenWirkungKarte({ karte, zeitraum }: { karte: TeilenKarteDaten; zeitraum: string }): React.JSX.Element {
  return (
    <section aria-labelledby="auswertung-teilen" className={cn(KARTE, 'flex flex-col gap-3 px-4 py-4 md:px-[18px]')}>
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <h2 id="auswertung-teilen" className={KARTEN_TITEL}>
          Über deine geteilten Links
          {/* Der Zeitraum steht schon über den Kennzahlen; für den Screenreader bleibt er am Titel. */}
          <span className="sr-only"> · {zeitraum}</span>
        </h2>
        {karte.kopf && <span className="text-sm font-semibold text-foreground tabular-nums sm:ml-auto">{karte.kopf}</span>}
      </div>
      {karte.zeilen.length === 0 ? (
        // Ohne Knopf „Hof teilen“ (Liste Lauf 32 auswertung: Board ohne Knopf).
        <p className="text-[13.5px] text-foreground">In diesem Zeitraum kam noch niemand über einen geteilten Link.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {karte.zeilen.map((z) => (
            <li key={z.kanal} className="grid grid-cols-[minmax(0,7.5rem)_1fr] items-center gap-x-2.5 gap-y-1 sm:grid-cols-[7.5rem_1fr_auto]">
              <span className="truncate text-[13px] text-foreground" title={z.name}>
                {z.name}
              </span>
              <span aria-hidden="true" className="h-2.5 overflow-hidden rounded-full bg-muted">
                <span className={cn('block h-full rounded-full', DIAGRAMM_BALKEN)} style={{ width: `${z.anteilProzent}%` }} />
              </span>
              <span className={cn('col-span-2 text-[12.5px] tabular-nums sm:col-span-1 sm:text-right', LEISE)}>{z.text}</span>
            </li>
          ))}
        </ul>
      )}
      <p className={cn('text-xs leading-normal', LEISE)}>{TEILEN_FUSS}</p>
    </section>
  )
}

// ─── Umsatz mit Balken ──────────────────────────────────────────────────────

/**
 * Umsatz mit Balken — Bestellungen UND eingetragene Verkäufe, deshalb „Mit
 * Hofladen" (UMSATZ_TEXT, Nr. 53; vorher „Umsatz pro Tag/Woche/Monat"). Wie
 * fein die Balken sind, sagen ihre Beschriftungen.
 */
export function UmsatzKarte({
  zeitraum,
  summeCent,
  vergleich,
  laufend,
  balken,
  vergleichLabel,
}: {
  zeitraum: string
  summeCent: number
  vergleich: Vergleichssatz
  laufend: boolean
  balken: Balken[]
  vergleichLabel: string
}): React.JSX.Element {
  const leer = balken.every((b) => b.cent === 0 && b.vergleichCent === 0)
  return (
    <section aria-labelledby="auswertung-umsatz" className={cn(KARTE, 'flex flex-col gap-3 px-4 py-4 md:px-[18px]')}>
      <div className="flex flex-wrap items-baseline gap-x-2.5">
        {/* Der Titel sagt, was zählt (Board s2-/w2-auswertung); der Zeitraum steht über den Kennzahlen. */}
        <h2 id="auswertung-umsatz" className={KARTEN_TITEL}>
          {UMSATZ_TEXT.karteTitel}
          <span className="sr-only"> · {zeitraum}</span>
        </h2>
      </div>
      <div>
        <p className="font-heading text-4xl font-semibold text-foreground tabular-nums">{euro(summeCent)}</p>
        <p
          className={cn(
            'mt-1 text-sm font-medium',
            vergleich.richtung === 'mehr' ? 'text-status-fertig' : vergleich.richtung === 'weniger' ? 'text-status-offen' : LEISE
          )}
        >
          {vergleich.text}
          {/* „+n % · verglichen bis zum selben Zeitpunkt“ in einer Zeile (Board s2-/w2-auswertung Bild 3). */}
          {laufend && vergleich.richtung !== 'keiner' && <span className={cn('font-normal', LEISE)}> · verglichen bis zum selben Zeitpunkt</span>}
        </p>
      </div>
      {leer ? (
        <EmptyState
          titel={UMSATZ_LEER.titel}
          satz={UMSATZ_LEER_SATZ}
          className="rounded-none border-0 px-0 py-1"
          ausweg={
            <Link href={UMSATZ_LEER.aktion.href} className={cn(KNOPF_RAHMEN, 'w-full justify-center border-primary text-status-offen')}>
              {UMSATZ_LEER.aktion.text}
            </Link>
          }
        />
      ) : (
        <BalkenDiagramm balken={balken} zeitraum={zeitraum} vergleichLabel={vergleichLabel} />
      )}
    </section>
  )
}

function BalkenDiagramm({ balken, zeitraum, vergleichLabel }: { balken: Balken[]; zeitraum: string; vergleichLabel: string }): React.JSX.Element {
  const hoechster = Math.max(1, ...balken.flatMap((b) => [b.cent, b.vergleichCent]))
  // Ein Umsatz über null bekommt mindestens einen sichtbaren Strich.
  const hoehe = (cent: number) => (cent > 0 ? `max(3px, ${(cent / hoechster) * 100}%)` : '0')
  return (
    <figure>
      <div aria-hidden="true" className="flex h-44 items-end gap-1 sm:gap-2">
        {balken.map((b) => (
          <div key={b.label} className="flex h-full min-w-0 flex-1 items-end justify-center gap-px sm:gap-0.5">
            <div className={cn('w-full max-w-5 rounded-t-[6px]', DIAGRAMM_VERGLEICH)} style={{ height: hoehe(b.vergleichCent) }} />
            <div className={cn('w-full max-w-5 rounded-t-[6px]', DIAGRAMM_BALKEN)} style={{ height: hoehe(b.cent) }} />
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="mt-1.5 flex gap-1 border-t border-border pt-1.5 sm:gap-2">
        {balken.map((b) => (
          <span key={b.label} className="min-w-0 flex-1 truncate text-center text-xs text-muted-foreground">
            {b.label}
          </span>
        ))}
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className={cn('size-2.5 rounded-sm', DIAGRAMM_BALKEN)} />
          {zeitraum}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className={cn('size-2.5 rounded-sm', DIAGRAMM_VERGLEICH)} />
          {vergleichLabel}
        </span>
      </figcaption>
      {/* Für Screenreader dieselben Zahlen als Tabelle. */}
      <table className="sr-only">
        <caption>
          Umsatz {zeitraum} und {vergleichLabel}
        </caption>
        <thead>
          <tr>
            <th scope="col">Abschnitt</th>
            <th scope="col">{zeitraum}</th>
            <th scope="col">{vergleichLabel}</th>
          </tr>
        </thead>
        <tbody>
          {balken.map((b) => (
            <tr key={b.label}>
              <th scope="row">{b.label}</th>
              <td>{euro(b.cent)}</td>
              <td>{euro(b.vergleichCent)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

// ─── Gebühren des gewählten Zeitraums ───────────────────────────────────────

function Zeile({ titel, wert, stark = false }: { titel: string; wert: string; stark?: boolean }): React.JSX.Element {
  return (
    <div className={cn('flex items-baseline gap-2 py-2.5', stark ? 'text-[15px] font-semibold text-foreground' : 'text-[14px]')}>
      <dt className="min-w-0 text-foreground">{titel}</dt>
      <dd className="ml-auto shrink-0 text-foreground tabular-nums">{wert}</dd>
    </div>
  )
}

/**
 * Die Gebühren des GEWÄHLTEN Zeitraums (Liste Lauf 32 auswertung, Nr. 251: „Plattformgebühr im
 * <Monat>“ / „… diese Woche“, Zeilen mit Trennlinien). Bis zum SEPA-Start (Register B1, K1) gibt es
 * keine Lastschrift — die Karte zeigt nur, was an Gebühren an den Bestellungen dieses Zeitraums
 * gespeichert ist (`getServicegebuehrenZeitraum`, dieselbe Regel wie die Abrechnung), und sagt,
 * wer sie zahlt. Nur lesend. Wort und Sätze kommen aus `gebuehrWortFuerZeitraum` bzw.
 * `gebuehrenKarteText` (V62, V63; Nr. 225) — nie ein Wort im Quelltext.
 */
export function GebuehrenKarte({
  titel,
  gebuehr,
  text,
}: {
  titel: string
  gebuehr: GebuehrenImZeitraum
  text: GebuehrenKarteText
}): React.JSX.Element {
  return (
    <section aria-labelledby="auswertung-gebuehren" className={cn(KARTE, 'flex flex-col gap-2 px-4 py-4 md:px-[18px]')}>
      <h2 id="auswertung-gebuehren" className={KARTEN_TITEL}>
        {titel}
      </h2>
      <dl className="flex flex-col divide-y divide-border">
        <Zeile titel={`Online bezahlt (${mitAnzahl(gebuehr.onlineAnzahl, 'Bestellung', 'Bestellungen')})`} wert={euro(gebuehr.onlineCents)} />
        {(gebuehr.vorOrtAnzahl > 0 || text.barZeile) && (
          <Zeile titel={`Bar bei Abholung (${mitAnzahl(gebuehr.vorOrtAnzahl, 'Bestellung', 'Bestellungen')})`} wert={euro(gebuehr.vorOrtCents)} />
        )}
        <Zeile titel="Zusammen" wert={euro(gebuehr.summeCents)} stark />
      </dl>
      <p className={cn('text-[13px] leading-normal', LEISE)}>
        {text.erklaerung}
        {text.bar && ` ${text.bar}`} Gezählt sind bezahlte bzw. abgeholte Bestellungen – stornierte und erstattete nicht.
      </p>
    </section>
  )
}

// ─── Kanäle, Top-Produkte, Einsicht ─────────────────────────────────────────

export function EinsichtZeile({ text }: { text: string }): React.JSX.Element {
  return (
    // Grün getönter Streifen, Text grün fett, ohne Symbol (Liste Lauf 32 auswertung).
    <p className={cn('bg-zustand-laeuft-grund px-4 py-3 text-[14px] leading-normal font-semibold text-status-fertig', RUNDUNG.hinweis)}>{text}</p>
  )
}

export function KanaeleKarte({ kanaele }: { kanaele: KanalAnteil[] }): React.JSX.Element {
  return (
    <section aria-labelledby="auswertung-kanaele" className={cn(KARTE, 'flex flex-col gap-3.5 px-4 py-4 md:px-[18px]')}>
      <h2 id="auswertung-kanaele" className={KARTEN_TITEL}>
        Wo kam das Geld her
      </h2>
      <ul className="flex flex-col gap-3.5">
        {kanaele.map((k) => (
          <li key={k.kanal}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium text-foreground">{k.label}</span>
              <span className={cn('shrink-0 tabular-nums', LEISE)}>
                <span className="font-semibold text-foreground">{euro(k.cent)}</span> · {k.anteilProzent} %
              </span>
            </div>
            <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-muted">
              <div className={cn('h-full rounded-full', DIAGRAMM_BALKEN)} style={{ width: `${k.anteilProzent}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function TopProdukteKarte({ produkte }: { produkte: TopProdukt[] }): React.JSX.Element {
  return (
    <section aria-labelledby="auswertung-top" className={cn(KARTE, 'flex flex-col gap-3.5 px-4 py-4 md:px-[18px]')}>
      <h2 id="auswertung-top" className={KARTEN_TITEL}>
        Was lief am besten
      </h2>
      {/* Eine Zeile je Produkt mit Trennlinien, ohne Rangziffer (Board s2-/w2-auswertung); die Reihenfolge trägt die Liste. */}
      <ol className="flex flex-col [&>li+li]:border-t [&>li+li]:border-border">
        {produkte.map((p, i) => {
          const menge = p.einheit ? `${formatZahl(p.menge)} ${einheitLabel(p.einheit, p.menge)}` : `${formatZahl(p.menge)}×`
          return (
            <li key={`${p.name}-${i}`} className="flex min-h-11 items-center gap-3 py-2">
              <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground" title={`${p.name} · ${menge}`}>
                {p.name} · {menge}
              </p>
              {/* Beträge normal, nicht fett (Liste Lauf 32 auswertung). */}
              <span className="shrink-0 text-sm text-foreground tabular-nums">{euro(p.cent)}</span>
            </li>
          )
        })}
      </ol>
      <p className={cn('text-xs leading-normal', LEISE)}>{TOP_PRODUKTE_FUSS}</p>
    </section>
  )
}

// ─── Grenze Be- & Verarbeitung ──────────────────────────────────────────────

/**
 * Die Jahreskarte zur Umsatzgrenze — gilt unabhängig vom gewählten Zeitraum
 * (Wiener Kalenderjahr, getYtdRevenue), deshalb unter den Zeitraum-Karten.
 */
export function GrenzeKarte({
  jahr,
  jahresUmsatz,
  grenze,
  prozent,
  spielraum,
  stand,
}: {
  jahr: string
  jahresUmsatz: number
  grenze: number
  prozent: number
  spielraum: number
  stand: GrenzeStand
}): React.JSX.Element {
  // Titel ohne Betrag, Marke rechts, „€ … von € 55.000“ in einer Zeile (Liste Lauf 32 auswertung); „Anteil 0 %“ entfällt.
  return (
    <section aria-labelledby="auswertung-grenze" className={cn(KARTE, 'flex flex-col gap-3 px-4 py-4 md:px-[18px]')}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
        <h2 id="auswertung-grenze" className={KARTEN_TITEL}>
          Grenze Be- &amp; Verarbeitung {jahr}
        </h2>
        <StatusBadge status={stand.ton === 'gruen' ? 'fertig' : 'offen'}>{stand.marke}</StatusBadge>
      </div>
      <p className="text-[15px] font-semibold text-foreground tabular-nums">
        {formatEuro(jahresUmsatz, 0)} <span className={cn('font-normal', LEISE)}>von {formatEuro(grenze, 0)}</span>
      </p>
      <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full', stand.ton === 'gruen' ? DIAGRAMM_BALKEN : 'bg-primary')}
          style={{ width: `${Math.min(100, Math.max(0, Math.round(prozent)))}%` }}
        />
      </div>
      {spielraum > 0 && <p className={cn('text-xs', LEISE)}>Noch {formatEuro(spielraum, 0)} Spielraum</p>}
      {stand.hinweis && <p className="border-t border-border pt-3 text-[13px] text-foreground">{stand.hinweis}</p>}
      <p className={cn('text-xs leading-normal', LEISE)}>
        Nur verarbeitete Produkte wie Bergkäse. Zählweise vereinfacht, ohne als Urproduktion markierte Produkte – keine Steuerberatung.
        Details: Landwirtschaftskammer.
      </p>
    </section>
  )
}
