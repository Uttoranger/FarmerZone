import { INKL_PLATTFORMGEBUEHR } from '@/lib/konditionen'
import type { VorschauProdukt } from '@/lib/hofuebersicht'
import { cn } from '@/lib/utils'
import { kurzPreis } from '@/components/hofseite/preis-zeilen'

// Eine Zeile „Name … Preis" (Board w1-startseite: „Heumilch frisch, 1 L … € 1,49"): seit Nr. 252 der Name mit dem
// Gebinde und der Preis des Gebindes (kurzPreis; im Hofpreis-Modell schon der Endpreis), ohne Gebinde der Preis je
// Einheit; nicht verfügbar (Bestand abzüglich Reservierung über null) steht „derzeit aus" statt des Preises.
type KurzZeile = { id: string; name: string; preis: string; verfuegbar: boolean }

// Die Zeilen aus der Produktvorschau der Hofliste. Gerechnet wird nichts: Der Preis kommt aus der
// Liste und wird nur formatiert.
function produktKurzzeilen(produkte: readonly VorschauProdukt[]): { zeilen: KurzZeile[]; inklPlattformgebuehr: boolean } {
  return {
    zeilen: produkte.map((p) => ({ id: p.id, ...kurzPreis(p), verfuegbar: p.verfuegbar })),
    inklPlattformgebuehr: produkte.some((p) => p.inklPlattformgebuehr === true),
  }
}

/**
 * Die Produktzeilen einer Hofkarte als Kurzliste „Name … Preis" (Boards w1-/s1-startseite und
 * w1-/s1-hoefe, Nr. 234): links der Name (gekürzt, voller Name im title), rechts der Preis, ohne
 * Vorschaubild; darunter einmal „inkl. Plattformgebühr", wenn die Preise sie enthalten (N38).
 * EINE Gestalt für die Startseite und die Hofkarte auf /hoefe (auch die eigene Hofkarte in
 * Region); die Zeilen baut produktKurzzeilen (oben). Ohne eigene Links: Die Zeilen erben das Verhalten
 * der Karte (#82). „derzeit aus" steht statt des Preises — leise, aber nie verblasst (Kontrast).
 * `weitere` (Zahl der nicht gezeigten Produkte, nur /hoefe) sagt „+ n weitere Produkte".
 */
export function ProduktKurzliste({
  produkte,
  weitere = 0,
  fliess = false,
  className,
}: {
  produkte: readonly VorschauProdukt[]
  weitere?: number
  /** Eine Fließzeile „Name Preis · Name Preis“ statt der Zeilen (Board w1-hoefe, Liste Lauf 32, Nr. 252). */
  fliess?: boolean
  className?: string
}): React.JSX.Element | null {
  const { zeilen, inklPlattformgebuehr } = produktKurzzeilen(produkte)
  if (zeilen.length === 0) return null
  if (fliess) {
    return (
      <div className={cn('flex flex-col gap-0.5', className)}>
        <ul className="flex flex-wrap gap-x-1.5 text-[14px] text-foreground">
          {zeilen.map((zeile, i) => (
            <li key={zeile.id} className={cn('min-w-0', !zeile.verfuegbar && 'text-muted-foreground')}>
              {zeile.name} <span className="whitespace-nowrap">{zeile.verfuegbar ? zeile.preis : 'derzeit aus'}</span>
              {i < zeilen.length - 1 && <span aria-hidden="true"> ·</span>}
            </li>
          ))}
        </ul>
        {inklPlattformgebuehr && <p className="text-[13px] text-muted-foreground">{INKL_PLATTFORMGEBUEHR}</p>}
      </div>
    )
  }
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
