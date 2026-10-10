import Link from 'next/link'
import { CircleAlert } from 'lucide-react'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { KNOPF_RAHMEN } from '@/components/hof-bestellungen/stil'
import { cn } from '@/lib/utils'

/*
 * Rahmen, Ladeansicht und Ladefehler der Auswertung (Nachtlauf Nr. 22c).
 * Das Skelett zeigt dieselben Maße wie die fertige Seite: Kopf, Zeitraum,
 * vier Kennzahlen, Teilen-Karte, Umsatz und Servicegebühren nebeneinander ab
 * 1280 px. Farbstaffelung wie die anderen Hof-Routen im neuen Design.
 */
export const AUSWERTUNG_RAHMEN = 'mx-auto w-full max-w-6xl px-4 pt-5 pb-12 md:px-8 md:pt-8 xl:px-10'

export function AuswertungLaden(): React.JSX.Element {
  return (
    <div className={cn(AUSWERTUNG_RAHMEN, 'animate-pulse')} aria-busy="true">
      <div className="flex flex-col gap-4 md:gap-[18px]">
        <div>
          <div className="h-8 w-40 rounded-lg bg-border" />
          <div className="mt-2 h-4 w-80 max-w-full rounded bg-muted" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="h-10 w-56 rounded-full bg-muted" />
          <div className="h-11 w-60 rounded-full bg-muted" />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[118px] rounded-2xl border border-border bg-card" />
          ))}
        </div>
        <div className="h-[190px] rounded-2xl border border-border bg-card" />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="h-[380px] rounded-2xl border border-border bg-card" />
          <div className="h-[300px] rounded-2xl border border-border bg-card" />
        </div>
      </div>
    </div>
  )
}

/** Ladefehler inline statt der ganzseitigen 500 (DESIGN_SYSTEM „Zustände"); der Weg zurück ist dieselbe Adresse. */
export function AuswertungFehler({ nochmal }: { nochmal: string }): React.JSX.Element {
  return (
    <Hinweiskarte
      ton="orange"
      symbol={CircleAlert}
      titel="Wir konnten deine Zahlen gerade nicht laden."
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
