import { FilterChip, FilterChipReihe } from '@/components/ui/chip'
import type { UmfeldKm } from '@/lib/umfeld'

/** Die Zahl je Stufe gibt es nur mit ihrer Beschriftung für Screenreader — und umgekehrt. */
type Zahlen =
  | { zahlen?: undefined; zahlLabel?: undefined }
  | {
      /** Wie viele Höfe bzw. Angebote jede Stufe zählen würde (zaehleJeStufe in src/lib/region.ts). */
      zahlen: Partial<Record<UmfeldKm, number>>
      /** Beschriftung der Reihe, z. B. „Umkreis, Zahl der Höfe je Stufe". */
      zahlLabel: string
    }

/*
 * Umkreis 10 · 25 · 50 km als Chip-Gruppe (G11, Liste Lauf 32 region; vorher
 * eine Wanne mit Pillen). Jede Stufe ist ein Link mit eigener Adresse — der
 * Server rechnet neu, und Zurück führt zur vorigen Wahl. Die gewählte trägt
 * aria-current="page"; solange die neue Seite lädt, zeigt sie den Ladepunkt
 * (Register N14, die alte Ansicht bleibt stehen). Mit `zahlen` steht hinter
 * jeder Stufe, was sie zählen würde („10 km · 1", N23).
 * Ohne Hooks und ohne Funktionen als Props: Die Links kommen fertig herein,
 * damit Server- und Client-Seiten sie gleich einbinden.
 */
export function KmWahl({
  stufen,
  zahlen,
  zahlLabel,
}: { stufen: readonly { km: UmfeldKm; href: string; aktiv: boolean }[] } & Zahlen): React.JSX.Element {
  return (
    <FilterChipReihe beschriftung={zahlen ? zahlLabel : 'Umkreis'}>
      {stufen.map((s) => {
        const zahl = zahlen?.[s.km]
        return (
          <FilterChip key={s.km} href={s.href} aktiv={s.aktiv} ladePunkt className="tabular-nums">
            {s.km} km
            {zahl !== undefined && <span className="ml-1">· {zahl}</span>}
          </FilterChip>
        )
      })}
    </FilterChipReihe>
  )
}
