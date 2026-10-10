import Link from 'next/link'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import type { UmfeldKm } from '@/lib/umfeld'

/*
 * Umkreis 10 · 25 · 50 km als Wanne mit Pillen (Mockups web-h5-region-*).
 * Jede Stufe ist ein Link mit eigener Adresse — der Server rechnet neu, und
 * Zurück führt zur vorigen Wahl. Die gewählte trägt aria-current="page".
 * Ohne Hooks und ohne Funktionen als Props: Die Links kommen fertig herein,
 * damit Server- und Client-Seiten sie gleich einbinden.
 */
export function KmWahl({ stufen }: { stufen: readonly { km: UmfeldKm; href: string; aktiv: boolean }[] }): React.JSX.Element {
  return (
    <ul aria-label="Umkreis" className="inline-flex shrink-0 self-start gap-[3px] rounded-full border border-border bg-background p-[3px]">
      {stufen.map((s) => (
        <li key={s.km}>
          <Link
            href={s.href}
            aria-current={s.aktiv ? 'page' : undefined}
            // Sichtbar 32 px wie der Baustein Segment, Trefferfläche 44 px über ::before.
            className={cn(
              "relative inline-flex h-8 items-center rounded-full px-4 text-[13px] whitespace-nowrap tabular-nums transition-colors duration-[250ms] before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-['']",
              s.aktiv ? 'bg-border font-semibold text-foreground' : 'font-medium text-muted-foreground hover:text-foreground',
              FOKUS_RAHMEN
            )}
          >
            {s.km} km
          </Link>
        </li>
      ))}
    </ul>
  )
}
