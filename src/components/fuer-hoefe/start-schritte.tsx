import type { StartSchritt } from '@/lib/fuer-hoefe'
import { cn } from '@/lib/utils'

// Eigene Datei ohne Server-Abhängigkeiten: Registrieren bindet sie in einer
// Client-Komponente ein, die Abschnitte von /fuer-hoefe ziehen über die
// Kategorie-Bilder node:fs nach sich.

/** Nummerierte Schritte mit orangem Ring — auch neben dem Registrieren-Formular. */
export function StartSchritte({
  schritte,
  spalten = false,
}: {
  schritte: readonly StartSchritt[]
  /** Nebeneinander ab 768 px (Für Höfe) statt untereinander (Registrieren). */
  spalten?: boolean
}): React.JSX.Element {
  return (
    <ol className={cn('grid gap-4', spalten && 'sm:grid-cols-2 lg:grid-cols-4 lg:gap-8')}>
      {schritte.map((s, i) => (
        <li key={s.titel} className={cn('flex gap-3', spalten && 'lg:flex-col')}>
          <span
            aria-hidden="true"
            className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-status-offen text-[12.5px] font-semibold text-status-offen"
          >
            {i + 1}
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] font-semibold">{s.titel}</span>
            <span className="block text-[13.5px] leading-normal text-muted-foreground">{s.text}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}
