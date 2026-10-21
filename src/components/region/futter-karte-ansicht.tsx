'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import HoefeKarte, { type KartenHof } from '@/components/hoefe/hoefe-karte'
import { HofKurzkarte } from '@/components/hoefe/hof-kurzkarte'
import { Abholzeile } from '@/components/hoefe/abholzeile'
import { KNOPF_GRUEN } from '@/components/hof-bestellungen/stil'
import { LEERE_LAGE, nachLeerTipp, nachPinTipp, type AuswahlLage } from '@/lib/hoefe-anzeige'
import { FUTTER_KARTE_TEXT, type FutterKaufenAnsicht, type FutterPinKarte } from '@/lib/futter-kaufen'
import { cn } from '@/lib/utils'

/** Ungefähre Höhe der Karte am Pin (Kopf, zwei Zeilen, Abholzeile, Grundpreis, Knopf). */
const PIN_KARTE_HOEHE = 300

/**
 * Die Karte von „Futter kaufen" (Register N23; Board system-h5-region-v2,
 * Handy 4) — die Kartenkomponente von /hoefe, nicht eine zweite: Pins sind die
 * Höfe der gezeigten Angebote mit Namen nach der Regel von /hoefe, dazu „Du"
 * und der Umkreis; nie ein Preis am Pin. Antippen bzw. Enter am Pin öffnet die
 * kurze Hofkarte in der Art „region" (Bereich mit „Schließen", Freigabe §1
 * Abweichung 7): das erste Angebot des Hofs mit zwei Größen samt Preis, die
 * Abholzeile, „Grundpreis ab …" und „Bestellen" (vorgewählte Größe).
 *
 * Geladen per dynamic import erst beim Umschalten (futter-kaufen-ansicht.tsx)
 * — mit ihr kommt Leaflet (tests/futter-karte-import.test.ts).
 */
export default function FutterKarteAnsicht({ karte, jetzt }: { karte: FutterKaufenAnsicht['karte']; jetzt: string }): React.JSX.Element {
  const [lage, setLage] = useState<AuswahlLage>(LEERE_LAGE)
  const rahmen = useRef<HTMLDivElement>(null)
  const hoefe: KartenHof[] = karte.pins.map(({ slug, nummer, lat, lon, name }) => ({ slug, nummer, lat, lon, name }))
  const gewaehlt = lage.ausgewaehlt ? (karte.karten[lage.ausgewaehlt] ?? null) : null

  return (
    // `isolate`: eine eigene Stapelebene — sonst lägen Leaflets Ebenen (400)
    // beim Scrollen über der festen Leiste der Shell (z-50).
    <div ref={rahmen} className="relative isolate overflow-hidden rounded-2xl">
      <HoefeKarte
        hoefe={hoefe}
        lage={lage}
        fokus={0}
        attributionOben
        hoeheKlasse="h-[60vh] min-h-[420px]"
        // So viel hält der Ausschnitt unten frei, wie die Karte am Pin hoch ist.
        polsterUnten={PIN_KARTE_HOEHE}
        zentrum={karte.zentrum}
        onAuswahl={(slug) => setLage((l) => nachPinTipp(l, slug))}
        onLeerTipp={() => setLage((l) => nachLeerTipp(l))}
      />
      {gewaehlt && (
        // Über den Leaflet-Ebenen (400) und unter den Bedienteilen (1000).
        <div className="absolute inset-x-3 bottom-3 z-[500] md:right-auto md:w-[340px]">
          <HofKurzkarte
            art="region"
            hof={gewaehlt.hof}
            bereich="FUTTERMITTEL"
            id={`futter-pin-${gewaehlt.hof.slug}`}
            onSchliessen={() => setLage((l) => nachLeerTipp(l))}
            findePin={() => rahmen.current?.querySelector<HTMLElement>(`[data-pin="${CSS.escape(gewaehlt.hof.slug)}"]`) ?? null}
          >
            <PinInhalt karte={gewaehlt} jetzt={jetzt} />
          </HofKurzkarte>
        </div>
      )}
    </div>
  )
}

/** Unter dem Kopf: zwei Größen samt Preis, die Abholzeile, „Grundpreis ab …", „Bestellen" und der Verweis auf weitere Angebote. */
function PinInhalt({ karte, jetzt }: { karte: FutterPinKarte; jetzt: string }): React.JSX.Element {
  const { angebot } = karte
  const vorgewaehlt = angebot.groessen.find((g) => g.id === angebot.vorgewaehlt) ?? angebot.groessen[0]
  return (
    <div className="flex flex-col gap-2 pt-1">
      <ul className="flex flex-col gap-1.5">
        {karte.zeilen.map((zeile) => (
          <li key={zeile.name} className="flex min-w-0 flex-col">
            <span className="truncate text-[13.5px] font-semibold text-foreground" title={zeile.name}>
              {zeile.name}
            </span>
            <span className="text-[12.5px] text-muted-foreground tabular-nums">{zeile.preis}</span>
          </li>
        ))}
      </ul>
      <Abholzeile fenster={angebot.abholfenster} isPaused={false} jetzt={jetzt} />
      {angebot.grundpreis && (
        <p className="text-[12.5px] text-muted-foreground tabular-nums">
          {FUTTER_KARTE_TEXT.grundpreis} {angebot.grundpreis}
        </p>
      )}
      <Link href={vorgewaehlt.kaufLink} className={cn(KNOPF_GRUEN, 'w-full')}>
        {FUTTER_KARTE_TEXT.bestellen}
        <span className="sr-only">: {angebot.name}</span>
      </Link>
      {karte.weitere && <p className="text-[12.5px] text-muted-foreground">{karte.weitere}</p>}
    </div>
  )
}
