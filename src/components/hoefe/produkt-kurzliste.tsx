import { formatGrundpreis } from '@/lib/format'
import { INKL_PLATTFORMGEBUEHR } from '@/lib/konditionen'
import type { VorschauProdukt } from '@/lib/hofuebersicht'
import { cn } from '@/lib/utils'

/** Eine Zeile „Name … Preis" (Board w1-startseite: „Heumilch frisch, 1 L … € 1,49"). */
export type KurzZeile = {
  id: string
  name: string
  /** Wie überall der Preis je Gebinde über formatGrundpreis („€ 1,49 / L", „€ 50,00 für 2 kg") — im Hofpreis-Modell schon der Endpreis. */
  preis: string
  /** Bestand abzüglich Reservierung über null — sonst steht „derzeit aus" statt des Preises. */
  verfuegbar: boolean
}

/**
 * Die Zeilen aus der Produktvorschau der Hofliste — EINE Quelle für Startseite und /hoefe.
 * Gerechnet wird nichts: Der Preis kommt aus der Liste (im Hofpreis-Modell der Endpreis) und
 * wird nur formatiert.
 */
export function produktKurzzeilen(produkte: readonly VorschauProdukt[]): { zeilen: KurzZeile[]; inklPlattformgebuehr: boolean } {
  return {
    zeilen: produkte.map((p) => ({ id: p.id, name: p.name, preis: formatGrundpreis(p.price, p.unit, p.unitSize), verfuegbar: p.verfuegbar })),
    inklPlattformgebuehr: produkte.some((p) => p.inklPlattformgebuehr === true),
  }
}

/**
 * Die Produktzeilen einer Hofkarte als Kurzliste „Name … Preis" (Boards w1-/s1-startseite und
 * w1-/s1-hoefe, Nr. 234): links der Name (gekürzt, voller Name im title), rechts der Preis, ohne
 * Vorschaubild; darunter einmal „inkl. Plattformgebühr", wenn die Preise sie enthalten (N38).
 * EINE Gestalt für die Startseite und die Hofkarte auf /hoefe (auch die eigene Hofkarte in
 * Region); die Zeilen baut produktKurzzeilen. Ohne eigene Links: Die Zeilen erben das Verhalten
 * der Karte (#82). „derzeit aus" steht statt des Preises — leise, aber nie verblasst (Kontrast).
 * `weitere` (Zahl der nicht gezeigten Produkte, nur /hoefe) sagt „+ n weitere Produkte".
 */
export function ProduktKurzliste({
  produkte,
  weitere = 0,
  className,
}: {
  produkte: readonly VorschauProdukt[]
  weitere?: number
  className?: string
}): React.JSX.Element | null {
  const { zeilen, inklPlattformgebuehr } = produktKurzzeilen(produkte)
  if (zeilen.length === 0) return null
  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      <ul className="flex flex-col gap-0.5">
        {zeilen.map((zeile) => (
          <li key={zeile.id} className="flex items-baseline justify-between gap-3 text-[14px]">
            <span title={zeile.name} className={cn('min-w-0 truncate', zeile.verfuegbar ? 'text-foreground' : 'text-muted-foreground')}>
              {zeile.name}
            </span>
            <span className={cn('shrink-0 whitespace-nowrap', zeile.verfuegbar ? 'text-foreground' : 'text-[13px] text-muted-foreground')}>
              {zeile.verfuegbar ? zeile.preis : 'derzeit aus'}
            </span>
          </li>
        ))}
      </ul>
      {weitere > 0 && (
        <p className="text-[13px] text-muted-foreground">
          + {weitere} {weitere === 1 ? 'weiteres Produkt' : 'weitere Produkte'}
        </p>
      )}
      {/* N38: Endpreise — einmal unter den Zeilen gesagt, nicht an jedem Preis. */}
      {inklPlattformgebuehr && <p className="text-[13px] text-muted-foreground">{INKL_PLATTFORMGEBUEHR}</p>}
    </div>
  )
}
