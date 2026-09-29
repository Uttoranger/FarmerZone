import Link from 'next/link'
import { ChevronLeft, ChevronRight, Lightbulb } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { einheitLabel, formatEuro, formatZahl } from '@/lib/format'
import { centsAlsEuro } from '@/lib/servicegebuehr'
import { cn } from '@/lib/utils'
import type { Balken, Periode } from '@/lib/umsatz'
import { AUSWERTUNG_MAX_ZURUECK, auswertungHref } from '@/schemas/auswertung'
import type { UmsatzAuswertung } from '@/server/queries/analytics'

/**
 * Der Reiter „Umsatz": Zeitraum wählen, großer Betrag mit Vergleich in Worten,
 * Balken mit der Vorperiode blass daneben (Vorbild Shopify, Quicken), ein Satz,
 * was auffällt, dann Kanäle und Top-Produkte. Alles serverseitig gezeichnet —
 * die Balken sind Kästen mit Tailwind-Farben, damit beide Themes ohne
 * JavaScript-Umschaltung stimmen.
 */

const PERIODEN: { key: Periode; label: string }[] = [
  { key: 'woche', label: 'Woche' },
  { key: 'monat', label: 'Monat' },
  { key: 'jahr', label: 'Jahr' },
]

const euro = (cent: number) => formatEuro(centsAlsEuro(cent))

export function UmsatzAuswertungAnzeige({ daten }: { daten: UmsatzAuswertung }) {
  const { periode, zurueck } = daten
  const leer = daten.balken.every((b) => b.cent === 0 && b.vergleichCent === 0)

  return (
    <div className="space-y-5">
      {/* Woche · Monat · Jahr — als Links, jeder Zeitraum hat seine Adresse. */}
      <nav
        aria-label="Zeitraum"
        className="flex gap-1.5 rounded-[10px] p-1"
        style={{ background: 'var(--app-trough)' }}
      >
        {PERIODEN.map((p) => {
          const aktiv = p.key === periode
          return (
            <Link
              key={p.key}
              href={auswertungHref(p.key, 0)}
              aria-current={aktiv ? 'page' : undefined}
              className="flex min-h-[38px] flex-1 items-center justify-center rounded-lg px-4 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={aktiv ? { background: 'var(--app-bar)', color: 'var(--app-bar-ink)' } : { color: 'var(--app-ink-soft)' }}
            >
              {p.label}
            </Link>
          )
        })}
      </nav>

      {/* ‹ Zeitraum › */}
      <div className="flex items-center justify-between gap-2">
        {zurueck < AUSWERTUNG_MAX_ZURUECK ? (
          <Link
            href={auswertungHref(periode, zurueck + 1)}
            aria-label="Zeitraum davor"
            className="inline-flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </Link>
        ) : (
          <span className="size-11" />
        )}
        <h2 className="font-heading text-lg font-semibold text-foreground">{daten.zeitraum}</h2>
        {zurueck > 0 ? (
          <Link
            href={auswertungHref(periode, zurueck - 1)}
            aria-label="Zeitraum danach"
            className="inline-flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRight className="size-5" aria-hidden />
          </Link>
        ) : (
          <span className="size-11" />
        )}
      </div>

      {/* Großer Betrag, Vergleich in Worten, Balken */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <p className="font-heading text-4xl font-bold tabular-nums text-foreground">{euro(daten.summeCent)}</p>
          <p
            className={cn(
              'mt-1.5 text-sm font-medium',
              daten.vergleich.richtung === 'mehr' && 'text-green-700 dark:text-green-400',
              daten.vergleich.richtung === 'weniger' && 'text-amber-700 dark:text-amber-300',
              (daten.vergleich.richtung === 'gleich' || daten.vergleich.richtung === 'keiner') && 'text-muted-foreground'
            )}
          >
            {daten.vergleich.text}
          </p>
          {daten.laufend && daten.vergleich.richtung !== 'keiner' && (
            <p className="mt-0.5 text-xs text-muted-foreground">verglichen bis zum selben Zeitpunkt</p>
          )}

          {leer ? (
            <p className="mt-6 rounded-xl bg-muted/50 py-8 text-center text-sm text-muted-foreground">
              Noch keine Verkäufe in diesem Zeitraum
            </p>
          ) : (
            <BalkenDiagramm balken={daten.balken} zeitraum={daten.zeitraum} vergleichLabel={daten.vergleichLabel} />
          )}
        </CardContent>
      </Card>

      {daten.einsicht && (
        <div className="flex gap-3 rounded-xl border border-border bg-app-chip p-4">
          <Lightbulb className="mt-0.5 size-5 shrink-0 text-amber-500" aria-hidden />
          <p className="text-sm text-app-chip-ink">{daten.einsicht}</p>
        </div>
      )}

      {daten.kanaele.length > 0 && (
        <Card>
          <CardContent className="pt-5 pb-5">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Wo kam das Geld her</h3>
            <ul className="space-y-3.5">
              {daten.kanaele.map((k) => (
                <li key={k.kanal}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium text-foreground">{k.label}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      <span className="font-semibold text-foreground">{euro(k.cent)}</span> · {k.anteilProzent} %
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-app-trough">
                    <div className="h-full rounded-full bg-brand-text" style={{ width: `${k.anteilProzent}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {daten.topProdukte.length > 0 && (
        <Card>
          <CardContent className="pt-5 pb-5">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Was lief am besten</h3>
            <ol className="space-y-3">
              {daten.topProdukte.map((p, i) => (
                <li key={`${p.name}-${i}`} className="flex items-center gap-3">
                  <span className="w-4 shrink-0 text-right text-xs text-muted-foreground">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.einheit ? `${formatZahl(p.menge)} ${einheitLabel(p.einheit, p.menge)}` : `${formatZahl(p.menge)}×`}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{euro(p.cent)}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function BalkenDiagramm({ balken, zeitraum, vergleichLabel }: { balken: Balken[]; zeitraum: string; vergleichLabel: string }) {
  const hoechster = Math.max(1, ...balken.flatMap((b) => [b.cent, b.vergleichCent]))
  // Ein Umsatz über null bekommt mindestens einen sichtbaren Strich.
  const hoehe = (cent: number) => (cent > 0 ? `max(3px, ${(cent / hoechster) * 100}%)` : '0')

  return (
    <figure className="mt-6">
      <div aria-hidden className="flex h-40 items-end gap-1 sm:gap-2">
        {balken.map((b) => (
          <div key={b.label} className="flex h-full min-w-0 flex-1 items-end justify-center gap-px sm:gap-0.5">
            <div className="w-full max-w-4 rounded-t-sm bg-brand-text/25" style={{ height: hoehe(b.vergleichCent) }} />
            <div className="w-full max-w-4 rounded-t-sm bg-brand-text" style={{ height: hoehe(b.cent) }} />
          </div>
        ))}
      </div>
      <div aria-hidden className="mt-1.5 flex gap-1 border-t border-border pt-1.5 sm:gap-2">
        {balken.map((b) => (
          <span key={b.label} className="min-w-0 flex-1 truncate text-center text-[10px] text-muted-foreground sm:text-[11px]">
            {b.label}
          </span>
        ))}
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm bg-brand-text" />
          {zeitraum}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm bg-brand-text/25" />
          {vergleichLabel}
        </span>
      </figcaption>
      {/* Für Screenreader dieselben Zahlen als Tabelle */}
      <table className="sr-only">
        <caption>Umsatz {zeitraum} und {vergleichLabel}</caption>
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
