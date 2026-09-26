'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, MapPin } from 'lucide-react'
import { mitAnzahl } from '@/lib/format'
import { UMFELD_HOEFE_SICHTBAR, type UmfeldZeile } from '@/lib/umfeld'
import { cn } from '@/lib/utils'

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
          <li key={zeile.schluessel} className="rounded-xl border border-border bg-card dark:ring-1 dark:ring-border">
            <button
              type="button"
              aria-expanded={istOffen}
              aria-controls={panelId}
              onClick={() => setOffen(istOffen ? null : zeile.schluessel)}
              className="flex w-full items-start gap-3 rounded-xl px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate font-semibold text-foreground">{zeile.titel}</span>
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
                      <span className="rounded-full bg-app-chip-green px-2 py-0.5 text-xs font-semibold text-app-ink tabular-nums">
                        Deins: {preis.deins}
                      </span>
                    )}
                  </span>
                ))}
                {zeile.hinweis && <span className="mt-1 block text-sm text-muted-foreground">{zeile.hinweis}</span>}
                {deinsOhnePreis && (
                  <span className="mt-1 inline-block rounded-full bg-app-chip-green px-2 py-0.5 text-xs font-semibold text-app-ink">
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
                      <div className="flex items-baseline justify-between gap-3">
                        <Link href={hof.link} className="min-w-0 truncate font-semibold text-brand-text underline-offset-4 hover:underline">
                          {hof.name}
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
                    className="mt-3 min-h-11 text-sm font-semibold text-brand-text underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {mitAnzahl(weitere, 'weiterer Hof', 'weitere Höfe')}
                  </button>
                )}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                  {zeile.kartenLink && (
                    <Link
                      href={zeile.kartenLink}
                      className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brand-text underline-offset-4 hover:underline"
                    >
                      <MapPin className="size-4" aria-hidden="true" />
                      Auf der Karte zeigen
                    </Link>
                  )}
                  <p className="text-xs text-muted-foreground">Kaufen geht über die Hofseite.</p>
                </div>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
