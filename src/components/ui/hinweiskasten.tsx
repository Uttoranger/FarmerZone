import type { ReactNode } from 'react'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { RUNDUNG } from '@/components/ui/rundung'
import { cn } from '@/lib/utils'

/**
 * Hinweiskasten (Baustein G3, Nr. 245; Liste Lauf 32, Abschnitt 3.2) — die
 * Gestalt des Hof-Balkens und jedes Hinweises auf Offenes beim Hof, der unter
 * dem Seitenkopf in der Inhaltsspalte steht (nie über der h1, nie über die
 * ganze Breite).
 *
 * Braun getönte Fläche (`bg-zustand-tun-grund`, Rand `zustand-tun` zu 30 %),
 * Radius 12 px (`RUNDUNG.hinweis`), Titel in `text-status-offen` etwas größer
 * als der Satz, der Satz im selben Warnton (seit Nr. 269, Abnahme Lauf 32
 * „Fließtext neutral statt Warnton“; vorher Textfarbe). Ohne Symbol, ohne
 * Uhr — Titel und Satz tragen die Bedeutung. Kontrast: `status-offen` auf
 * `zustand-tun-grund` ≥ 4,5:1 in beiden Themes (dasselbe Paar wie
 * `HinweiskarteFehler`; gerechnet aus globals.css in tests/bausteine-269.test.ts).
 *
 * Additiv neben `Hinweiskarte` (hinweiskarte.tsx bleibt unverändert, Nr. 246
 * stellt dort um). `role="status"`: der Zustand des Hofs, keine Störung.
 */
export function Hinweiskasten({
  titel,
  children,
  aktion,
  className,
}: {
  titel: ReactNode
  /** Ein Satz (oder wenige) unter dem Titel. */
  children?: ReactNode
  /** Ein Link oder Knopf darunter, z. B. `HinweiskastenLink`. */
  aktion?: ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <div
      role="status"
      data-hinweiskasten=""
      className={cn('flex flex-col gap-1 border border-zustand-tun/30 bg-zustand-tun-grund px-3.5 py-3 text-status-offen', RUNDUNG.hinweis, className)}
    >
      <p className="text-[16px] leading-snug font-bold">{titel}</p>
      {children && <div className={HINWEISKASTEN_SATZ}>{children}</div>}
      {aktion && <div className="flex flex-wrap gap-2">{aktion}</div>}
    </div>
  )
}

/** Der Satz im Hinweiskasten: 14 px im Warnton wie der Titel (G3, Nr. 269) — die Farbe erbt er vom Kasten. */
export const HINWEISKASTEN_SATZ = 'text-[14px] leading-normal text-status-offen'

/** Der Link im Hinweiskasten: 15 px halbfett, unterstrichen, im Ton des Titels, 44 px hoch (V16). */
export const HINWEISKASTEN_LINK = cn(
  'inline-flex min-h-11 w-fit items-center text-[15px] font-semibold break-words text-status-offen underline underline-offset-2',
  FOKUS_RAHMEN
)
