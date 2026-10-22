'use client'

import { useRef, useState } from 'react'
import HoefeKarte, { type KartenHof } from '@/components/hoefe/hoefe-karte'
import { HofKurzkarte } from '@/components/hoefe/hof-kurzkarte'
import { HoefeProduktzeilen } from '@/components/hoefe/hoefe-produktzeilen'
import { LEERE_LAGE, nachLeerTipp, nachPinTipp, type AuswahlLage } from '@/lib/hoefe-anzeige'
import type { UmfeldKarte } from '@/lib/umfeld'

/** Ungefähre Höhe der Karte am Pin (Kopf mit Bild 40, zwei Produktzeilen, „Zum Hof"). */
const PIN_KARTE_HOEHE = 230

/**
 * Die Karte des Umfelds — die Kartenkomponente von /hoefe, nicht eine zweite.
 * Diese Datei ist nur der schmale Adapter: Umfeld-Pins → KartenHof (mit Namen
 * nach der Regel von /hoefe, N23), dazu der eigene Hof als Zentrum („Du") mit
 * Umkreis-Kreis und die Karte am Pin.
 *
 * Die Karte am Pin ist `HofKurzkarte` in der Art „region" (Freigabe §1
 * Abweichung 7): Antippen bzw. Enter am Pin öffnet sie als Bereich mit
 * „Schließen" und Escape; darin der Kopf, die ersten zwei kaufbaren Produkte
 * als Produktzeilen (Kante 40) und „Zum Hof". Eine Abholzeile gibt es hier
 * bewusst nicht (Board v2 §1). Den Link baut die Kurzkarte aus Slug und
 * Bereich der Karte — keine Kopie hier.
 *
 * Sie wird von umfeld-anzeige.tsx per dynamic import geladen, erst wenn die
 * Ansicht „Karte" gewählt ist — mit ihr kommt Leaflet. Region selbst lädt
 * kein Leaflet (tests/umfeld-karte.test.ts prüft das am Import-Graph).
 *
 * Welche Pins es gibt, hat baueUmfeldKarte (src/lib/umfeld.ts) entschieden:
 * genau die Höfe, die die Liste zählt. Hier wird nichts mehr gefiltert.
 */
export default function UmfeldKarteAnsicht({ karte, eigenerName }: { karte: UmfeldKarte; eigenerName: string }) {
  const [lage, setLage] = useState<AuswahlLage>(LEERE_LAGE)
  const rahmen = useRef<HTMLDivElement>(null)
  const hoefe: KartenHof[] = karte.pins.map(({ slug, nummer, lat, lon, name }) => ({ slug, nummer, lat, lon, name }))
  const gewaehlt = karte.pins.find((p) => p.slug === lage.ausgewaehlt) ?? null

  return (
    // `isolate`: eine eigene Stapelebene. Sonst stünden Leaflets Ebenen (400)
    // und Bedienteile (1000) im selben Stapel wie die feste Bauern-Leiste
    // (z-50) und lägen beim Scrollen über ihr.
    <div ref={rahmen} className="relative isolate overflow-hidden rounded-2xl">
      <HoefeKarte
        hoefe={hoefe}
        lage={lage}
        fokus={0}
        attributionOben
        hoeheKlasse="h-[60vh] min-h-[320px]"
        // So viel hält der Ausschnitt unten frei, wie die Karte am Pin hoch
        // ist — sonst lägen die südlichsten Höfe dahinter.
        polsterUnten={PIN_KARTE_HOEHE}
        zentrum={{ ...karte.zentrum, titel: `${eigenerName} (dein Hof)` }}
        onAuswahl={(slug) => setLage((l) => nachPinTipp(l, slug))}
        onLeerTipp={() => setLage((l) => nachLeerTipp(l))}
      />
      {gewaehlt && (
        // Über den Leaflet-Ebenen (400) und unter den Bedienteilen (1000); am
        // Handy über die volle Breite, am Computer 320 px links unten.
        <div className="absolute inset-x-3 bottom-3 z-[500] sm:right-auto sm:w-80">
          <HofKurzkarte
            art="region"
            id={`umfeld-pin-${gewaehlt.slug}`}
            bereich={karte.bereich}
            // Region zeigt nur Höfe, die gerade verkaufen (nicht pausiert, Query);
            // `angebot` braucht die Art „region" nicht — die Produkte stehen als Kinder da.
            hof={{ ...gewaehlt, isPaused: false, angebot: gewaehlt.produkte }}
            onSchliessen={() => setLage((l) => nachLeerTipp(l))}
            // Die Karte zeichnet ihre Pins nach einer Auswahl neu — der Fokus geht an den neuen.
            findePin={() => rahmen.current?.querySelector<HTMLElement>(`[data-pin="${CSS.escape(gewaehlt.slug)}"]`) ?? null}
          >
            <HoefeProduktzeilen produkte={gewaehlt.produkte} weitere={0} bildKante={40} />
          </HofKurzkarte>
        </div>
      )}
    </div>
  )
}
