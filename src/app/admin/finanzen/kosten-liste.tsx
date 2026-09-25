'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatEuro } from '@/lib/format'
import { centsAlsEuro, type Monatsschluessel } from '@/lib/servicegebuehr'
import { KOSTEN_KATEGORIE_LABEL, KOSTEN_RHYTHMUS_LABEL } from '@/lib/finanzen'
import type { KostenpostenZeile } from '@/server/queries/finanzen'
import { KostenSheet, type SheetZustand } from './kosten-sheet'

/**
 * Die Kosten des angezeigten Monats. Gezeigt wird, was im Monat tatsächlich
 * kostet — ein beendeter Posten steht in den Monaten, in denen er lief, nicht
 * in allen folgenden.
 *
 * Bei einem Jahresposten stehen zwei Beträge nebeneinander: der Anteil DIESES
 * Monats groß und der Jahresbetrag klein daneben. Ohne den zweiten wäre „8,34 €
 * jährlich" nicht zu verstehen.
 */
export function KostenListe({
  monat,
  bezeichnung,
  posten,
}: {
  monat: Monatsschluessel
  bezeichnung: string
  posten: KostenpostenZeile[]
}) {
  const [sheet, setSheet] = useState<SheetZustand>(null)

  return (
    <section className="rounded-xl border border-border bg-card">
      <h2 className="border-b border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Kosten
      </h2>

      {posten.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted-foreground">
          Für {bezeichnung} sind keine Kosten eingetragen.
        </p>
      ) : (
        <ul>
          {posten.map((p) => (
            <li key={p.id} className="border-b border-border last:border-b-0">
              <button
                type="button"
                onClick={() => setSheet({ art: 'bearbeiten', posten: p })}
                className="flex min-h-11 w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {p.name} · {KOSTEN_KATEGORIE_LABEL[p.kategorie]}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {KOSTEN_RHYTHMUS_LABEL[p.rhythmus]}
                    {p.rhythmus === 'JAEHRLICH' &&
                      ` · ${formatEuro(centsAlsEuro(p.betragCents))} im Jahr`}
                  </span>
                  {p.notiz !== null && p.notiz !== '' && (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {p.notiz}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                  {formatEuro(centsAlsEuro(p.imMonatCents))}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="p-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => setSheet({ art: 'neu' })}
          className="min-h-11 w-full"
        >
          <Plus className="size-4" aria-hidden="true" />
          Kosten eintragen
        </Button>
      </div>

      <KostenSheet zustand={sheet} onClose={() => setSheet(null)} monat={monat} />
    </section>
  )
}
