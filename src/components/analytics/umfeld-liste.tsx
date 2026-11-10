'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { mitAnzahl } from '@/lib/format'
import { UMFELD_HOEFE_SICHTBAR, type UmfeldZeile } from '@/lib/umfeld'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN, FOKUS_RAHMEN_INNEN } from '@/components/ui/fokus'
import { KARTE } from '@/components/hof-bestellungen/stil'

/** Der Schlusssatz unter den Höfen einer offenen Sorte (Board s1-/w1-region Bild 1). */
export const KAUFEN_UEBER_HOFSEITE = 'Kaufen geht über die Hofseite.'

/**
 * Die zweite Zeile einer Sorte: „5 Höfe · € 1,43 – 1,60 · Mitte € 1,52“ (Board s1-/w1-region Bild 1, Liste
 * Lauf 32 „Sortenzeile“). Trägt die Zeile zwei Gebindeklassen, steht jede mit ihrem Namen dahinter; ist kein
 * fremdes Produkt vergleichbar, steht der Grund in der Zeile (Register N23, Änderung 21.10.2026). Nur
 * Anordnung — Spanne, Mitte und Grund hat src/lib/umfeld.ts formatiert.
 */
export function sortenUnterzeile(zeile: Pick<UmfeldZeile, 'anzahlText' | 'preise' | 'hinweis'>): string {
  const teile = [zeile.anzahlText]
  for (const preis of zeile.preise) {
    if (!preis.spanne) continue
    teile.push(preis.klasse ? `${preis.klasse} ${preis.spanne}` : preis.spanne)
    if (preis.mitte) teile.push(preis.mitte)
  }
  if (zeile.hinweis) teile.push(zeile.hinweis)
  return teile.join(' · ')
}

/**
 * Die Zeilen des Umfelds. Alles, was hier steht, hat src/lib/umfeld.ts schon
 * entschieden und formatiert — die Komponente klappt nur auf und zu.
 *
 * Seit Nr. 272 nach Board s1-/w1-region Bild 1: EINE Karte mit Trennlinien
 * statt einer Karte je Sorte; je Sorte der Name fett, darunter „n Höfe ·
 * Spanne · Mitte“, „Deins“ rechts neben dem Pfeil; aufgeklappt eine Zeile je
 * Hof („Hof am Bach · 4 km · Heumilch € 1,43 / L“) und der Schluss
 * „1 weiterer Hof · Kaufen geht über die Hofseite.“ — Rahmen neutral.
 */
export function UmfeldListe({ zeilen }: { zeilen: UmfeldZeile[] }) {
  const [offen, setOffen] = useState<string | null>(null)
  const [alleHoefe, setAlleHoefe] = useState<ReadonlySet<string>>(new Set())

  return (
    <ul className={cn(KARTE, 'divide-y divide-border overflow-hidden')}>
      {zeilen.map((zeile) => {
        const istOffen = offen === zeile.schluessel
        const panelId = `umfeld-${zeile.schluessel.replace(/[^a-zA-Z0-9_-]/g, '-')}`
        const zeigeAlle = alleHoefe.has(zeile.schluessel)
        const sichtbar = zeigeAlle ? zeile.hoefe : zeile.hoefe.slice(0, UMFELD_HOEFE_SICHTBAR)
        const weitere = zeile.hoefe.length - sichtbar.length
        const deins = zeile.preise.flatMap((p) => (p.deins ? [p.deins] : []))
        const deinsOhnePreis = zeile.eigenesProdukt && deins.length === 0
        return (
          <li key={zeile.schluessel}>
            <button
              type="button"
              aria-expanded={istOffen}
              aria-controls={istOffen ? panelId : undefined}
              onClick={() => setOffen(istOffen ? null : zeile.schluessel)}
              className={cn('flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted', FOKUS_RAHMEN_INNEN)}
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] font-semibold text-foreground" title={zeile.titel}>
                  {zeile.titel}
                </span>
                <span className="text-[13px] leading-snug text-muted-foreground tabular-nums">{sortenUnterzeile(zeile)}</span>
              </span>
              {deins.map((wert) => (
                <span
                  key={wert}
                  className="shrink-0 rounded-full bg-accent/12 px-2.5 py-0.5 text-[13px] font-semibold whitespace-nowrap text-status-fertig tabular-nums"
                >
                  Deins: {wert}
                </span>
              ))}
              {deinsOhnePreis && (
                <span className="shrink-0 rounded-full bg-accent/12 px-2.5 py-0.5 text-[13px] font-semibold text-status-fertig">Deins</span>
              )}
              <ChevronDown
                aria-hidden="true"
                className={cn('size-4 shrink-0 text-foreground transition-transform', istOffen && 'rotate-180')}
              />
            </button>

            {istOffen && (
              <div id={panelId} className="px-4 pb-3">
                <ul className="flex flex-col">
                  {sichtbar.map((hof) => (
                    <li key={hof.slug} className="flex min-h-11 flex-wrap items-center gap-x-1 text-[14px] text-foreground tabular-nums">
                      {/* Der Hofname führt zur Hofseite — 44 px hoch, ein Tap-Ziel. */}
                      <Link
                        href={hof.link}
                        title={`${hof.name}, ${hof.ort}`}
                        className={cn('inline-flex min-h-11 items-center underline-offset-4 hover:underline', FOKUS_RAHMEN)}
                      >
                        {hof.name}
                      </Link>
                      <span aria-hidden="true">·</span>
                      <span>{hof.entfernung}</span>
                      {hof.produkte.map((produkt, i) => (
                        <span key={`${produkt.name}-${i}`}>
                          <span aria-hidden="true">· </span>
                          {produkt.name} {produkt.preis}
                        </span>
                      ))}
                    </li>
                  ))}
                </ul>

                <p className="flex flex-wrap items-center gap-x-1 text-[13px] text-muted-foreground">
                  {weitere > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setAlleHoefe(new Set([...alleHoefe, zeile.schluessel]))}
                        className={cn('inline-flex min-h-11 items-center underline-offset-4 hover:underline', FOKUS_RAHMEN)}
                      >
                        {mitAnzahl(weitere, 'weiterer Hof', 'weitere Höfe')}
                      </button>
                      <span aria-hidden="true">·</span>
                    </>
                  )}
                  <span className={cn(weitere === 0 && 'py-2')}>{KAUFEN_UEBER_HOFSEITE}</span>
                </p>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
