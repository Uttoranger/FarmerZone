import Link from 'next/link'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { LadePunkt } from '@/components/ui/lade-punkt'
import type { UmfeldKm } from '@/lib/umfeld'

/** Die Zahl je Stufe gibt es nur mit ihrer Beschriftung für Screenreader — und umgekehrt. */
type Zahlen =
  | { zahlen?: undefined; zahlLabel?: undefined }
  | {
      /** Wie viele Höfe bzw. Angebote jede Stufe zählen würde (zaehleJeStufe in src/lib/region.ts). */
      zahlen: Partial<Record<UmfeldKm, number>>
      /** Beschriftung der Wanne, z. B. „Umkreis, Zahl der Höfe je Stufe". */
      zahlLabel: string
    }

/*
 * Umkreis 10 · 25 · 50 km als Wanne mit Pillen (Mockups web-h5-region-*,
 * Board system-h5-region-eigene-teile §4). Jede Stufe ist ein Link mit eigener
 * Adresse — der Server rechnet neu, und Zurück führt zur vorigen Wahl. Die
 * gewählte trägt aria-current="page"; solange die neue Seite lädt, zeigt sie
 * den Ladepunkt (Register N14, die alte Ansicht bleibt stehen). Mit `zahlen`
 * steht hinter jeder Stufe, was sie zählen würde („25 km 8", N23).
 * Ohne Hooks und ohne Funktionen als Props: Die Links kommen fertig herein,
 * damit Server- und Client-Seiten sie gleich einbinden.
 */
export function KmWahl({
  stufen,
  zahlen,
  zahlLabel,
}: { stufen: readonly { km: UmfeldKm; href: string; aktiv: boolean }[] } & Zahlen): React.JSX.Element {
  return (
    <ul
      aria-label={zahlen ? zahlLabel : 'Umkreis'}
      className="inline-flex shrink-0 self-start gap-[3px] rounded-full border border-border bg-background p-[3px]"
    >
      {stufen.map((s) => {
        const zahl = zahlen?.[s.km]
        return (
          <li key={s.km}>
            <Link
              href={s.href}
              aria-current={s.aktiv ? 'page' : undefined}
              // Sichtbar 36 px, Trefferfläche 44 px über ::before (4 px oben und unten) — mit und ohne Zahl gleich hoch.
              className={cn(
                "relative inline-flex h-9 items-center gap-1.5 rounded-full px-[13px] text-[13px] whitespace-nowrap tabular-nums transition-colors duration-[250ms] before:absolute before:inset-x-0 before:-inset-y-1 before:content-['']",
                s.aktiv ? 'bg-border font-semibold text-foreground' : 'font-medium text-muted-foreground hover:text-foreground',
                FOKUS_RAHMEN
              )}
            >
              {s.km} km
              {zahl !== undefined && <span className="text-[11.5px] font-medium">{zahl}</span>}
              <LadePunkt />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
