import Link from 'next/link'
import { ChevronLeft, ChevronRight, Lightbulb, Share2 } from 'lucide-react'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { ProgressBar } from '@/components/ui/progress-bar'
import { StatusBadge } from '@/components/ui/status-badge'
import { KARTE, KICKER, KNOPF_RAHMEN, LEISE } from '@/components/hof-bestellungen/stil'
import { centsAlsEuro, einheitLabel, formatEuro, formatZahl } from '@/lib/format'
import { zahlartZeile, type GrenzeStand, type Kennzahlen, type TeilenKarte as TeilenKarteDaten } from '@/lib/auswertung'
import type { Balken, KanalAnteil, Periode, TopProdukt, Vergleichssatz } from '@/lib/umsatz'
import { AUSWERTUNG_MAX_ZURUECK, auswertungHref } from '@/schemas/auswertung'
import { TEILEN_ZAEHLUNG_HINWEIS } from '@/lib/teilen-kanal'
import { cn } from '@/lib/utils'
import type { ServicegebuehrenDiesesMonats } from '@/server/queries/auswertung'

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
  'inline-flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors duration-[250ms] hover:bg-muted hover:text-foreground',
  FOKUS_RAHMEN
)

/** Woche · Monat · Jahr und ‹ Zeitraum › — als Links, jeder Zeitraum hat seine Adresse. */
export function ZeitraumWahl({ periode, zurueck, zeitraum }: { periode: Periode; zurueck: number; zeitraum: string }): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <ul aria-label="Zeitraum" className="inline-flex gap-[3px] rounded-full border border-border bg-background p-[3px]">
        {PERIODEN.map((p) => (
          <li key={p.key}>
            <Link
              href={auswertungHref(p.key, 0)}
              aria-current={p.key === periode ? 'page' : undefined}
              className={cn(
                "relative inline-flex h-8 items-center rounded-full px-4 text-[13px] whitespace-nowrap transition-colors duration-[250ms] before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-['']",
                p.key === periode ? 'bg-border font-semibold text-foreground' : 'font-medium text-muted-foreground hover:text-foreground',
                FOKUS_RAHMEN
              )}
            >
              {p.label}
            </Link>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-1">
        {zurueck < AUSWERTUNG_MAX_ZURUECK ? (
          <Link href={auswertungHref(periode, zurueck + 1)} aria-label="Zeitraum davor" className={PFEIL}>
            <ChevronLeft className="size-5" strokeWidth={1.7} aria-hidden="true" />
          </Link>
        ) : (
          <span className="size-11" />
        )}
        <h2 className="min-w-[9rem] text-center font-heading text-lg font-semibold text-foreground">{zeitraum}</h2>
        {zurueck > 0 ? (
          <Link href={auswertungHref(periode, zurueck - 1)} aria-label="Zeitraum danach" className={PFEIL}>
            <ChevronRight className="size-5" strokeWidth={1.7} aria-hidden="true" />
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
      <dt className={KICKER}>{titel}</dt>
      <dd className="mt-1.5 font-heading text-[26px] leading-tight font-semibold text-foreground tabular-nums md:text-[30px]">{wert}</dd>
      <dd className={cn('text-xs leading-normal', LEISE)}>{satz}</dd>
    </div>
  )
}

/** Vier Kennzahlen des gewählten Zeitraums (Mockup: Warenumsatz · Bestellungen · Ø Bestellung · Nicht abgeholt). */
export function KennzahlenReihe({ k, zeitraum }: { k: Kennzahlen; zeitraum: string }): React.JSX.Element {
  return (
    <section aria-labelledby="auswertung-kennzahlen">
      <h2 id="auswertung-kennzahlen" className="sr-only">
        Kennzahlen {zeitraum}
      </h2>
      {/* Eine Beschreibungsliste; jede Kachel ist eine Gruppe aus dt und dd (div in dl ist erlaubt). */}
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kachel titel="Warenumsatz" wert={euroGanz(k.warenCents)} satz={`${zeitraum} · abgeholte Bestellungen`} />
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
        </h2>
        <span className={cn('text-[12.5px]', LEISE)}>{zeitraum}</span>
        {karte.kopf && <span className="text-sm font-semibold text-foreground tabular-nums sm:ml-auto">{karte.kopf}</span>}
      </div>
      {karte.zeilen.length === 0 ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-[13.5px] text-foreground">In diesem Zeitraum kam noch niemand über einen geteilten Link.</p>
          <Link href="/dashboard" className={KNOPF_RAHMEN}>
            <Share2 className="size-4" strokeWidth={1.7} aria-hidden="true" />
            Hof teilen auf Heute
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {karte.zeilen.map((z) => (
            <li key={z.kanal} className="grid grid-cols-[minmax(0,7.5rem)_1fr] items-center gap-x-2.5 gap-y-1 sm:grid-cols-[7.5rem_1fr_auto]">
              <span className="truncate text-[13px] text-foreground" title={z.name}>
                {z.name}
              </span>
              <span aria-hidden="true" className="h-2.5 overflow-hidden rounded-full bg-muted">
                <span className="block h-full rounded-full bg-accent" style={{ width: `${z.anteilProzent}%` }} />
              </span>
              <span className={cn('col-span-2 text-[12.5px] tabular-nums sm:col-span-1 sm:text-right', LEISE)}>{z.text}</span>
            </li>
          ))}
        </ul>
      )}
      <p className={cn('text-xs leading-normal', LEISE)}>{TEILEN_ZAEHLUNG_HINWEIS}</p>
    </section>
  )
}

// ─── Umsatz mit Balken ──────────────────────────────────────────────────────

export function UmsatzKarte({
  titel,
  zeitraum,
  summeCent,
  vergleich,
  laufend,
  balken,
  vergleichLabel,
}: {
  titel: string
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
        <h2 id="auswertung-umsatz" className={KARTEN_TITEL}>
          {titel}
        </h2>
        <span className={cn('text-[12.5px] sm:ml-auto', LEISE)}>{zeitraum}</span>
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
        </p>
        <p className={cn('mt-0.5 text-xs', LEISE)}>
          Abgeholte Bestellungen und eingetragene Verkäufe
          {laufend && vergleich.richtung !== 'keiner' ? ' · verglichen bis zum selben Zeitpunkt' : ''}
        </p>
      </div>
      {leer ? (
        <p className="rounded-xl bg-muted/60 py-8 text-center text-sm text-muted-foreground">Noch keine Verkäufe in diesem Zeitraum</p>
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
            <div className="w-full max-w-5 rounded-t-[6px] bg-accent/30" style={{ height: hoehe(b.vergleichCent) }} />
            <div className="w-full max-w-5 rounded-t-[6px] bg-accent" style={{ height: hoehe(b.cent) }} />
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="mt-1.5 flex gap-1 border-t border-border pt-1.5 sm:gap-2">
        {balken.map((b) => (
          <span key={b.label} className="min-w-0 flex-1 truncate text-center text-[11px] text-muted-foreground">
            {b.label}
          </span>
        ))}
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-sm bg-accent" />
          {zeitraum}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2.5 rounded-sm bg-accent/30" />
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

// ─── Servicegebühren dieses Monats ──────────────────────────────────────────

function Zeile({ titel, wert, stark = false }: { titel: string; wert: string; stark?: boolean }): React.JSX.Element {
  return (
    <div className={cn('flex items-baseline gap-2', stark ? 'text-[15px] font-semibold text-foreground' : 'text-[13.5px]')}>
      <dt className={cn('min-w-0', !stark && LEISE)}>{titel}</dt>
      <dd className="ml-auto shrink-0 text-foreground tabular-nums">{wert}</dd>
    </div>
  )
}

/**
 * „Servicegebühren dieses Monats" statt der Monatsabrechnung (Gate 8): bis
 * zum SEPA-Start (Register B1, K1) gibt es keine Lastschrift — die Karte
 * zeigt nur, was an Gebühren an den Bestellungen dieses Monats gespeichert
 * ist, und sagt, wer sie zahlt. Nur lesend.
 */
export function ServicegebuehrenKarte({
  monat,
  saetze,
}: {
  monat: ServicegebuehrenDiesesMonats
  saetze: { erklaerung: string; bar: string | null }
}): React.JSX.Element {
  return (
    <section aria-labelledby="auswertung-gebuehren" className={cn(KARTE, 'flex flex-col gap-3 px-4 py-4 md:px-[18px]')}>
      <div>
        <h2 id="auswertung-gebuehren" className="font-heading text-lg font-semibold text-foreground">
          Servicegebühren dieses Monats
        </h2>
        <p className={cn('text-xs leading-normal', LEISE)}>{monat.bezeichnung}</p>
      </div>
      <dl className="flex flex-col gap-2">
        <Zeile titel={`Online bezahlt (${monat.onlineAnzahl} ${monat.onlineAnzahl === 1 ? 'Bestellung' : 'Bestellungen'})`} wert={euro(monat.onlineCents)} />
        {(monat.vorOrtAnzahl > 0 || saetze.bar === null) && (
          <Zeile titel={`Vor Ort bezahlt (${monat.vorOrtAnzahl} ${monat.vorOrtAnzahl === 1 ? 'Bestellung' : 'Bestellungen'})`} wert={euro(monat.vorOrtCents)} />
        )}
        <div aria-hidden="true" className="h-px bg-border" />
        <Zeile titel="Zusammen" wert={euro(monat.summeCents)} stark />
      </dl>
      <p className={cn('text-xs leading-normal', LEISE)}>{saetze.erklaerung}</p>
      {saetze.bar && <p className={cn('text-xs leading-normal', LEISE)}>{saetze.bar}</p>}
      <p className={cn('text-xs leading-normal', LEISE)}>Gezählt sind bezahlte bzw. abgeholte Bestellungen – stornierte und erstattete nicht.</p>
    </section>
  )
}

// ─── Kanäle, Top-Produkte, Einsicht ─────────────────────────────────────────

export function EinsichtZeile({ text }: { text: string }): React.JSX.Element {
  return (
    <div className="flex gap-3 rounded-2xl border border-border bg-card px-4 py-3.5">
      <Lightbulb className="mt-0.5 size-5 shrink-0 text-status-offen" strokeWidth={1.7} aria-hidden="true" />
      <p className="text-[13.5px] text-foreground">{text}</p>
    </div>
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
              <div className="h-full rounded-full bg-accent" style={{ width: `${k.anteilProzent}%` }} />
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
      <ol className="flex flex-col gap-3">
        {produkte.map((p, i) => (
          <li key={`${p.name}-${i}`} className="flex items-center gap-3">
            <span className={cn('w-4 shrink-0 text-right text-xs', LEISE)}>{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground" title={p.name}>
                {p.name}
              </p>
              <p className={cn('text-xs', LEISE)}>
                {p.einheit ? `${formatZahl(p.menge)} ${einheitLabel(p.einheit, p.menge)}` : `${formatZahl(p.menge)}×`}
              </p>
            </div>
            <span className="shrink-0 text-sm font-semibold text-foreground tabular-nums">{euro(p.cent)}</span>
          </li>
        ))}
      </ol>
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
  grenzeText,
  jahresUmsatz,
  grenze,
  prozent,
  spielraum,
  stand,
}: {
  jahr: string
  grenzeText: string
  jahresUmsatz: number
  grenze: number
  prozent: number
  spielraum: number
  stand: GrenzeStand
}): React.JSX.Element {
  return (
    <section aria-labelledby="auswertung-grenze" className={cn(KARTE, 'flex flex-col gap-3 px-4 py-4 md:px-[18px]')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="auswertung-grenze" className={KICKER}>
            {grenzeText} Grenze Be- &amp; Verarbeitung {jahr}
          </h2>
          <p className="mt-1 font-heading text-2xl font-semibold text-foreground tabular-nums">
            {formatEuro(jahresUmsatz, 0)}
            <span className={cn('ml-1.5 font-sans text-sm font-normal', LEISE)}>von {formatEuro(grenze, 0)}</span>
          </p>
        </div>
        <StatusBadge status={stand.ton === 'gruen' ? 'fertig' : 'offen'}>{stand.marke}</StatusBadge>
      </div>
      <ProgressBar beschriftung="Anteil an der Grenze" wert={Math.round(prozent)} ton={stand.ton} />
      {spielraum > 0 && <p className={cn('text-xs', LEISE)}>Noch {formatEuro(spielraum, 0)} Spielraum</p>}
      {stand.hinweis && <p className="border-t border-border pt-3 text-[13px] text-foreground">{stand.hinweis}</p>}
      <p className={cn('text-xs', LEISE)}>
        Zählweise vereinfacht, ohne als Urproduktion markierte Produkte — keine Steuerberatung. Details: Landwirtschaftskammer.
      </p>
    </section>
  )
}
