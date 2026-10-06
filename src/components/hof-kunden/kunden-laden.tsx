import { cn } from '@/lib/utils'

/*
 * Ladeansicht der Kunden (Nachtlauf Nr. 22a) — dieselben Maße wie die fertige
 * Seite. Liste: Kopf (h1 + Zeile), Filter-Chips und Suche, Zahl und
 * Sortierung, ab 1024 px Tabelle, darunter Zeilen. Detail: Zurück, Kopfkarte
 * mit Knöpfen, Kennzahlen und Bestellungen, ab 1280 px rechts Kontakt.
 * Nur, was sicher kommt (Tipp, Lieblingsprodukte und Neuigkeiten hängen von
 * den Daten ab). Farbstaffelung wie die anderen Hof-Routen im neuen Design:
 * bg-border für Überschriften, bg-muted für Zweitzeilen und Flächen.
 */
export const KUNDEN_RAHMEN = 'mx-auto w-full max-w-6xl px-4 pt-5 pb-12 md:px-8 md:pt-8 xl:px-10'

export function KundenLaden({ modus }: { modus: 'liste' | 'detail' }): React.JSX.Element {
  return (
    <div className={cn(KUNDEN_RAHMEN, 'animate-pulse')} aria-busy="true">
      {modus === 'liste' ? <ListeLaden /> : <DetailLaden />}
    </div>
  )
}

function ListeLaden(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4 md:gap-[18px]">
      <div>
        <div className="h-8 w-28 rounded-lg bg-border" />
        <div className="mt-2 h-4 w-44 rounded bg-muted" />
      </div>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="flex gap-2 overflow-hidden xl:flex-1">
          {[18, 32, 32, 28, 18].map((breite, i) => (
            <div key={i} className="h-9 shrink-0 rounded-full bg-muted" style={{ width: `${breite * 4}px` }} />
          ))}
        </div>
        <div className="h-11 w-full rounded-full bg-muted md:h-9 md:max-w-[340px] xl:w-[280px]" />
      </div>
      <div className="flex items-center justify-between">
        <div className="h-4 w-20 rounded bg-muted" />
        <div className="h-11 w-60 rounded-full bg-muted md:h-9" />
      </div>
      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card lg:block">
        <div className="h-9 border-b border-border" />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex h-[53px] items-center gap-4 border-t border-border px-3.5 first:border-t-0">
            <div className="size-8 rounded-full bg-muted" />
            <div className="h-4 w-44 rounded bg-border" />
            <div className="h-5 w-24 rounded-full bg-muted" />
            <div className="ml-auto h-4 w-16 rounded bg-muted" />
            <div className="h-4 w-20 rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-card lg:hidden">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex h-[88px] items-center gap-3 border-t border-border px-3.5 first:border-t-0">
            <div className="size-10 rounded-full bg-muted" />
            <div className="flex-1">
              <div className="h-4 w-36 rounded bg-border" />
              <div className="mt-1.5 h-3 w-44 rounded bg-muted" />
            </div>
            <div className="h-4 w-14 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  )
}

function DetailLaden(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-11 w-32 rounded-full bg-muted" />
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 md:px-[18px]">
        <div className="flex items-start gap-3.5">
          <div className="size-14 rounded-full bg-muted" />
          <div className="flex-1">
            <div className="h-7 w-56 rounded-lg bg-border" />
            <div className="mt-2 h-5 w-40 rounded bg-muted" />
          </div>
        </div>
        <div className="flex gap-2">
          {[28, 30, 26].map((breite, i) => (
            <div key={i} className="h-11 rounded-full bg-muted" style={{ width: `${breite * 4}px` }} />
          ))}
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[72px] rounded-2xl border border-border bg-card" />
            ))}
          </div>
          <div className="h-3 w-36 rounded bg-border" />
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex h-[62px] items-center gap-3 border-t border-border px-3.5 first:border-t-0">
                <div className="flex-1">
                  <div className="h-4 w-24 rounded bg-border" />
                  <div className="mt-1.5 h-3 w-48 rounded bg-muted" />
                </div>
                <div className="h-4 w-14 rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
        <div className="h-[132px] rounded-2xl border border-border bg-card" />
      </div>
    </div>
  )
}
