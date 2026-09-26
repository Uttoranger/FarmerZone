'use client'

import { useState } from 'react'
import Link from 'next/link'
import { X } from 'lucide-react'
import HoefeKarte, { type KartenHof } from '@/components/hoefe/hoefe-karte'
import { LEERE_LAGE, nachLeerTipp, nachPinTipp, type AuswahlLage } from '@/lib/hoefe-anzeige'
import type { UmfeldKarte } from '@/lib/umfeld'

/**
 * Die Karte des Umfelds — die Kartenkomponente von /hoefe, nicht eine zweite.
 * Diese Datei ist nur der schmale Adapter: Umfeld-Pins → KartenHof, dazu der
 * eigene Hof als Zentrum mit Umkreis-Kreis und die Karte unter dem Pin.
 *
 * Sie wird von umfeld-anzeige.tsx per dynamic import geladen, erst wenn die
 * Ansicht „Karte" gewählt ist — mit ihr kommt Leaflet. Die Auswertung selbst
 * lädt kein Leaflet (tests/umfeld-karte.test.ts prüft das am Import-Graph).
 *
 * Welche Pins es gibt, hat baueUmfeldKarte (src/lib/umfeld.ts) entschieden:
 * genau die Höfe, die die Liste zählt. Hier wird nichts mehr gefiltert.
 */
export default function UmfeldKarteAnsicht({ karte, eigenerName }: { karte: UmfeldKarte; eigenerName: string }) {
  const [lage, setLage] = useState<AuswahlLage>(LEERE_LAGE)
  const hoefe: KartenHof[] = karte.pins.map(({ slug, nummer, lat, lon }) => ({ slug, nummer, lat, lon }))
  const gewaehlt = karte.pins.find((p) => p.slug === lage.ausgewaehlt) ?? null

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <HoefeKarte
        hoefe={hoefe}
        lage={lage}
        fokus={0}
        attributionOben
        hoeheKlasse="h-[60vh] min-h-[320px]"
        zentrum={{ ...karte.zentrum, titel: `${eigenerName} (dein Hof)` }}
        onAuswahl={(slug) => setLage((l) => nachPinTipp(l, slug))}
        onLeerTipp={() => setLage((l) => nachLeerTipp(l))}
      />
      {gewaehlt && (
        // Über den Leaflet-Ebenen (400) und unter den Bedienteilen (1000).
        <div
          role="dialog"
          aria-label={gewaehlt.name}
          className="absolute inset-x-3 bottom-3 z-[500] rounded-xl border border-border bg-card p-4 shadow-lg dark:ring-1 dark:ring-border"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-semibold text-foreground">{gewaehlt.name}</p>
              <p className="text-sm text-muted-foreground tabular-nums">{gewaehlt.entfernung}</p>
            </div>
            <button
              type="button"
              aria-label="Schließen"
              onClick={() => setLage((l) => nachLeerTipp(l))}
              className="-mr-2 -mt-2 inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
          <p className="mt-2 text-sm text-foreground tabular-nums">
            {gewaehlt.guenstigster ? `Günstigster Grundpreis: ${gewaehlt.guenstigster}` : 'Kein vergleichbarer Grundpreis'}
          </p>
          <Link
            href={gewaehlt.link}
            className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-brand-text underline-offset-4 hover:underline"
          >
            Zur Hofseite
          </Link>
        </div>
      )}
    </div>
  )
}
