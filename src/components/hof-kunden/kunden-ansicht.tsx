'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Bell, Phone, Search, Users } from 'lucide-react'
import type { CustomerSummary } from '@/server/queries/customers'
import {
  KUNDEN_FILTER_LABEL,
  KUNDEN_SORTIERUNG_LABEL,
  ZURUECKHOLEN_AB,
  andereRichtung,
  filtereKunden,
  initialen,
  kundenAdresse,
  kundenKopfzeile,
  kundenMarke,
  richtungText,
  sortiereKunden,
  vorTagenText,
  zaehleKundenFilter,
  zuletztText,
} from '@/lib/hof-kunden'
import { KUNDEN_FILTER_WERTE, KUNDEN_SORTIERUNG_WERTE, kundenAnsichtAus, kundenAnsichtSchema, type KundenAnsicht as Ansicht } from '@/schemas/hof-kunden'
import { centsAlsEuro, formatEuro, mitAnzahl } from '@/lib/format'
import { EMAIL_MAX } from '@/lib/eingabegrenzen'
import { FilterChip, FilterChipReihe } from '@/components/ui/chip'
import { EmptyState } from '@/components/ui/empty-state'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { StatusBadge } from '@/components/ui/status-badge'
import { FOKUS_RAHMEN, FOKUS_RAHMEN_INNEN } from '@/components/ui/fokus'
import { KARTE, KNOPF_RAHMEN, LEISE } from '@/components/hof-bestellungen/stil'
import { cn } from '@/lib/utils'

/*
 * Kunden des Hofs in der HofShell (Gate 8 „Code ohne Mockup", Nachtlauf
 * Nr. 22a) — gebaut nach docs/ai/DESIGN_SYSTEM.md, Abschnitt „Kunden".
 * Ab 1024 px eine Tabelle, darunter Zeilen; Filter, Suche und Sortierung
 * stehen in der Adresse (?filter=, ?suche=, ?sortierung=, ?richtung=) und werden im
 * Browser angewandt (replaceState, kein Server-Aufruf je Tipp). Was eine
 * Zeile sagt, entscheidet src/lib/hof-kunden.ts; hier wird nur angeordnet.
 */

const euro = (cents: number) => formatEuro(centsAlsEuro(cents))

function schreibeAdresse(adresse: string) {
  // null als Zustand: Next gleicht useSearchParams ab (ARCHITECTURE §4, State-Regeln).
  window.history.replaceState(null, '', adresse)
}

