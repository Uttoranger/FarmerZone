import { isValidElement, type ReactElement } from 'react'
import { RUNDUNG } from '@/components/ui/rundung'
import { cn } from '@/lib/utils'

/**
 * EmptyState: der Leerzustand nach docs/ai/DESIGN_SYSTEM.md — ein Satz als Titel, höchstens ein
 * erklärender Satz und eine nächste Handlung („Noch keine Produkte — Lege dein erstes an").
 * Nie nur „nichts gefunden": Die Aktion ist der Ausweg (Umkreis erweitern, Filter lockern,
 * anlegen) und kommt als `ausweg` herein, meist ein Link.
 *
 * Eine Form für alle (G4, Nr. 246; Liste Lauf 32, Abschnitt 3.2; Register N9 mit Ergänzung N46):
 * linksbündige Karte mit durchgezogenem Rand (`RUNDUNG.karte`, 12 px), der Titel fett in der
 * Grundschrift, der Ausweg über die volle Breite. Kein Symbol und kein gestrichelter Rand mehr —
 * die Projektleitung hat „Symbol“ aus N9 gestrichen. Die Karten-Form aus Nr. 242 (`form="karte"`)
 * ist damit die Grundform; die Props `symbol` und `form` sind entfallen. Ob der Knopf orange ist
 * (Hof, Hauptaktion) oder ein Rahmenknopf, entscheidet der Aufrufer mit seinem `ausweg`.
 *
 * In einer Karte nimmt der Leerzustand ihren Grund an (`className="rounded-none border-0 py-8"`);
 * die Klassen des Aufrufers stehen deshalb hinter der Rundung.
 */
export function EmptyState({ titel, titelStufe, satz, ausweg, className }: EmptyStateProps): React.JSX.Element {
  const Titel = titelStufe === undefined ? 'p' : (`h${titelStufe}` as const)
  return (
    <div
      data-slot="empty-state"
      className={cn('flex flex-col items-stretch gap-2 border border-border bg-card px-4 py-4 text-left', RUNDUNG.karte, className)}
    >
      <Titel className="text-[16px] font-bold text-foreground">{titel}</Titel>
      {satz && <p className="text-[14px] text-muted-foreground">{satz}</p>}
      {isValidElement(ausweg) && <div className="mt-1 flex flex-col gap-2 *:w-full">{ausweg}</div>}
    </div>
  )
}

type EmptyStateProps = {
  titel: string
  /** Der Titel als Überschrift dieser Stufe — für eine Seite, die im Randzustand sonst keine hätte; sonst ein Absatz. */
  titelStufe?: 1 | 2 | 3
  satz?: string
  ausweg: Ausweg
  className?: string
}

/**
 * Der Ausweg eines Leerzustands (Register N9, Pflicht seit Nr. 85): eine Aktion, die immer da ist
 * (meist ein Link) — oder `{ ohne: 'Grund' }`, wenn es keinen Weg weiter gibt. Der Grund steht im
 * Aufruf, in ganzen Worten, und wird nicht gezeigt: Wer einen Leerzustand ohne Aktion baut, muss ihn
 * hinschreiben (Wache `tests/leerzustaende-wache.test.ts`). Eine Aktion, die fehlen kann
 * (`bedingung && …`, `… : undefined`), ist kein Ausweg — dafür steht der Grund im anderen Zweig.
 */
export type Ausweg = ReactElement | { ohne: string }
