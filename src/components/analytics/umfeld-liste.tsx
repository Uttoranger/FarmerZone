'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { mitAnzahl } from '@/lib/format'
import { UMFELD_HOEFE_SICHTBAR, type UmfeldZeile } from '@/lib/umfeld'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'

/**
 * Die Zeilen des Umfelds. Alles, was hier steht, hat src/lib/umfeld.ts schon
 * entschieden und formatiert — die Komponente klappt nur auf und zu.
 *
 * Mobil (375 px) zweizeilig: oben Sorte und Anzahl, darunter die Spanne,
 * „Deins" als Chip. Keine Tabelle, die seitlich scrollt.
 */
export function UmfeldListe({ zeilen }: { zeilen: UmfeldZeile[] }) {
  const [offen, setOffen] = useState<string | null>(null)
  const [alleHoefe, setAlleHoefe] = useState<ReadonlySet<string>>(new Set())

  return (
    <ul className="space-y-2">
      {zeilen.map((zeile) => {
        const istOffen = offen === zeile.schluessel
        const panelId = `umfeld-${zeile.schluessel.replace(/[^a-zA-Z0-9_-]/g, '-')}`
        const zeigeAlle = alleHoefe.has(zeile.schluessel)
        const sichtbar = zeigeAlle ? zeile.hoefe : zeile.hoefe.slice(0, UMFELD_HOEFE_SICHTBAR)
        const weitere = zeile.hoefe.length - sichtbar.length
        const deinsOhnePreis = zeile.eigenesProdukt && !zeile.preise.some((p) => p.deins)
        return (
          <li
            key={zeile.schluessel}
            className={cn('rounded-[14px] border bg-card', istOffen ? 'border-accent' : 'border-border')}
          >
            <button
              type="button"
              aria-expanded={istOffen}
              aria-controls={istOffen ? panelId : undefined}
              onClick={() => setOffen(istOffen ? null : zeile.schluessel)}
              className={cn('flex w-full items-start gap-3 rounded-[14px] px-4 py-3 text-left', FOKUS_RAHMEN)}
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-[14.5px] font-semibold text-foreground">{zeile.titel}</span>
                  <span className="shrink-0 text-sm text-muted-foreground tabular-nums">{zeile.anzahlText}</span>
                </span>
                {zeile.preise.map((preis) => (
                  <span key={preis.klasse ?? 'alle'} className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    {preis.klasse && <span className="text-xs text-muted-foreground">{preis.klasse}</span>}
                    {preis.spanne && (
                      <span className="text-foreground tabular-nums">
                        {preis.spanne}
                        {preis.mitte && <span className="text-muted-foreground"> · {preis.mitte}</span>}
                      </span>
                    )}
                    {preis.deins && (
                      <span className="rounded-full border border-accent/45 bg-accent/12 px-2 py-0.5 text-[11.5px] font-semibold text-status-fertig tabular-nums">
                        Deins: {preis.deins}
                      </span>
                    )}
                  </span>
                ))}
                {zeile.hinweis && <span className="mt-1 block text-sm text-muted-foreground">{zeile.hinweis}</span>}
                {deinsOhnePreis && (
                  <span className="mt-1 inline-block rounded-full border border-accent/45 bg-accent/12 px-2 py-0.5 text-[11.5px] font-semibold text-status-fertig">
                    Deins
                  </span>
                )}
              </span>
              <ChevronDown
                aria-hidden="true"
                className={cn('mt-1 size-4 shrink-0 text-muted-foreground transition-transform', istOffen && 'rotate-180')}
              />
            </button>

            {istOffen && (
              <div id={panelId} className="border-t border-border px-4 pb-4 pt-3">
                <ul className="space-y-3">
                  {sichtbar.map((hof) => (
                    <li key={hof.slug}>
                      <div className="flex items-center justify-between gap-3">
                        {/* 44 px hoch — ein Tap-Ziel, keine bloße Textzeile. */}
                        <Link
                          href={hof.link}
                          className={cn('flex min-h-11 min-w-0 items-center font-semibold text-brand-text underline-offset-4 hover:underline', FOKUS_RAHMEN)}
                        >
                          <span className="truncate" title={hof.name}>{hof.name}</span>
                        </Link>
                        <span className="shrink-0 text-sm text-muted-foreground tabular-nums">{hof.entfernung}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{hof.ort}</p>
                      <ul className="mt-1 space-y-0.5">
                        {hof.produkte.map((produkt, i) => (
                          <li key={`${produkt.name}-${i}`} className="flex justify-between gap-3 text-sm">
                            <span className="min-w-0 truncate text-foreground">{produkt.name}</span>
                            <span className="shrink-0 text-muted-foreground tabular-nums">{produkt.preis}</span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>

                {weitere > 0 && (
                  <button
                    type="button"
                    onClick={() => setAlleHoefe(new Set([...alleHoefe, zeile.schluessel]))}
                    className={cn('mt-3 min-h-11 text-sm font-semibold text-brand-text underline-offset-4 hover:underline', FOKUS_RAHMEN)}
                  >
                    {mitAnzahl(weitere, 'weiterer Hof', 'weitere Höfe')}
                  </button>
                )}

                <p className="mt-3 text-xs text-muted-foreground">Kaufen geht über die Hofseite.</p>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
