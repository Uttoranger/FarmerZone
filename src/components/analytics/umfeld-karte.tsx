'use client'

import { useState } from 'react'
import Link from 'next/link'
import HoefeKarte, { type KartenHof } from '@/components/hoefe/hoefe-karte'
import { LEERE_LAGE, nachLeerTipp, nachPinTipp, type AuswahlLage } from '@/lib/hoefe-anzeige'
import type { UmfeldKarte } from '@/lib/umfeld'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { KARTE, KNOPF_RAHMEN } from '@/components/hof-bestellungen/stil'
import { REGION_KARTE_HOEHE } from '@/components/region/region-spalten'
import { cn } from '@/lib/utils'

/**
 * Die Karte des Umfelds — die Kartenkomponente von /hoefe, nicht eine zweite.
 * Diese Datei ist nur der schmale Adapter: Umfeld-Pins → KartenHof, dazu der
 * eigene Hof als Zentrum mit Umkreis-Kreis und die Karte unter dem Pin.
 *
 * Sie wird von umfeld-anzeige.tsx per dynamic import geladen, erst wenn die
 * Ansicht „Karte" gewählt ist — mit ihr kommt Leaflet. Die Auswertung selbst
 * bzw. Region lädt kein Leaflet (tests/umfeld-karte.test.ts prüft das am Import-Graph).
 *
 * Welche Pins es gibt, hat baueUmfeldKarte (src/lib/umfeld.ts) entschieden:
 * genau die Höfe, die die Liste zählt. Hier wird nichts mehr gefiltert.
 *
 * Seit Nr. 272 (Liste Lauf 32 region, Board s1-/w1-region Bild 6): die
 * Quellenangabe unten rechts, der gewählte Hof als Feld UNTER der Karte mit
 * „Schließen“ statt eines Kastens über den Pins — so verdeckt nichts die
 * südlichen Höfe, und der Ausschnitt braucht kein Polster unten.
 */
export default function UmfeldKarteAnsicht({ karte, eigenerName }: { karte: UmfeldKarte; eigenerName: string }) {
  const [lage, setLage] = useState<AuswahlLage>(LEERE_LAGE)
  const hoefe: KartenHof[] = karte.pins.map(({ slug, nummer, lat, lon }) => ({ slug, nummer, lat, lon }))
  const gewaehlt = karte.pins.find((p) => p.slug === lage.ausgewaehlt) ?? null

  return (
    <div className="flex flex-col gap-3">
      {/* `isolate`: eine eigene Stapelebene. Sonst stünden Leaflets Ebenen (400) und Bedienteile (1000) im selben
          Stapel wie die feste Bauern-Leiste (z-50) und lägen beim Scrollen über ihr. */}
      <div className="relative isolate overflow-hidden rounded-2xl">
        <HoefeKarte
          hoefe={hoefe}
          lage={lage}
          fokus={0}
          hoeheKlasse={REGION_KARTE_HOEHE}
          zentrum={{ ...karte.zentrum, titel: `${eigenerName} (dein Hof)` }}
          onAuswahl={(slug) => setLage((l) => nachPinTipp(l, slug))}
          onLeerTipp={() => setLage((l) => nachLeerTipp(l))}
        />
      </div>
      {gewaehlt && (
        // Unter der Karte, nicht über den Pins (Liste Lauf 32 region, Bild 6).
        <div role="region" aria-label={gewaehlt.name} className={cn(KARTE, 'p-4')}>
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 pt-2 text-[15px] font-semibold text-foreground tabular-nums">
              <span className="truncate" title={gewaehlt.name}>
                {gewaehlt.nummer} · {gewaehlt.name}
              </span>{' '}
              · {gewaehlt.entfernung}
            </p>
            {/* „Schließen“ als Wort statt „×“ (Register N23: der Bereich geht mit „Schließen“ auf). */}
            <button type="button" onClick={() => setLage((l) => nachLeerTipp(l))} className={cn(KNOPF_RAHMEN, 'min-h-11 shrink-0 px-4')}>
              Schließen
            </button>
          </div>
          <p className="mt-2 text-sm text-foreground tabular-nums">
            {gewaehlt.guenstigster ? `Günstigster Grundpreis: ${gewaehlt.guenstigster}` : 'Kein vergleichbarer Grundpreis'}
          </p>
          <Link
            href={gewaehlt.link}
            className={cn('mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-brand-text underline-offset-4 hover:underline', FOKUS_RAHMEN)}
          >
            Zur Hofseite
          </Link>
        </div>
      )}
    </div>
  )
}
