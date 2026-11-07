import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { cn } from '@/lib/utils'

/*
 * „Liste / Karte“ auf /region als Chips wie im Board s1-/w1-region (G11, Liste Lauf 32 region): gewählt
 * dunkel gefüllt, sonst Umriss. Anders als die Filter-Chips keine Links — die Ansicht ist Zustand der Seite
 * (replaceState), deshalb Knöpfe mit `aria-pressed` in einer beschrifteten Gruppe. Sichtbar 36 px, die
 * Trefferfläche über ::before 44 px wie `FilterChip`.
 */
export type AnsichtWahl = 'liste' | 'karte'

const OPTIONEN: readonly { wert: AnsichtWahl; label: string }[] = [
  { wert: 'liste', label: 'Liste' },
  { wert: 'karte', label: 'Karte' },
]

export function AnsichtChips({ wert, onWahl, className }: { wert: AnsichtWahl; onWahl: (neu: AnsichtWahl) => void; className?: string }): React.JSX.Element {
  return (
    <div role="group" aria-label="Ansicht wählen" className={cn('flex shrink-0 gap-2', className)}>
      {OPTIONEN.map((o) => {
        const aktiv = o.wert === wert
        return (
          <button
            key={o.wert}
            type="button"
            aria-pressed={aktiv}
            onClick={() => onWahl(o.wert)}
            className={cn(
              "relative inline-flex h-9 items-center rounded-full border px-4 text-[13.5px] whitespace-nowrap transition-colors duration-[250ms] before:absolute before:inset-x-0 before:-inset-y-[5px] before:content-['']",
              aktiv ? 'border-foreground bg-foreground font-semibold text-background' : 'border-input bg-card font-medium text-foreground hover:bg-muted',
              FOKUS_RAHMEN
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
