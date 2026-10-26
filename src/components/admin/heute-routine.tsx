'use client'

import { useId, useSyncExternalStore } from 'react'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { LEISE } from '@/components/hof-bestellungen/stil'
import { MONTAGS_ROUTINE, leseRoutine, routineZeile, type RoutinePunkt } from '@/lib/admin-aufgaben'

/*
 * Die Montags-Routine auf Admin › Heute (Nr. 185; Mockup admin-heute): fünf
 * Haken, die nur der Browser kennt (localStorage, je Woche ein Schlüssel —
 * `routineSchluessel`, den die Seite mit ihrer Uhr bildet). Eine Merkhilfe,
 * kein Zustand der Plattform: In einem privaten Fenster oder ohne Speicher
 * sind die Haken einfach leer.
 *
 * Server und Hydration rendern „nichts abgehakt“, danach liest React den
 * Speicher (useSyncExternalStore wie der Cookie-Hinweis) — kein Unterschied
 * zwischen Server-HTML und erstem Render im Browser.
 */

const zuhoerer = new Set<() => void>()

function abonnieren(melden: () => void): () => void {
  zuhoerer.add(melden)
  return () => zuhoerer.delete(melden)
}

function leseSpeicher(schluessel: string): string {
  try {
    return localStorage.getItem(schluessel) ?? ''
  } catch {
    return ''
  }
}

function schreibeSpeicher(schluessel: string, punkte: readonly RoutinePunkt[]): void {
  try {
    localStorage.setItem(schluessel, JSON.stringify(punkte))
  } catch {
    // Ohne Speicher (privates Fenster, gesperrt) bleibt der Haken nur bis zum nächsten Laden – kein Fehler für den Admin.
    return
  }
  for (const melden of zuhoerer) melden()
}

export function HeuteRoutine({ schluessel, kopf = false }: { schluessel: string; kopf?: boolean }): React.JSX.Element {
  const roh = useSyncExternalStore(
    abonnieren,
    () => leseSpeicher(schluessel),
    () => ''
  )
  const erledigt = leseRoutine(roh)
  const basis = useId()

  function umschalten(punkt: RoutinePunkt): void {
    const neu = erledigt.includes(punkt) ? erledigt.filter((p) => p !== punkt) : [...erledigt, punkt]
    schreibeSpeicher(schluessel, neu)
  }

  return (
    <div className="flex flex-col gap-1">
      {kopf && (
        <p className={cn('text-[12.5px]', LEISE)} aria-live="polite">
          {routineZeile(erledigt.length)}
        </p>
      )}
      <ul>
        {MONTAGS_ROUTINE.map((p) => {
          const id = `${basis}-${p.id}`
          return (
            <li key={p.id}>
              <label htmlFor={id} className={cn('flex min-h-11 items-center gap-3 rounded-md text-[14px] text-foreground', FOKUS_RAHMEN)}>
                <input
                  id={id}
                  type="checkbox"
                  checked={erledigt.includes(p.id)}
                  onChange={() => umschalten(p.id)}
                  className="size-5 shrink-0 accent-accent"
                />
                <span className={cn(erledigt.includes(p.id) && 'text-muted-foreground line-through')}>{p.text}</span>
              </label>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
