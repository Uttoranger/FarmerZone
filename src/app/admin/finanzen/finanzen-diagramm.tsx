import { formatEuro } from '@/lib/format'
import { centsAlsEuro } from '@/lib/servicegebuehr'
import { cn } from '@/lib/utils'
import type { FinanzenVerlaufPunkt } from '@/server/queries/finanzen'

/**
 * Einnahmen und Kosten je Monat als Balkenpaar — seit der ersten Bestellung,
 * höchstens zwölf Monate (Mockup admin-finanzen, „Wann trägt sich die
 * Plattform?"; im neuen Design seit Nr. 22f).
 *
 * Reine Balken aus Tokens statt Recharts: `bg-accent` für Einnahmen,
 * `bg-primary` gedämpft für Kosten — so folgen sie beiden Themes ohne
 * Farbwerte in JavaScript (wie die Umsatzbalken der Auswertung). Die Höhe ist
 * nur Darstellung (Anteil am größten Wert, aus ganzen Cent); die Zahlen stehen
 * für Screenreader als Tabelle daneben.
 */
export function FinanzenDiagramm({ punkte }: { punkte: FinanzenVerlaufPunkt[] }): React.JSX.Element {
  const alleNull = punkte.every((p) => p.einnahmenCents === 0 && p.kostenCents === 0)
  if (alleNull) {
    return (
      <p className="py-6 text-[14px] text-muted-foreground">
        Noch nichts zu zeigen — sobald Bestellungen eingehen oder Kosten eingetragen sind, stehen hier die Monate
        nebeneinander.
      </p>
    )
  }

  const hoechster = Math.max(1, ...punkte.map((p) => Math.max(p.einnahmenCents, p.kostenCents)))
  const hoehe = (cents: number) => `${Math.max(cents > 0 ? 2 : 0, Math.round((cents / hoechster) * 100))}%`

  return (
    <div>
      <div aria-hidden="true" className="flex h-44 items-end gap-2 border-b border-border md:gap-4">
        {punkte.map((p) => (
          <div key={p.monat} className="flex h-full min-w-0 flex-1 items-end justify-center gap-1">
            <span className="w-full max-w-[18px] rounded-t-[3px] bg-accent" style={{ height: hoehe(p.einnahmenCents) }} />
            <span className="w-full max-w-[18px] rounded-t-[3px] bg-primary/60" style={{ height: hoehe(p.kostenCents) }} />
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="mt-1.5 flex gap-2 md:gap-4">
        {punkte.map((p) => (
          <span key={p.monat} className="min-w-0 flex-1 truncate text-center text-[11.5px] text-muted-foreground">
            {p.kurz}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>Einnahmen und Kosten je Monat</caption>
        <thead>
          <tr>
            <th scope="col">Monat</th>
            <th scope="col">Einnahmen</th>
            <th scope="col">Kosten</th>
          </tr>
        </thead>
        <tbody>
          {punkte.map((p) => (
            <tr key={p.monat}>
              <th scope="row">{p.kurz}</th>
              <td>{formatEuro(centsAlsEuro(p.einnahmenCents))}</td>
              <td>{formatEuro(centsAlsEuro(p.kostenCents))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Die Legende über dem Diagramm (Mockup: Einnahmen · Kosten). */
export function DiagrammLegende({ className }: { className?: string }): React.JSX.Element {
  return (
    <p aria-hidden="true" className={cn('flex gap-3 text-[12px] text-muted-foreground', className)}>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2.5 rounded-[2px] bg-accent" />
        Einnahmen
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2.5 rounded-[2px] bg-primary/60" />
        Kosten
      </span>
    </p>
  )
}
