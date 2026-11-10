'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import HoefeKarte, { type KartenHof } from '@/components/hoefe/hoefe-karte'
import { HofKurzkarte } from '@/components/hoefe/hof-kurzkarte'
import { KNOPF_GRUEN } from '@/components/hof-bestellungen/stil'
import { FutterAbholung, FutterGroessen } from '@/components/region/futter-karte'
import { REGION_KARTE_HOEHE } from '@/components/region/region-spalten'
import { LEERE_LAGE, nachLeerTipp, nachPinTipp, type AuswahlLage } from '@/lib/hoefe-anzeige'
import { FUTTER_KARTE_TEXT, bestellenText, type FutterKaufenAnsicht, type FutterPinKarte } from '@/lib/futter-kaufen'
import { LEAFLET_BEDIENTEILE } from '@/components/karte/karten-masse'
import { cn } from '@/lib/utils'

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
 *
 * Seit Nr. 272 (Liste Lauf 32 region, Board s1-/w1-region Bild 6): Quelle
 * unten rechts, die Hofkarte UNTER der Karte statt über den Pins; darin das
 * Produkt, „Abholung … · Grundpreis ab …“, die Größen als Optionen (G5) und
 * „Bestellen“ für die gewählte Größe.
 */
export default function FutterKarteAnsicht({ karte, jetzt }: { karte: FutterKaufenAnsicht['karte']; jetzt: string }): React.JSX.Element {
  const [lage, setLage] = useState<AuswahlLage>(LEERE_LAGE)
  const rahmen = useRef<HTMLDivElement>(null)
  const hoefe: KartenHof[] = karte.pins.map(({ slug, nummer, lat, lon, name }) => ({ slug, nummer, lat, lon, name }))
  const gewaehlt = lage.ausgewaehlt ? (karte.karten[lage.ausgewaehlt] ?? null) : null

  return (
    <div ref={rahmen} className="flex flex-col gap-3">
      {/* `isolate`: eine eigene Stapelebene — sonst lägen Leaflets Ebenen (400) beim Scrollen über der festen Leiste der Shell (z-50). */}
      <div className={cn('relative isolate overflow-hidden rounded-2xl', LEAFLET_BEDIENTEILE)}>
        <HoefeKarte
          hoefe={hoefe}
          lage={lage}
          fokus={0}
          hoeheKlasse={REGION_KARTE_HOEHE}
          zentrum={karte.zentrum}
          onAuswahl={(slug) => setLage((l) => nachPinTipp(l, slug))}
          onLeerTipp={() => setLage((l) => nachLeerTipp(l))}
        />
      </div>
      {gewaehlt && (
        <HofKurzkarte
          art="region"
          hof={gewaehlt.hof}
          bereich="FUTTERMITTEL"
          id={`futter-pin-${gewaehlt.hof.slug}`}
          onSchliessen={() => setLage((l) => nachLeerTipp(l))}
          findePin={() => rahmen.current?.querySelector<HTMLElement>(`[data-pin="${CSS.escape(gewaehlt.hof.slug)}"]`) ?? null}
        >
          {/* Ein neuer Hof ist eine neue Wahl — nie die Größe des vorigen. */}
          <PinInhalt key={gewaehlt.hof.slug} karte={gewaehlt} jetzt={jetzt} />
        </HofKurzkarte>
      )}
    </div>
  )
}

/** Unter dem Kopf: das Produkt, „Abholung … · Grundpreis ab …“, die Größen (G5), „Bestellen“ und der Verweis auf weitere Angebote. */
function PinInhalt({ karte, jetzt }: { karte: FutterPinKarte; jetzt: string }): React.JSX.Element {
  const { angebot } = karte
  const [wahl, setWahl] = useState(angebot.vorgewaehlt)
  const groesse = angebot.groessen.find((g) => g.id === wahl) ?? angebot.groessen[0]
  return (
    <div className="flex flex-col gap-2 pt-1">
      <p className="truncate text-[14px] text-foreground" title={angebot.name}>
        {angebot.name}
      </p>
      <FutterAbholung angebot={angebot} jetzt={jetzt} />
      {angebot.grundpreis && (
        <p className="text-[13px] text-muted-foreground tabular-nums">
          {FUTTER_KARTE_TEXT.grundpreis} {angebot.grundpreis}
        </p>
      )}
      {angebot.groessen.length > 1 && <FutterGroessen groessen={angebot.groessen} gewaehlt={groesse.id} onWahl={setWahl} />}
      <Link href={groesse.kaufLink} className={cn(KNOPF_GRUEN, 'min-h-12 w-full text-[15px]')}>
        {bestellenText(angebot, groesse)}
        <span className="sr-only">: {angebot.name}</span>
      </Link>
      {karte.weitere && <p className="text-[12.5px] text-muted-foreground">{karte.weitere}</p>}
    </div>
  )
}
