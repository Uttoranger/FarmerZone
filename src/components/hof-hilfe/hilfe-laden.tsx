/*
 * Rahmen und Ladeansichten von „Hilfe und Rückmeldung" (/fehler-melden) und
 * „Meine Meldungen" (/meldungen) in der HofShell (Nachtlauf Nr. 22e). Gleiche
 * Maße wie die fertigen Seiten; nur, was sicher kommt (die Zeilen der Liste
 * hängen von den Daten ab und stehen als drei ruhige Platzhalter da).
 * Farbstaffelung im neuen Design: bg-border für Überschriften, bg-muted für
 * Zweitzeilen und Flächen. Seit Nr. 251 mit dem Kopf des Werkzeug-Kopfs (G1).
 */

import { WerkzeugKopfLaden } from '@/components/ui/werkzeug-kopf'
import { RUNDUNG } from '@/components/ui/rundung'
import { cn } from '@/lib/utils'

/** Meldung abgeben: Formular (640 px) links, ab lg die Seitenspalte rechts. */
export const MELDEN_RAHMEN = 'w-full max-w-[1040px] px-4 pt-5 pb-12 md:px-8 md:pt-7'

/** Meine Meldungen: eine Spalte bis 900 px (Mockup web-h6-meine-meldungen). */
export const MELDUNGEN_RAHMEN = 'w-full max-w-[900px] px-4 pt-5 pb-12 md:px-8 md:pt-7'

export function MeldungAbgebenLaden(): React.JSX.Element {
  return (
    <div className={MELDEN_RAHMEN}>
      <WerkzeugKopfLaden />
      <div className="animate-pulse lg:flex lg:items-start lg:gap-8" aria-busy="true">
        <div className="flex min-w-0 flex-col gap-3.5 lg:w-[640px] lg:shrink-0">
          <div className="h-4 w-full max-w-md rounded bg-muted" />
          <div className="mt-1 h-3 w-28 rounded bg-muted" />
          <div className="grid gap-1.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className={cn('h-16 bg-muted', RUNDUNG.feld)} />
            ))}
          </div>
          <div className="h-3.5 w-32 rounded bg-muted" />
          <div className={cn('h-[110px] bg-muted', RUNDUNG.feld)} />
          <div className={cn('h-12 bg-muted', RUNDUNG.feld)} />
          <div className={cn('hidden h-40 border border-border bg-card md:block', RUNDUNG.karte)} />
        </div>
        <div className="hidden min-w-0 flex-1 flex-col gap-3 lg:flex">
          <div className={cn('h-44 border border-border bg-card', RUNDUNG.karte)} />
          <div className={cn('h-36 border border-border bg-card', RUNDUNG.karte)} />
        </div>
      </div>
    </div>
  )
}

export function MeineMeldungenLaden(): React.JSX.Element {
  return (
    <div className={MELDUNGEN_RAHMEN}>
      <WerkzeugKopfLaden />
      <div className="flex animate-pulse flex-col gap-3.5" aria-busy="true">
        <div className="h-4 w-full max-w-md rounded bg-muted" />
        <div className={cn('overflow-hidden border border-border bg-card', RUNDUNG.karte)}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-2 border-t border-border px-4 py-3.5 first:border-t-0">
              <div className="h-3 w-24 rounded bg-muted" />
              <div className="h-4 w-3/4 rounded bg-border" />
              <div className="h-5 w-20 rounded-full bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
