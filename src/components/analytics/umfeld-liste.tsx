'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { mitAnzahl } from '@/lib/format'
import { UMFELD_HOEFE_SICHTBAR, UMFELD_TEXT, type UmfeldPreis, type UmfeldZeile } from '@/lib/umfeld'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { HofKopf } from '@/components/hoefe/hof-kopf'
import { HoefeProduktzeilen } from '@/components/hoefe/hoefe-produktzeilen'
import { PreisStreifen } from '@/components/region/preis-streifen'

/** „Deins" als grüne Marke — dieselbe Gestalt mit und ohne Preis. */
const DEINS_MARKE =
  'inline-block rounded-full border border-accent/45 bg-accent/12 px-2 py-0.5 text-[11.5px] font-semibold whitespace-nowrap text-status-fertig tabular-nums'

/**
 * Die Zeilen des Umfelds. Alles, was hier steht, hat src/lib/umfeld.ts schon
 * entschieden und formatiert — die Komponente klappt nur auf und zu.
 *
 * Je Spanne der Streifen nach Board v3 §2 (PreisStreifen), daneben bzw.
 * darunter der Text der Spanne und „Deins" mit der Lage. Am Computer stehen
 * Sorte (150 px), Streifen (270 px) und Text nebeneinander; am Handy ist die
 * Zeile zweizeilig: oben Sorte und Anzahl, darunter der Streifen über die
 * volle Breite, dann der Text (Konzept Umfeld §4 „Mobil"). Keine Tabelle,
 * die seitlich scrollt.
 *
 * Aufgeklappt je Hof der Kopf wie auf /hoefe (Bild 40, als Link zur
 * Hofseite) und die Produktzeile des Produkts, das in dieser Zeile zählt —
 * nach Entfernung, nie nach Preis (N23).
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
              <span className="flex min-w-0 flex-1 flex-col md:flex-row md:items-center md:gap-[22px]">
                <span className="flex min-w-0 items-baseline justify-between gap-3 md:w-[150px] md:flex-none md:flex-col md:items-start md:justify-start md:gap-0">
                  <span className="min-w-0 truncate text-[14.5px] font-semibold text-foreground" title={zeile.titel}>
                    {zeile.titel}
                  </span>
                  <span className="shrink-0 text-[13px] text-muted-foreground tabular-nums">{zeile.anzahlText}</span>
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-2">
                  {zeile.preise.map((preis) => (
                    <PreisZeile key={preis.klasse ?? 'alle'} preis={preis} />
                  ))}
                  {zeile.hinweis && <span className="mt-1 block text-sm text-muted-foreground md:mt-0">{zeile.hinweis}</span>}
                  {deinsOhnePreis && <span className={cn('self-start', DEINS_MARKE)}>Deins</span>}
                </span>
              </span>
              <ChevronDown
                aria-hidden="true"
                className={cn('mt-1 size-4 shrink-0 text-muted-foreground transition-transform', istOffen && 'rotate-180')}
              />
            </button>

            {istOffen && (
              <div id={panelId} className="border-t border-border px-4 pb-4 pt-3">
                <ul className="space-y-4">
                  {sichtbar.map((hof) => (
                    <li key={hof.slug}>
                      {/* Der Kopf ist der Link zur Hofseite — Bild 40, Name, Entfernung, PLZ und Ort (HofKopf, N23). */}
                      <Link href={hof.link} className={cn('block rounded-lg', FOKUS_RAHMEN)}>
                        <HofKopf
                          hof={hof}
                          als="p"
                          bild={{ foto: hof.foto, illustration: hof.illustration, kante: 40 }}
                        />
                      </Link>
                      <HoefeProduktzeilen produkte={hof.produkte} weitere={0} bildKante={40} />
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

                <p className="mt-3 text-xs text-muted-foreground">{UMFELD_TEXT.kaufen}</p>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** Eine Spanne: Klasse (nur bei zwei), Streifen, Text der Spanne und „Deins". */
function PreisZeile({ preis }: { preis: UmfeldPreis }) {
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      {preis.klasse && <span className="mt-1 text-xs text-muted-foreground md:mt-0">{preis.klasse}</span>}
      <span className="flex min-w-0 flex-col md:flex-row md:items-center md:gap-[22px]">
        {preis.streifen && <PreisStreifen streifen={preis.streifen} className="mt-2 w-full md:mt-0 md:w-[270px]" />}
        <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 md:mt-0 md:flex-col md:items-start">
          {preis.spanne && (
            <span className="text-[13.5px] text-foreground tabular-nums">
              {preis.spanne}
              {preis.mitte && <span className="text-muted-foreground"> · {preis.mitte}</span>}
              {preis.zusatz && <span className="text-muted-foreground"> · {preis.zusatz}</span>}
            </span>
          )}
          {preis.deins && <span className={DEINS_MARKE}>{preis.deins}</span>}
        </span>
      </span>
    </span>
  )
}
