import { cn } from '@/lib/utils'
import type { UnterreiterDaten } from '@/lib/admin-seiten'
import { FilterChip } from '@/components/ui/chip'

/**
 * Die zweite Ebene unter den Reitern der AdminShell (Register N15, Nr. 94):
 * Pillen mit einer Zahl, als echte Links mit dem Parameter `reiter` in der
 * Adresse — teilbar, der Zurück-Pfeil tut das Richtige. Der gewählte Reiter
 * trägt `aria-current="page"`. Gezeichnet werden sie vom `FilterChip` (sichtbar
 * 36 px, die Tippfläche reicht über ::before auf 44 px); eine neue Gestalt gibt
 * es nicht. Die Pillen scrollen am Handy waagrecht, statt umzubrechen.
 *
 * `onNavigate`: Wendet die Seite ihren Reiter selbst im Browser an (Höfe,
 * `history.replaceState` und `preventDefault()`), gibt sie ihn mit; der Link
 * bleibt ein Link (Mittelklick, neuer Tab). Ohne ihn lädt der Link die Seite.
 */
export function Unterreiter({
  beschriftung,
  eintraege,
  aktiv,
  onNavigate,
  className,
}: {
  /** Wofür der Reiter wählt, für Screenreader: „Ansicht der Höfe“. */
  beschriftung: string
  eintraege: readonly UnterreiterDaten[]
  /** Die Kennung des gewählten Reiters; null = keiner. */
  aktiv: string | null
  onNavigate?: (ereignis: { preventDefault: () => void }, eintrag: UnterreiterDaten) => void
  className?: string
}): React.JSX.Element {
  return (
    <nav aria-label={beschriftung} className={cn('-mx-4 overflow-x-auto px-4 py-1 md:mx-0 md:px-0', className)}>
      <ul className="flex gap-2 md:flex-wrap">
        {eintraege.map((e) => {
          const gewaehlt = e.id === aktiv
          return (
            <li key={e.id}>
              <FilterChip href={e.href} aktiv={gewaehlt} onNavigate={onNavigate ? (ereignis) => onNavigate(ereignis, e) : undefined}>
                {e.labelKurz ? (
                  <>
                    <span className="md:hidden">{e.labelKurz}</span>
                    <span className="hidden md:inline">{e.label}</span>
                  </>
                ) : (
                  e.label
                )}
                {e.zahl !== undefined && (
                  <span className={cn('ml-1.5 text-[12px] font-semibold tabular-nums', !gewaehlt && 'text-muted-foreground')}>{e.zahl}</span>
                )}
              </FilterChip>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
