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

function Kopf({ breite }: { breite: string }): React.JSX.Element {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className={cn('h-8 rounded-lg bg-border md:h-9', breite)} />
      <div className="hidden h-4 w-48 rounded bg-muted sm:block" />
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

export function BriefkastenLaden(): React.JSX.Element {
  return (
    <Rahmen>
      <Kopf breite="w-40" />
      <Chips breiten={[34, 22, 34, 18, 20, 22, 18]} />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-2">
          <div className="h-4 w-24 rounded bg-muted" />
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex h-[64px] items-center gap-3 border-t border-border px-4 first:border-t-0">
                <div className="h-5 w-16 rounded-full bg-muted" />
                <div className="flex-1">
                  <div className="h-4 w-2/3 rounded bg-border" />
                  <div className="mt-1.5 h-3 w-1/3 rounded bg-muted" />
                </div>
                <div className="h-5 w-20 rounded-full bg-muted" />
              </div>
            ))}
          </div>
        </div>
        <div className="h-72 rounded-2xl border border-border bg-card" />
      </div>
    </Rahmen>
  )
}

export function MeldungLaden(): React.JSX.Element {
  return (
    <Rahmen>
      <div className="flex justify-between">
        <div className="h-11 w-32 rounded-full bg-muted" />
        <div className="flex gap-2">
          <div className="h-11 w-24 rounded-full bg-muted" />
          <div className="h-11 w-28 rounded-full bg-muted" />
        </div>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="h-5 w-48 rounded-full bg-muted" />
            <div className="mt-3 h-4 w-full rounded bg-border" />
            <div className="mt-2 h-4 w-3/4 rounded bg-border" />
          </div>
          <div className="h-64 rounded-2xl border border-border bg-card" />
        </div>
        <div className="h-[520px] rounded-2xl border border-border bg-card" />
      </div>
    </Rahmen>
  )
}

export function FinanzenLaden(): React.JSX.Element {
  return (
    <Rahmen>
      <MusterKopf breite="w-36" rechts="md:w-60" />
      <MusterKennzahlen anzahl={5} />
      <Chips breiten={[22, 22, 30, 40]} />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)]">
        <div className="h-80 rounded-2xl border border-border bg-card" />
        <div className="h-80 rounded-2xl border border-border bg-card" />
      </div>
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