export function KundenAnsicht({ kunden }: { kunden: CustomerSummary[] }): React.JSX.Element {
  const ansicht = kundenAnsichtAus(useSearchParams())
  // Die Suche tippt lokal (Leerzeichen am Ende bleiben stehen); die Adresse bekommt sie bereinigt mit.
  const [suche, setSuche] = useState(ansicht.suche)
  const zahlen = zaehleKundenFilter(kunden)
  const liste = sortiereKunden(filtereKunden(kunden, { filter: ansicht.filter, suche }), ansicht.sortierung, ansicht.richtung)
  const aktuell: Ansicht = { ...ansicht, suche }

  return (
    <div className="flex flex-col gap-4 md:gap-[18px]">
      <header className="min-w-0">
        <h1 className="font-heading text-2xl font-semibold text-foreground md:text-[26px]">Kunden</h1>
        <p className="text-[13px] leading-normal text-muted-foreground">
          {kunden.length > 0 ? kundenKopfzeile(kunden) : 'Alle, die bisher bei dir bestellt haben'}
        </p>
      </header>

      {kunden.length === 0 ? (
        <EmptyState
          symbol={Users}
          titel="Noch keine Kunden"
          satz="Sobald jemand bei dir bestellt, taucht er hier auf. Eine vollständige Hofseite hilft dabei."
          aktion={
            <Link href="/farm-page" className={KNOPF_RAHMEN}>
              Zu Mein Hof
            </Link>
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <FilterChipReihe beschriftung="Kunden filtern" className="min-w-0 xl:flex-1">
              {KUNDEN_FILTER_WERTE.map((f) => {
                const adresse = kundenAdresse({ ...aktuell, filter: f })
                return (
                  <FilterChip
                    key={f}
                    href={adresse}
                    aktiv={ansicht.filter === f}
                    onNavigate={(e) => {
                      e.preventDefault()
                      schreibeAdresse(adresse)
                    }}
                  >
                    {KUNDEN_FILTER_LABEL[f]}
                    <span className="ml-1 tabular-nums">· {zahlen[f]}</span>
                  </FilterChip>
                )
              })}
            </FilterChipReihe>
            <label className="relative block md:max-w-[340px] xl:w-[280px] xl:shrink-0">
              <span className="sr-only">Kundin suchen</span>
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.7} aria-hidden="true" />
              <input
                type="search"
                value={suche}
                onChange={(e) => {
                  // Länger als eine E-Mail-Adresse kann kein Treffer sein — die Adresse bleibt kurz.
                  const wert = e.target.value.slice(0, EMAIL_MAX)
                  setSuche(wert)
                  schreibeAdresse(kundenAdresse({ ...ansicht, suche: wert }))
                }}
                placeholder="Name, Telefon oder E-Mail"
                className={cn(
                  'h-11 w-full rounded-full border border-border bg-card pr-4 pl-10 text-base text-foreground placeholder:text-muted-foreground md:h-9 md:text-[13px]',
                  FOKUS_RAHMEN
                )}
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={cn('text-[13px]', LEISE)} aria-live="polite">
              {mitAnzahl(liste.length, 'Kunde', 'Kunden')}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-[13px]">
                <span className={LEISE}>Sortieren nach</span>
                <select
                  value={ansicht.sortierung}
                  onChange={(e) => {
                    const sortierung = kundenAnsichtSchema.shape.sortierung.parse(e.target.value)
                    // Neue Sortierung beginnt in ihrer Standardrichtung (Name A–Z, sonst das Größte zuerst).
                    schreibeAdresse(kundenAdresse({ ...aktuell, sortierung, richtung: undefined }))
                  }}
                  className={cn(
                    'h-11 rounded-full border border-border bg-card px-4 text-base font-medium text-foreground md:h-9 md:text-[13px]',
                    FOKUS_RAHMEN
                  )}
                >
                  {KUNDEN_SORTIERUNG_WERTE.map((s) => (
                    <option key={s} value={s}>
                      {KUNDEN_SORTIERUNG_LABEL[s]}
                    </option>
                  ))}
                </select>
              </label>
              {/* Ein Knopf, kein Link: Die Richtung ist Seitenzustand neben der Auswahl;
                  die Adresse bekommt sie trotzdem mit (Neuladen, Teilen). */}
              <button
                type="button"
                onClick={() => schreibeAdresse(kundenAdresse({ ...aktuell, richtung: andereRichtung(ansicht.richtung) }))}
                className={cn(
                  'inline-flex h-11 items-center gap-1.5 rounded-full border border-border bg-card px-4 text-base font-medium whitespace-nowrap text-foreground hover:bg-muted md:h-9 md:text-[13px]',
                  FOKUS_RAHMEN
                )}
              >
                {ansicht.richtung === 'auf' ? (
                  <ArrowUpNarrowWide className="size-4" strokeWidth={1.7} aria-hidden="true" />
                ) : (
                  <ArrowDownWideNarrow className="size-4" strokeWidth={1.7} aria-hidden="true" />
                )}
                {richtungText(ansicht.sortierung, ansicht.richtung)}
                <span className="sr-only"> – Reihenfolge umkehren</span>
              </button>
            </div>
          </div>

          {liste.length === 0 ? (
            <EmptyState
              symbol={Search}
              titel="Niemand passt"
              satz={suche.trim() ? `Nichts gefunden für „${suche.trim()}“.` : 'In diesem Filter ist gerade niemand.'}
              aktion={
                <Link
                  href="/customers"
                  prefetch={false}
                  onNavigate={(e) => {
                    e.preventDefault()
                    setSuche('')
                    schreibeAdresse(kundenAdresse({ filter: 'alle', suche: '', sortierung: ansicht.sortierung, richtung: ansicht.richtung }))
                  }}
                  className={KNOPF_RAHMEN}
                >
                  Alle Kunden zeigen
                </Link>
              }
            />
          ) : (
            <>
              <Tabelle kunden={liste} />
              <Zeilen kunden={liste} />
            </>
          )}

          {zahlen.lange >= ZURUECKHOLEN_AB && ansicht.filter !== 'lange' && (
            <Hinweiskarte
              ton="orange"
              titel="Tipp"
              aktion={
                <Link
                  href={kundenAdresse({ filter: 'lange', suche: '', sortierung: ansicht.sortierung, richtung: ansicht.richtung })}
                  prefetch={false}
                  onNavigate={(e) => {
                    e.preventDefault()
                    setSuche('')
                    schreibeAdresse(kundenAdresse({ filter: 'lange', suche: '', sortierung: ansicht.sortierung, richtung: ansicht.richtung }))
                  }}
                  className={KNOPF_RAHMEN}
                >
                  Diese Kunden ansehen
                </Link>
              }
            >
              {zahlen.lange} Kunden haben länger nicht bestellt. Eine kurze WhatsApp könnte sie zurückholen.
            </Hinweiskarte>
          )}
        </>
      )}
    </div>
  )
}

