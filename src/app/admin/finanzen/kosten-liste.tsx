'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { formatEuro } from '@/lib/format'
import { centsAlsEuro, type Monatsschluessel } from '@/lib/servicegebuehr'
import { KOSTEN_KATEGORIE_LABEL, KOSTEN_RHYTHMUS_LABEL } from '@/lib/finanzen'
import type { KostenpostenZeile } from '@/server/queries/finanzen'
import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/status-badge'
import { FOKUS_RAHMEN_INNEN } from '@/components/ui/fokus'
import { KARTE, KNOPF_RAHMEN, LEISE } from '@/components/hof-bestellungen/stil'
import { KostenSheet, type SheetZustand } from './kosten-sheet'

/**
 * „Kosten der Plattform" des angezeigten Monats (Mockup admin-finanzen; im
 * neuen Design seit Nr. 22f). Gezeigt wird, was im Monat tatsächlich kostet —
 * ein beendeter Posten steht in den Monaten, in denen er lief, nicht in allen
 * folgenden.
 *
 * Bei einem Jahresposten stehen zwei Beträge da: der Anteil DIESES Monats groß
 * und der Jahresbetrag klein darunter. Ohne den zweiten wäre „8,34 €
 * jährlich" nicht zu verstehen. Eintragen und Bearbeiten laufen unverändert
 * über das Blatt (KostenSheet) und seine Actions.
 */
export function KostenListe({
  monat,
  bezeichnung,
  posten,
  summeCents,
}: {
  monat: Monatsschluessel
  bezeichnung: string
  posten: KostenpostenZeile[]
  summeCents: number
}): React.JSX.Element {
  const [sheet, setSheet] = useState<SheetZustand>(null)

  return (
    <section aria-labelledby="kosten-titel" className={cn(KARTE, 'flex flex-col p-4 md:p-[18px]')}>
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
        <h2 id="kosten-titel" className="font-heading text-[17px] font-semibold text-foreground">
          Kosten der Plattform
        </h2>
        <button type="button" onClick={() => setSheet({ art: 'neu' })} className={KNOPF_RAHMEN}>
          <Plus className="size-4" strokeWidth={1.7} aria-hidden="true" />
          Kostenposten
        </button>
      </div>

      {posten.length === 0 ? (
        <p className={cn('border-t border-border py-4 text-[14px]', LEISE)}>Für {bezeichnung} sind keine Kosten eingetragen.</p>
      ) : (
        <ul className="[&>li]:border-t [&>li]:border-border">
          {posten.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setSheet({ art: 'bearbeiten', posten: p })}
                className={cn('flex min-h-[52px] w-full items-center gap-3 rounded-lg py-2.5 text-left hover:bg-muted', FOKUS_RAHMEN_INNEN)}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] text-foreground" title={p.name}>
                    {p.name}
                  </span>
                  <span className={cn('block truncate text-[12.5px]', LEISE)}>
                    {KOSTEN_RHYTHMUS_LABEL[p.rhythmus]}
                    {p.rhythmus === 'JAEHRLICH' && ` · ${formatEuro(centsAlsEuro(p.betragCents))} im Jahr`}
                    {p.notiz !== null && p.notiz !== '' && ` · ${p.notiz}`}
                  </span>
                </span>
                <StatusBadge status="neutral" className="hidden shrink-0 sm:inline-flex">
                  {KOSTEN_KATEGORIE_LABEL[p.kategorie]}
                </StatusBadge>
                <span className="shrink-0 text-[14.5px] font-semibold text-foreground tabular-nums">
                  {formatEuro(centsAlsEuro(p.imMonatCents))}
                </span>
                <span className="sr-only">bearbeiten</span>
              </button>
            </li>
          ))}
          <li className="flex items-center justify-between gap-3 pt-3">
            <span className="text-[15px] font-semibold text-foreground">Summe im Monat</span>
            <span className="text-[15px] font-semibold text-foreground tabular-nums">{formatEuro(centsAlsEuro(summeCents))}</span>
          </li>
        </ul>
      )}

      <KostenSheet zustand={sheet} onClose={() => setSheet(null)} monat={monat} />
    </section>
  )
}
