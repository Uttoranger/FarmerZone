import Link from 'next/link'
import { CircleAlert, MapPin } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { KNOPF_RAHMEN } from '@/components/hof-bestellungen/stil'
import { cn } from '@/lib/utils'
import { REGION_RAHMEN } from './region-kopf'

/*
 * Zustände von /region ohne Mockup (DESIGN_SYSTEM „Zustände"): ohne eigenen
 * Standort ein Leerzustand mit Ausweg in die Hof-Einstellungen, ein Ladefehler
 * inline als orange Hinweiskarte, und das Skelett in der Form der Seite.
 */

/** Ohne eigenen Standort gibt es keinen Umkreis — und damit weder Preise noch Futter in der Nähe. */
export function StandortFehlt(): React.JSX.Element {
  return (
    <EmptyState
      symbol={MapPin}
      titel="Wo liegt dein Hof?"
      satz="Trag deine Adresse ein, dann zeigen wir dir Höfe in der Nähe."
      aktion={
        <Link href="/settings/profile" className={KNOPF_RAHMEN}>
          Zu den Hof-Einstellungen
        </Link>
      }
    />
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