/** Kreis mit den Initialen — Schmuck, der Name steht daneben. */
function Initialen({ name, klein = false }: { name: string; klein?: boolean }): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-foreground',
        klein ? 'size-8 text-xs' : 'size-10 text-sm'
      )}
    >
      {initialen(name)}
    </span>
  )
}

/** Die Glocke für „bekommt Neuigkeiten" — Bedeutung im Screenreader-Text. */
function Neuigkeiten({ an }: { an: boolean }): React.JSX.Element | null {
  if (!an) return null
  return (
    <>
      <Bell className="size-3.5 shrink-0 text-status-fertig" strokeWidth={1.7} aria-hidden="true" />
      <span className="sr-only">bekommt Neuigkeiten</span>
    </>
  )
}

function Anrufen({ kunde, klassen }: { kunde: CustomerSummary; klassen?: string }): React.JSX.Element | null {
  // Wie im Detail: Ein Telefon aus Leerzeichen ist keins.
  const telefon = kunde.customerPhone.trim()
  if (!telefon) return null
  return (
    <a
      href={`tel:${telefon}`}
      aria-label={`${kunde.customerName} anrufen`}
      className={cn('inline-flex size-11 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-muted', FOKUS_RAHMEN, klassen)}
    >
      <Phone className="size-[18px]" strokeWidth={1.7} aria-hidden="true" />
    </a>
  )
}

/**
 * Ab 1024 px: Tabelle; „Häufig bestellt" als eigene Spalte ab 1280 px. Die
 * Spalten nehmen ihre natürliche Breite, der Name den Rest (w-full max-w-0)
 * und kürzt — lange Namen sprengen die Tabelle nie.
 */
