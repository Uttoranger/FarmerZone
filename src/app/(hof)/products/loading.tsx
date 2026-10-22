import { MEIN_HOF_KOPF_HUELLE } from '@/components/mein-hof/mein-hof-kopf'
import { MeinHofKopfLaden } from '@/components/mein-hof/mein-hof-laden'
import { cn } from '@/lib/utils'

/*
 * Ladeansicht von „Produkte" (Nachtlauf Nr. 18; seit Nr. 143 unter md nach dem
 * Board system-h1-mein-hof-v3, Bildschirm A). Die HofShell steht durch das
 * Layout, gewartet wird nur auf den Inhalt. Gleiche Maße wie die fertige Seite:
 * unter md der Kopf von Mein Hof (Streifen, Zustandszeile, Reiter — dieselbe
 * Hülle wie die Seite, MeinHofKopfLaden), darunter ohne sichtbare Überschrift
 * (Register N25) die Filterzeile mit der Lupe am Ende und vier Karten-Zeilen;
 * ab md Kopf (h1 + Zahl), Filter-Chips und Suche, darunter ab 1024 px die
 * Tabelle mit Kopfzeile und vier Zeilen, sonst vier Karten-Zeilen. Nur, was
 * sicher kommt — Hinweise, „Braucht dich" und der leere Zustand hängen von den
 * Daten ab.
 *
 * Farbstaffelung im neuen Design: bg-border für Überschriften, bg-muted für
 * Zweitzeilen und Flächen.
 */
export default function ProdukteLaden(): React.JSX.Element {
  return (
    <div className="animate-pulse" aria-busy="true">
      {/* Unter md: der Kopf von Mein Hof mit den Reitern Produkte · Hofseite · Beiträge */}
      <div className={cn(MEIN_HOF_KOPF_HUELLE, 'md:hidden')}>
        <MeinHofKopfLaden aktiv="produkte" />
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 pt-5 pb-12 md:px-8 md:pt-8 xl:px-10">
        <div className="flex flex-col gap-4 md:gap-[18px]">
          {/* Überschrift und Zahl nur ab md (unter md hört die h1 nur der Screenreader) */}
          <div className="hidden items-end gap-3 md:flex">
            <div>
              <div className="h-8 w-32 rounded-lg bg-border" />
              <div className="mt-2 h-4 w-44 rounded bg-muted" />
            </div>
            <div className="ml-auto h-11 w-44 rounded-full bg-muted" />
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex items-center gap-2 md:flex-1">
              {[16, 28, 28, 24].map((breite, i) => (
                <div key={i} className="h-9 shrink-0 rounded-full bg-muted" style={{ width: `${breite * 4}px` }} />
              ))}
              {/* Unter md die Lupe am Ende der Filter */}
              <div className="ml-auto size-11 shrink-0 rounded-full bg-muted md:hidden" />
            </div>
            <div className="hidden h-9 w-[260px] rounded-full bg-muted md:block" />
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-border bg-card lg:block">
            <div className="h-9 border-b border-border" />
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex h-[68px] items-center gap-4 border-t border-border px-3.5 first:border-t-0">
                <div className="size-11 rounded-xl bg-muted" />
                <div className="h-4 w-48 rounded bg-border" />
                <div className="ml-auto h-4 w-16 rounded bg-muted" />
                <div className="h-8 w-32 rounded-full bg-muted" />
                <div className="h-5 w-20 rounded-full bg-muted" />
                <div className="h-6 w-10 rounded-full bg-muted" />
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card lg:hidden">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex h-[78px] items-center gap-2.5 border-t border-border p-2.5 first:border-t-0">
                <div className="size-[46px] rounded-xl bg-muted" />
                <div className="flex-1">
                  <div className="h-4 w-32 rounded bg-border" />
                  <div className="mt-1.5 h-3 w-24 rounded bg-muted" />
                </div>
                <div className="h-11 w-24 rounded-full bg-muted" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
