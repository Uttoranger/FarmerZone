import Link from 'next/link'
import { EmptyState } from '@/components/ui/empty-state'
import { WerkzeugKopfLaden } from '@/components/ui/werkzeug-kopf'
import { RUNDUNG } from '@/components/ui/rundung'
import { AKTIONSLEISTE_KNOPF } from '@/components/ui/feste-aktionsleiste'
import { LadeFehlerKasten } from '@/components/ui/lade-fehler-kasten'
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
        titel={OHNE_STANDORT_TEXT.titel}
        titelStufe={2}
        satz={OHNE_STANDORT_TEXT.satz}
        ausweg={
          // G4, Knopf orange über die volle Breite (Hof, Liste Lauf 32 region).
          <Link href={STANDORT_SETZEN_HREF} className={AKTIONSLEISTE_KNOPF}>
            {OHNE_STANDORT_TEXT.knopf}
          </Link>
        }
      />
      {eigeneKarte !== undefined && (
        <section aria-label={OHNE_STANDORT_TEXT.ueberschriftListe} className="flex flex-col gap-2">
          <p className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">{OHNE_STANDORT_TEXT.ueberschriftListe}</p>
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

/** Ladefehler (G6) — der Weg zurück ist dieselbe Adresse (die Seite ist dynamisch, Hinlaufen heißt neu abfragen). */
export function RegionFehler({ nochmal }: { nochmal: string }): React.JSX.Element {
  // Satz wörtlich nach Board s1-/w1-region Bild 4 (am Handy ist meist das Netz schuld).
  return (
    <LadeFehlerKasten
      titel="Wir konnten die Höfe in deiner Nähe gerade nicht laden."
      satz="Prüf den Empfang und versuch es noch einmal."
      knopf="Nochmal"
      nochmal={nochmal}
    />
  )
}

/** Ladeansicht: Kopf mit Reitern, Umkreis, drei Karten — nur, was sicher kommt. */
export function RegionLaden(): React.JSX.Element {
  return (
    <div className={cn(REGION_RAHMEN, 'animate-pulse')} aria-busy="true">
      <div className="flex flex-col gap-4">
        <WerkzeugKopfLaden />
        <div className="h-4 w-72 max-w-full rounded bg-muted" />
        <div className="flex gap-6 border-b border-border pb-3">
          <div className="h-5 w-36 rounded bg-border" />
          <div className="h-5 w-28 rounded bg-muted" />
        </div>
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-9 w-20 rounded-full bg-muted" />
          ))}
        </div>
        <div className="h-3 w-80 max-w-full rounded bg-muted" />
        {[0, 1, 2].map((i) => (
          <div key={i} className={cn('h-[132px] border border-border bg-card', RUNDUNG.karte)} />
        ))}
      </div>
    </div>
  )
}
