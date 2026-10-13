import { isValidElement, type ReactElement } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * EmptyState: der Leerzustand nach docs/ai/DESIGN_SYSTEM.md — Symbol, ein
 * Satz, eine nächste Handlung („Noch keine Produkte — Lege dein erstes an").
 * Nie nur „nichts gefunden": Die Aktion ist der Ausweg (Umkreis erweitern,
 * Filter lockern, anlegen) und kommt als `ausweg` herein, meist ein Link.
 *
 * Großes Symbol mit Strichstärke 1,5 (Regel für Leerzustände).
 */
export function EmptyState({
  symbol: Symbol,
  titel,
  titelStufe,
  satz,
  ausweg,
  className,
}: {
  symbol: LucideIcon
  titel: string
  /** Der Titel als Überschrift dieser Stufe — für eine Seite, die im Randzustand sonst keine hätte; sonst ein Absatz. */
  titelStufe?: 1 | 2 | 3
  satz?: string
  ausweg: Ausweg
  className?: string
}): React.JSX.Element {
  const Titel = titelStufe === undefined ? 'p' : (`h${titelStufe}` as const)
  return (
    <div
      data-slot="empty-state"
      className={cn(
        'flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card px-6 py-10 text-center',
        className
      )}
    >
      <span className="flex size-14 items-center justify-center rounded-full bg-muted">
        <Symbol className="size-7 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
      </span>
      <Titel className="font-heading text-lg font-semibold text-foreground">{titel}</Titel>
      {satz && <p className="max-w-sm text-sm text-muted-foreground">{satz}</p>}
      {isValidElement(ausweg) && <div className="mt-1 flex flex-wrap justify-center gap-2">{ausweg}</div>}
    </div>
  )
}

/**
 * Der Ausweg eines Leerzustands (Register N9, Pflicht seit Nr. 85): eine Aktion, die immer da ist
 * (meist ein Link) — oder `{ ohne: 'Grund' }`, wenn es keinen Weg weiter gibt. Der Grund steht im
 * Aufruf, in ganzen Worten, und wird nicht gezeigt: Wer einen Leerzustand ohne Aktion baut, muss ihn
 * hinschreiben (Wache `tests/leerzustaende-wache.test.ts`). Eine Aktion, die fehlen kann
 * (`bedingung && …`, `… : undefined`), ist kein Ausweg — dafür steht der Grund im anderen Zweig.
 */
export type Ausweg = ReactElement | { ohne: string }
