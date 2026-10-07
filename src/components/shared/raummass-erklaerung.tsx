import { RAUMMASS_ERKLAERUNG } from '@/lib/verkaufsgroessen'
import { cn } from '@/lib/utils'

/*
 * „Was ist was?" — Raummeter, Schüttraummeter und Festmeter, erklärt beim
 * ersten Vorkommen auf der Seite (DESIGN_SYSTEM „Futtermittel und
 * Brennmaterial"; Mockups web-h2-neues-brennmaterial, web-k2-brennmaterial-
 * brennholz). EINE Komponente für das Brennmaterial-Formular des Hofs und die
 * Produktseite der Kundin; die Sätze stehen in src/lib/verkaufsgroessen.ts.
 */
export function RaummassErklaerung({ className }: { className?: string }): React.JSX.Element {
  return (
    <div className={cn('rounded-xl border border-border bg-muted/50 px-4 py-3', className)}>
      <p className="text-[13px] font-semibold text-foreground">Was ist was?</p>
      <dl className="mt-1.5 flex flex-col gap-1 text-[12.5px] leading-snug">
        {RAUMMASS_ERKLAERUNG.map((e) => (
          <div key={e.kurz}>
            <dt className="inline font-semibold text-foreground">{e.kurz}</dt>
            <dd className="inline text-muted-foreground"> – {e.text}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

