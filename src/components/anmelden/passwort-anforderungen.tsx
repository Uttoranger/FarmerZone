import { Check, Circle } from 'lucide-react'
import { validatePassword } from '@/lib/password-rules'
import { cn } from '@/lib/utils'

/** Der Satz über der Liste beim Registrieren (Board w2-registrieren). */
export const PASSWORT_ANFORDERUNGEN_SATZ = 'Beim Tippen siehst du, was noch fehlt.'

/**
 * Die Anforderungen an ein Passwort als Liste, die sich beim Tippen abhakt
 * (Boards s2/w2-passwort und s2/w2-registrieren): erfüllt grün mit Haken,
 * offen leise mit Kreis — und der Stand in Worten für den Screenreader,
 * nicht nur als Farbe. Die Regeln kommen aus `validatePassword`, derselben
 * Quelle wie Schema und Server; die Liste prüft nichts selbst.
 */
export function PasswortAnforderungen({ passwort, id, className }: { passwort: string; id: string; className?: string }): React.JSX.Element {
  const { checks } = validatePassword(passwort)
  return (
    <ul id={id} aria-label="Passwort-Anforderungen" aria-live="polite" className={cn('flex flex-col gap-1', className)}>
      {checks.map((check) => (
        <li
          key={check.id}
          className={cn(
            // Board s2-/w2-passwort (Liste Lauf 32): 14 px, 8 px vom Zeichen, Zeichen in einer 18-px-Spalte.
            'flex items-center gap-2 text-[14px] leading-snug transition-colors duration-150',
            check.passed ? 'text-status-fertig' : 'text-muted-foreground'
          )}
        >
          {check.passed ? (
            <Check className="size-[18px] shrink-0" strokeWidth={2.2} aria-hidden="true" />
          ) : (
            <Circle className="size-[18px] shrink-0 p-[3px]" strokeWidth={2} aria-hidden="true" />
          )}
          {check.label}
          <span className="sr-only">{check.passed ? ' – erfüllt' : ' – fehlt noch'}</span>
        </li>
      ))}
    </ul>
  )
}
