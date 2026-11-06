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
 *
 * `form="karte"` (seit Nr. 242, Boards s1-startseite Bild 5, s2-/w2-kundenkonto Bild 5): linksbündig in einer
 * Karte mit festem Rand, der Titel fett ohne Serifen, der Ausweg über die volle Breite. Das Symbol ist dort
 * freiwillig (die Boards zeigen keins) und steht, wenn es mitkommt, in der Größe der Grundform links über dem
 * Titel. Der Titel ohne Serifen folgt dem Board (s1-startseite: `strong` 16 px). Vorher bauten zwei
 * Seiten diese Form per Klassen von außen um (Nr. 234, Nr. 239).
 */
export function EmptyState(props: MitteProps | KarteProps): React.JSX.Element {
  const { titel, titelStufe, satz, ausweg, className } = props
  const Symbol = props.symbol
  const Titel = titelStufe === undefined ? 'p' : (`h${titelStufe}` as const)
  if (props.form === 'karte') {
    return (
      <div
        data-slot="empty-state"
        data-form="karte"
        className={cn('flex flex-col items-stretch gap-2 rounded-[16px] border border-border bg-card px-4 py-4 text-left', className)}
      >
        {Symbol && (
          // Dasselbe Maß wie in der Grundform (56 px): Die Karten-Form ändert Ausrichtung und Titel, nicht das Symbol.
          <span className="flex size-14 items-center justify-center rounded-full bg-muted">
            <Symbol className="size-7 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
          </span>
        )}
        <Titel className="text-[16px] font-bold text-foreground">{titel}</Titel>
        {satz && <p className="text-[14px] text-muted-foreground">{satz}</p>}
        {isValidElement(ausweg) && <div className="mt-1 flex flex-col gap-2 *:w-full">{ausweg}</div>}
      </div>
    )
  }
  return (
    <div
      data-slot="empty-state"
      className={cn(
        'flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card px-6 py-10 text-center',
        className
      )}
    >
      {Symbol && (
        <span className="flex size-14 items-center justify-center rounded-full bg-muted">
          <Symbol className="size-7 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
        </span>
      )}
      <Titel className="font-heading text-lg font-semibold text-foreground">{titel}</Titel>
      {satz && <p className="max-w-sm text-sm text-muted-foreground">{satz}</p>}
      {isValidElement(ausweg) && <div className="mt-1 flex flex-wrap justify-center gap-2">{ausweg}</div>}
    </div>
  )
}

type GemeinsameProps = {
  titel: string
  /** Der Titel als Überschrift dieser Stufe — für eine Seite, die im Randzustand sonst keine hätte; sonst ein Absatz. */
  titelStufe?: 1 | 2 | 3
  satz?: string
  ausweg: Ausweg
  className?: string
}
/** Die Grundform: mittig, gestrichelt, das Symbol ist Pflicht (Register N9). */
type MitteProps = GemeinsameProps & { form?: 'mitte'; symbol: LucideIcon }
/** Die Karte der Boards: linksbündig, Ausweg über die volle Breite, Symbol freiwillig. */
type KarteProps = GemeinsameProps & { form: 'karte'; symbol?: LucideIcon }

/**
 * Der Ausweg eines Leerzustands (Register N9, Pflicht seit Nr. 85): eine Aktion, die immer da ist
 * (meist ein Link) — oder `{ ohne: 'Grund' }`, wenn es keinen Weg weiter gibt. Der Grund steht im
 * Aufruf, in ganzen Worten, und wird nicht gezeigt: Wer einen Leerzustand ohne Aktion baut, muss ihn
 * hinschreiben (Wache `tests/leerzustaende-wache.test.ts`). Eine Aktion, die fehlen kann
 * (`bedingung && …`, `… : undefined`), ist kein Ausweg — dafür steht der Grund im anderen Zweig.
 */
export type Ausweg = ReactElement | { ohne: string }
