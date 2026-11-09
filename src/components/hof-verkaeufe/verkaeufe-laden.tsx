import { WerkzeugKopfLaden } from '@/components/ui/werkzeug-kopf'
import { RUNDUNG } from '@/components/ui/rundung'
import { cn } from '@/lib/utils'

/*
 * Ladeansicht der Verkäufe (Nachtlauf Nr. 22b; seit Nr. 251 mit dem Werkzeug-Kopf, G1) — dieselben
 * Maße wie die fertige Seite: Kopf, zwei Kennzahlen nebeneinander, Überschrift und Liste. Nur, was
 * sicher kommt (Stripe-Link und Wiederholen hängen von den Daten ab). Farbstaffelung wie die anderen
 * Hof-Routen im neuen Design: bg-border für Überschriften, bg-muted für Zweitzeilen und Flächen.
 */
/**
 * Die Kopf-Aktion „Verkauf eintragen“ im Web: ohne „+“ und auf Höhe der h1 (Board w2-verkaeufe Bild 1, Liste
 * Lauf 32 „Knopf mit ‚+‘ tiefer gesetzt“). Der Werkzeug-Kopf richtet seine Aktion im Web unten aus (an der
 * Unterzeile); der Abstand unten hebt den Knopf um die Höhe der Unterzeile zur Mitte der h1.
 */
export const KOPF_AKTION = 'hidden md:mb-[22px] md:inline-flex'

export const VERKAEUFE_RAHMEN = 'w-full max-w-5xl px-4 pt-5 pb-12 md:px-8 md:pt-8 xl:px-10'

export function VerkaeufeLaden(): React.JSX.Element {
  return (
    <div className={cn(VERKAEUFE_RAHMEN, 'animate-pulse')} aria-busy="true">
      <div className="flex flex-col gap-4 md:gap-[18px]">
        <WerkzeugKopfLaden />
        <div className="h-4 w-56 rounded bg-muted" />
        <div className="grid grid-cols-2 gap-3 lg:max-w-[calc(100%-318px)]">
          <div className={cn('h-[118px] border border-border bg-card md:h-[148px]', RUNDUNG.karte)} />
          <div className={cn('h-[118px] border border-border bg-card md:h-[148px]', RUNDUNG.karte)} />
        </div>
        <div className="h-3 w-28 rounded bg-border" />
        <div className={cn('overflow-hidden border border-border bg-card lg:max-w-[calc(100%-318px)]', RUNDUNG.karte)}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex h-[72px] items-center gap-3 border-t border-border px-3.5 first:border-t-0 md:px-[18px]">
              <div className="flex-1">
                <div className="h-4 w-40 rounded bg-border" />
                <div className="mt-1.5 h-3 w-52 rounded bg-muted" />
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <div className="h-4 w-16 rounded bg-muted" />
                <div className="h-4 w-20 rounded-full bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
