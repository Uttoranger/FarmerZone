import Link from 'next/link'
import { CircleAlert, MapPin } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { KNOPF_GRUEN, KNOPF_RAHMEN } from '@/components/hof-bestellungen/stil'
import { HofKarte, type KartenHof } from '@/components/hoefe/entdecken-teile'
import { OHNE_STANDORT_TEXT, STANDORT_SETZEN_HREF } from '@/lib/region'
import type { VorschauProdukt } from '@/lib/hofuebersicht'
import type { AnzeigeBereich } from '@/lib/taxonomie'
import { cn } from '@/lib/utils'
import { REGION_RAHMEN } from './region-kopf'

/*
 * Zustände von /region (DESIGN_SYSTEM „Zustände"): ohne eigenen Standort ein
 * Leerzustand mit Ausweg zur Karte im Hofprofil samt der eigenen Hofkarte
 * (Board v2 §4, N23), ein Ladefehler inline als orange Hinweiskarte und das
 * Skelett in der Form der Seite (nur noch für die Umleitung /analytics/umfeld —
 * /region selbst zeigt seit Nr. 122 einen Ladepunkt statt des Skeletts).
 */

/** Die eigene Hofkarte, wie sie in der Liste auf /hoefe steht (eigeneListenkarte in src/lib/region.ts). */
export type EigeneKarte = {
  hof: KartenHof
  bereich: AnzeigeBereich
  schaufenster: { produkte: VorschauProdukt[]; weitere: number }
}

/**
 * Ohne eigenen Standort gibt es keinen Umkreis — für beide Reiter gleich (N23):
 * der Leerzustand nennt beide Folgen, der Knopf führt direkt zur Karte im
 * Hofprofil, darunter die eigene Hofkarte mit „Nicht auf der Karte", wie die
 * Kundschaft sie in der Liste sieht. `eigeneKarte`: null = der Hof steht gerade
 * nicht in der Liste (Testhof, nicht sichtbar) — dann ein Satz; undefined =
 * nicht geladen (Fehler) — dann fehlt der Abschnitt, der Ausweg bleibt.
 */
export function StandortFehlt({ eigeneKarte, jetzt }: { eigeneKarte?: EigeneKarte | null; jetzt: string }): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <EmptyState
        symbol={MapPin}
        titel={OHNE_STANDORT_TEXT.titel}
        titelStufe={2}
        satz={OHNE_STANDORT_TEXT.satz}
        ausweg={
          <Link href={STANDORT_SETZEN_HREF} className={KNOPF_GRUEN}>
            {OHNE_STANDORT_TEXT.knopf}
          </Link>
        }
      />
      {eigeneKarte !== undefined && (
        <section aria-label={OHNE_STANDORT_TEXT.ueberschriftListe} className="flex flex-col gap-2">
          <p className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">{OHNE_STANDORT_TEXT.ueberschriftListe}</p>
          {eigeneKarte ? (
            <HofKarte
              hof={eigeneKarte.hof}
              bereich={eigeneKarte.bereich}
              schaufenster={eigeneKarte.schaufenster}
              split={false}
              ausgewaehlt={false}
              jetzt={jetzt}
            />
          ) : (
            <p className="text-sm text-muted-foreground">{OHNE_STANDORT_TEXT.nichtInDerListe}</p>
          )}
        </section>
      )}
    </div>
  )
}

/** Ladefehler — der Weg zurück ist dieselbe Adresse (die Seite ist dynamisch, Hinlaufen heißt neu abfragen). */
export function RegionFehler({ nochmal }: { nochmal: string }): React.JSX.Element {
  return (
    <Hinweiskarte
      ton="orange"
      symbol={CircleAlert}
      titel="Wir konnten die Höfe in deiner Nähe gerade nicht laden."
      aktion={
        <Link href={nochmal} className={KNOPF_RAHMEN}>
          Noch einmal versuchen
        </Link>
      }
    >
      Es ist nichts verloren gegangen. Versuch es bitte gleich noch einmal.
    </Hinweiskarte>
  )
}

/** Ladeansicht: Kopf mit Reitern, Umkreis, drei Karten — nur, was sicher kommt. */
export function RegionLaden(): React.JSX.Element {
  return (
    <div className={cn(REGION_RAHMEN, 'animate-pulse')} aria-busy="true">
      <div className="flex flex-col gap-4">
        <div>
          <div className="h-8 w-28 rounded-lg bg-border" />
          <div className="mt-2 h-4 w-72 max-w-full rounded bg-muted" />
        </div>
        <div className="flex gap-6 border-b border-border pb-3">
          <div className="h-5 w-36 rounded bg-border" />
          <div className="h-5 w-28 rounded bg-muted" />
        </div>
        <div className="h-[52px] w-60 rounded-full bg-muted" />
        <div className="h-3 w-80 max-w-full rounded bg-muted" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[132px] rounded-2xl border border-border bg-card" />
        ))}
      </div>
    </div>
  )
}
