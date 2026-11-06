'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Bell, Phone } from 'lucide-react'
import type { CustomerSummary } from '@/server/queries/customers'
import {
  KUNDEN_FILTER_LABEL,
  ZURUECKHOLEN_AB,
  filtereKunden,
  initialen,
  kundenAdresse,
  kundenKopfzeile,
  kundenMarke,
  sichtbareKundenFilter,
  sortiereKunden,
  vorTagenText,
  zaehleKundenFilter,
  zuletztText,
} from '@/lib/hof-kunden'
import { kundenAnsichtAus, type KundenAnsicht as Ansicht } from '@/schemas/hof-kunden'
import { centsAlsEuro, formatEuro, mitAnzahl } from '@/lib/format'
import { EMAIL_MAX } from '@/lib/eingabegrenzen'
import { telefonLink } from '@/lib/telefon-anzeige'
import { FilterChip, FilterChipReihe } from '@/components/ui/chip'
import { EmptyState } from '@/components/ui/empty-state'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { StatusBadge } from '@/components/ui/status-badge'
import { FOKUS_RAHMEN, FOKUS_RAHMEN_INNEN } from '@/components/ui/fokus'
import { KARTE, KNOPF_RAHMEN, LEISE } from '@/components/hof-bestellungen/stil'
import { cn } from '@/lib/utils'
import { KundenSortieren } from './kunden-sortieren'

/*
 * Kunden des Hofs in der HofShell (Gate 8 „Code ohne Mockup", Nachtlauf
 * Nr. 22a) — gebaut nach docs/ai/DESIGN_SYSTEM.md, Abschnitt „Kunden".
 * Ab 1024 px eine Tabelle, darunter Zeilen; Filter, Suche und Sortierung
 * stehen in der Adresse (?filter=, ?suche=, ?sortierung=, ?richtung=) und werden im
 * Browser angewandt (replaceState, kein Server-Aufruf je Tipp). Was eine
 * Zeile sagt, entscheidet src/lib/hof-kunden.ts; hier wird nur angeordnet.
 * Seit Nr. 45 (freigabe.md §12): höchstens zwei Filter-Chips, die Sortierung
 * hinter dem Knopf „Sortieren" (kunden-sortieren.tsx) — dort auch alle fünf
 * Filter im Abschnitt „Zeigen".
 */

const euro = (cents: number) => formatEuro(centsAlsEuro(cents))

function schreibeAdresse(adresse: string) {
  // null als Zustand: Next gleicht useSearchParams ab (ARCHITECTURE §4, State-Regeln).
  window.history.replaceState(null, '', adresse)
}

export function KundenAnsicht({
  kunden,
  unterzeile,
}: {
  kunden: CustomerSummary[]
  /** „<Hof> · Stand …“ unter der Überschrift (HofUnterzeile, von der Seite auf dem Server gebaut). */
  unterzeile?: React.ReactNode
}): React.JSX.Element {
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
        {unterzeile}
        <p className={cn('text-[13px] leading-normal text-muted-foreground', unterzeile !== undefined && 'mt-2.5')}>
          {kunden.length > 0 ? kundenKopfzeile(kunden) : 'Alle, die bisher bei dir bestellt haben'}
        </p>
      </header>

      {kunden.length === 0 ? (
        <EmptyState
          titel="Noch keine Kunden"
          satz="Sobald jemand bei dir bestellt, taucht er hier auf. Eine vollständige Hofseite hilft dabei."
          ausweg={
            // Board s2/w2-kunden Bild 5: der Ausweg sagt, was hilft — die Hofseite liegt in Mein Hof.
            <Link href="/farm-page" className={KNOPF_RAHMEN}>
              Hofseite vervollständigen
            </Link>
          }
        />
      ) : (
        <>
          {/* Werkzeugzeile wie im Board s2-/w2-kunden: Chips und „Sortieren“ in einer Zeile, am Handy die Suche
              darunter, im Web zwischen Chips und „Sortieren“. */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
            <FilterChipReihe beschriftung="Kunden filtern" className="order-1 min-w-0 flex-1">
              {sichtbareKundenFilter(ansicht.filter).map((f) => {
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
            <label className="relative order-3 block w-full xl:order-2 xl:w-[360px] xl:shrink-0">
              <span className="mb-1 block text-sm font-semibold text-foreground">Kundin suchen</span>
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
                  // 48 px, leicht gerundet im Feldrand (Board); nie unter 44 px (WCAG 2.5.8).
                  'h-12 w-full rounded-xl border border-input bg-card px-4 text-base text-foreground placeholder:text-muted-foreground md:text-[15px]',
                  FOKUS_RAHMEN
                )}
              />
            </label>
            {/* Ein Knopf, kein Link: Sortierung und Filter im Blatt sind Seitenzustand;
                die Adresse bekommt sie trotzdem mit (Neuladen, Teilen). */}
            <div className="order-2 shrink-0 xl:order-3">
              <KundenSortieren ansicht={aktuell} zahlen={zahlen} onAdresse={schreibeAdresse} />
            </div>
          </div>

          {/* Die Zahl der Treffer hört nur der Screenreader — das Board zeigt sie nicht, die Chips zählen schon. */}
          <p className="sr-only" aria-live="polite">
            {mitAnzahl(liste.length, 'Kunde', 'Kunden')}
          </p>

          {liste.length === 0 ? (
            <EmptyState
              titel="Niemand passt"
              satz={suche.trim() ? `Nichts gefunden für „${suche.trim()}“.` : 'In diesem Filter ist gerade niemand.'}
              ausweg={
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
  // Wie im Detail: nur eine lesbare Nummer bekommt den Knopf (telefonLink) — ein
  // Telefon aus Leerzeichen ist keins, zwei Nummern in einem Feld wählten falsch.
  const anrufen = telefonLink(kunde.customerPhone)
  if (!anrufen) return null
  return (
    <a
      href={anrufen}
      aria-label={`${kunde.customerName} anrufen`}
      className={cn('inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground hover:bg-muted', FOKUS_RAHMEN, klassen)}
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
  const kopf = 'px-2.5 py-2.5 text-left xl:px-3.5 text-[13px] font-semibold whitespace-nowrap text-muted-foreground'
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
                {/* Wie im Board s2-kunden: Name und Marke in einer Zeile, darunter Bestellungen und „Häufig“,
                    ohne Betrag (den zeigt die Tabelle ab 1024 px und die Kundin-Seite). */}
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="min-w-0 truncate text-[15px] font-semibold">{k.customerName}</span>
                  <Neuigkeiten an={k.isSubscribed} />
                  {marke && (
                    <span className="shrink-0">
                      <StatusBadge status={marke.ton}>{marke.text}</StatusBadge>
                    </span>
                  )}
                </span>
                <span className={cn('mt-0.5 block truncate text-[13px]', LEISE)}>
                  {mitAnzahl(k.orderCount, 'Bestellung', 'Bestellungen')} · {zuletztText(k.daysSinceLastOrder)}
                </span>
                {k.topProducts.length > 0 && (
                  <span className={cn('block truncate text-[13px]', LEISE)}>Häufig: {k.topProducts.slice(0, 2).map((p) => p.name).join(', ')}</span>
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