function Tabelle({ kunden }: { kunden: CustomerSummary[] }): React.JSX.Element {
  const kopf = 'px-2.5 py-2.5 text-left xl:px-3.5 text-[11px] font-semibold tracking-[0.08em] whitespace-nowrap text-muted-foreground uppercase'
  return (
    <div className={cn(KARTE, 'hidden overflow-hidden lg:block')}>
      <table className="w-full text-[13.5px]">
        <thead className="border-b border-border">
          <tr>
            <th scope="col" className={kopf}>Name</th>
            <th scope="col" className={kopf}>Status</th>
            <th scope="col" className={cn(kopf, 'text-right')}>Bestellungen</th>
            <th scope="col" className={cn(kopf, 'text-right')}>Umsatz</th>
            <th scope="col" className={kopf}>Zuletzt</th>
            <th scope="col" className={cn(kopf, 'hidden xl:table-cell')}>Häufig bestellt</th>
            <th scope="col" className="w-14">
              <span className="sr-only">Anrufen</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {kunden.map((k) => {
            const marke = kundenMarke(k.status)
            return (
              <tr key={k.kundeId} className="border-t border-border first:border-t-0 hover:bg-muted/60">
                <td className="w-full max-w-0 px-2 py-1">
                  <Link
                    href={`/customers/${k.kundeId}`}
                    title={k.customerName}
                    className={cn('flex min-h-11 min-w-0 items-center gap-2.5 rounded-xl px-1.5 font-semibold text-foreground hover:underline', FOKUS_RAHMEN_INNEN)}
                  >
                    <Initialen name={k.customerName} klein />
                    <span className="min-w-0 truncate">{k.customerName}</span>
                    <Neuigkeiten an={k.isSubscribed} />
                  </Link>
                </td>
                <td className="px-2.5 py-1 xl:px-3.5 whitespace-nowrap">{marke && <StatusBadge status={marke.ton}>{marke.text}</StatusBadge>}</td>
                <td className="px-2.5 py-1 xl:px-3.5 text-right tabular-nums">{k.orderCount}</td>
                <td className="px-2.5 py-1 xl:px-3.5 text-right font-semibold whitespace-nowrap tabular-nums">{euro(k.umsatzCents)}</td>
                <td className={cn('px-2.5 py-1 xl:px-3.5 whitespace-nowrap', LEISE)}>{vorTagenText(k.daysSinceLastOrder)}</td>
                <td className={cn('hidden px-3.5 py-1 xl:table-cell', LEISE)}>
                  <span className="block max-w-[180px] truncate" title={k.topProducts[0]?.name}>
                    {k.topProducts[0]?.name ?? '–'}
                  </span>
                </td>
                <td className="px-2 py-1">
                  <Anrufen kunde={k} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Unter 1024 px: eine Zeile je Kundin — die Zeile führt ins Detail, Anrufen
 * steht daneben (nie ein Link im Link). Ohne Telefon hält ein Platzhalter die
 * Beträge in einer Flucht.
 */
function Zeilen({ kunden }: { kunden: CustomerSummary[] }): React.JSX.Element {
  return (
    <ul aria-label="Kunden" className={cn(KARTE, 'overflow-hidden lg:hidden [&>li+li]:border-t [&>li+li]:border-border')}>
      {kunden.map((k) => {
        const marke = kundenMarke(k.status)
        return (
          <li key={k.kundeId} className="flex items-center gap-1 pr-1.5">
            <Link
              href={`/customers/${k.kundeId}`}
              title={k.customerName}
              className={cn('flex min-h-16 min-w-0 flex-1 items-start gap-3 py-3 pl-3.5 text-foreground hover:bg-muted/60', FOKUS_RAHMEN_INNEN)}
            >
              <Initialen name={k.customerName} />
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="min-w-0 truncate text-[14.5px] font-semibold">{k.customerName}</span>
                  <Neuigkeiten an={k.isSubscribed} />
                  <span className="ml-auto shrink-0 pl-2 text-[14px] font-semibold tabular-nums">{euro(k.umsatzCents)}</span>
                </span>
                <span className={cn('mt-0.5 block truncate text-[12.5px]', LEISE)}>
                  {mitAnzahl(k.orderCount, 'Bestellung', 'Bestellungen')} · {zuletztText(k.daysSinceLastOrder)}
                </span>
                {(marke || k.topProducts.length > 0) && (
                  <span className="mt-1 flex min-w-0 items-center gap-2">
                    {marke && <StatusBadge status={marke.ton}>{marke.text}</StatusBadge>}
                    {k.topProducts.length > 0 && (
                      <span className={cn('min-w-0 truncate text-[12.5px]', LEISE)}>
                        Häufig: {k.topProducts.slice(0, 2).map((p) => p.name).join(', ')}
                      </span>
                    )}
                  </span>
                )}
              </span>
            </Link>
            {k.customerPhone.trim() ? <Anrufen kunde={k} /> : <span aria-hidden="true" className="size-11 shrink-0" />}
          </li>
        )
      })}
    </ul>
  )
}
