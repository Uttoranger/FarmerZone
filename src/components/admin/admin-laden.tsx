import { cn } from '@/lib/utils'
import { ADMIN_RAHMEN } from './admin-teile'

/*
 * Ladeansichten der Admin-Seiten (Nachtlauf Nr. 22f) — in der Form der
 * fertigen Seite, innerhalb der AdminShell (der Kopf steht schon). Nur, was
 * sicher kommt. Farbstaffelung wie die übrigen Routen im neuen Design:
 * bg-border für Überschriften, bg-muted für Zweitzeilen und Flächen.
 */

function Rahmen({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className={cn(ADMIN_RAHMEN, 'flex animate-pulse flex-col gap-5')} aria-busy="true">
      {children}
    </div>
  )
}

/** Seitenkopf des Musters (Register N15): h1, ein Satz, rechts ein Feld. */
function MusterKopf({ breite, rechts }: { breite: string; rechts?: string }): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div>
        <div className={cn('h-8 rounded-lg bg-border md:h-9', breite)} />
        <div className="mt-2 h-3.5 w-64 max-w-full rounded bg-muted" />
      </div>
      {rechts && <div className={cn('h-11 w-full rounded-full bg-muted md:w-auto', rechts)} />}
    </div>
  )
}

/** Kennzahlen des Musters: am Handy zu dritt, ab 1024 px eine Reihe. */
function MusterKennzahlen({ anzahl }: { anzahl: 3 | 4 | 5 }): React.JSX.Element {
  const spalten = { 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5' }[anzahl]
  return (
    <div className={cn('grid grid-cols-3 gap-2 md:gap-3', spalten)}>
      {Array.from({ length: anzahl }, (_, i) => (
        <div key={i} className={cn('h-[64px] rounded-2xl border border-border bg-card md:h-[92px]', i >= 3 && 'hidden md:block')} />
      ))}
    </div>
  )
}

function Chips({ breiten }: { breiten: number[] }): React.JSX.Element {
  return (
    <div className="flex gap-2 overflow-hidden">
      {breiten.map((b, i) => (
        <div key={i} className="h-9 shrink-0 rounded-full bg-muted" style={{ width: `${b * 4}px` }} />
      ))}
    </div>
  )
}

export function HoefeLaden(): React.JSX.Element {
  return (
    <Rahmen>
      <MusterKopf breite="w-24" rechts="md:w-72" />
      <MusterKennzahlen anzahl={5} />
      <Chips breiten={[44, 22, 30]} />
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 md:flex-row md:items-center">
          <div className="flex flex-1 gap-3.5">
            <div className="size-12 rounded-xl bg-muted" />
            <div className="flex-1">
              <div className="h-4 w-48 rounded bg-border" />
              <div className="mt-2 h-3 w-64 max-w-full rounded bg-muted" />
              <div className="mt-2 h-3 w-72 max-w-full rounded bg-muted" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5 md:flex">
            <div className="h-11 rounded-full bg-muted md:w-28" />
            <div className="h-11 rounded-full bg-muted md:w-32" />
          </div>
        </div>
      ))}
      <div className="h-3 w-3/4 rounded bg-muted" />
    </Rahmen>
  )
}

/** Die Seiten, die nur ihren Kopf haben (Startseite bis Nr. 96): der Kopf des Musters und eine leere Fläche. */
export function KopfLaden(): React.JSX.Element {
  return (
    <Rahmen>
      <MusterKopf breite="w-40" />
      <div className="h-40 rounded-2xl border border-border bg-card" />
    </Rahmen>
  )
}
