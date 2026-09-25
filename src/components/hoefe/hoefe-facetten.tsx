'use client'

import { useState } from 'react'
import { ArrowUpDown, ChevronDown } from 'lucide-react'
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { GROSSGEBINDE_AB_KG, type ProductLabelValue, type TierartValue } from '@/lib/taxonomie'
import type { Chip } from '@/lib/bereiche-anzeige'
import type { GebindeWahl, HoefeFilter } from '@/schemas/hoefe-filter'
import { cn } from '@/lib/utils'
import { mitAnzahl } from '@/lib/format'

/** Facetten sind ECKIG — so unterscheiden sie sich von den runden Kategorie-Chips. */
function FacettenChip({
  aktiv,
  onClick,
  children,
  ...rest
}: {
  aktiv: boolean
  onClick: () => void
  children: React.ReactNode
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'>) {
  return (
    <button
      type="button"
      aria-pressed={aktiv}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-9 items-center gap-1.5 rounded-md border px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        aktiv
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-foreground hover:bg-muted/40'
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

function umschalten<T>(liste: readonly T[], wert: T): T[] {
  return liste.includes(wert) ? liste.filter((w) => w !== wert) : [...liste, wert]
}

/**
 * Die Facetten der Hofübersicht (Konzept 6.2): Siegel in beiden Bereichen,
 * im Bereich Futtermittel dazu „Für Tiere" (Sheet mit Mehrfachwahl und
 * Trefferzahl im Knopf), „Gebinde: Klein | Groß" und die Sortierung nach
 * Kilopreis. Welche Optionen es gibt und was sie zählen, entscheidet
 * src/lib/bereiche-anzeige.ts — hier wird nur angezeigt.
 */
export function HoefeFacetten({
  filter,
  siegel,
  tiere,
  gebinde,
  onFilter,
  trefferMitTieren,
}: {
  filter: HoefeFilter
  siegel: Chip<ProductLabelValue>[]
  tiere: Chip<TierartValue>[]
  gebinde: Chip<GebindeWahl>[]
  onFilter: (aenderung: Partial<HoefeFilter>) => void
  /** Wie viele Höfe blieben mit dieser Tierwahl — für den Knopf im Sheet. */
  trefferMitTieren: (tiere: TierartValue[]) => number
}) {
  const [tiereOffen, setTiereOffen] = useState(false)
  const [entwurf, setEntwurf] = useState<TierartValue[]>([])
  const futter = filter.bereich === 'FUTTERMITTEL'

  if (siegel.length === 0 && !futter) return null

  const treffer = trefferMitTieren(entwurf)

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Weitere Filter">
      {siegel.map((chip) => (
        <FacettenChip
          key={chip.wert}
          aktiv={filter.siegel.includes(chip.wert)}
          onClick={() => onFilter({ siegel: umschalten(filter.siegel, chip.wert) })}
        >
          {chip.label}
        </FacettenChip>
      ))}

      {futter && tiere.length > 0 && (
        <FacettenChip
          aktiv={filter.tiere.length > 0}
          aria-haspopup="dialog"
          onClick={() => {
            setEntwurf(filter.tiere)
            setTiereOffen(true)
          }}
        >
          Für Tiere{filter.tiere.length > 0 ? ` (${filter.tiere.length})` : ''}
          <ChevronDown className="size-3.5" aria-hidden="true" />
        </FacettenChip>
      )}

      {futter && gebinde.length > 0 && (
        <span className="inline-flex items-center gap-2" role="group" aria-label="Gebinde">
          <span className="text-[13px] text-muted-foreground">Gebinde:</span>
          {gebinde.map((chip) => (
            <FacettenChip
              key={chip.wert}
              aktiv={filter.gebinde === chip.wert}
              title={
                chip.wert === 'KLEIN'
                  ? `Unter ${GROSSGEBINDE_AB_KG} kg je Gebinde`
                  : `Ab ${GROSSGEBINDE_AB_KG} kg je Gebinde`
              }
              onClick={() => onFilter({ gebinde: filter.gebinde === chip.wert ? null : chip.wert })}
            >
              {chip.label}
            </FacettenChip>
          ))}
        </span>
      )}

      {futter && (
        <FacettenChip
          aktiv={filter.sortierung === 'GRUNDPREIS'}
          onClick={() => onFilter({ sortierung: filter.sortierung === 'GRUNDPREIS' ? null : 'GRUNDPREIS' })}
        >
          <ArrowUpDown className="size-3.5" aria-hidden="true" />
          Günstigster Kilopreis
        </FacettenChip>
      )}

      <Sheet open={tiereOffen} onOpenChange={setTiereOffen}>
        <SheetContent side="bottom" className="mx-auto max-h-[85vh] max-w-lg rounded-t-2xl p-0">
          <SheetHeader className="px-5 pt-5 pb-1">
            <SheetTitle className="text-lg">Für welche Tiere?</SheetTitle>
            <p className="text-sm text-muted-foreground">Du kannst mehrere wählen.</p>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-2 overflow-y-auto px-5 py-3" role="group" aria-label="Tierarten">
            {tiere.map((chip) => (
              <FacettenChip
                key={chip.wert}
                aktiv={entwurf.includes(chip.wert)}
                onClick={() => setEntwurf((bisher) => umschalten(bisher, chip.wert))}
              >
                <span className="flex-1 text-left">{chip.label}</span>
                <span className="tabular-nums opacity-80">{chip.anzahl}</span>
              </FacettenChip>
            ))}
          </div>
          <SheetFooter className="flex-row gap-2 border-t border-border px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 flex-1"
              onClick={() => setEntwurf([])}
              disabled={entwurf.length === 0}
            >
              Zurücksetzen
            </Button>
            <Button
              type="button"
              className="min-h-11 flex-[2]"
              disabled={treffer === 0}
              onClick={() => {
                onFilter({ tiere: entwurf })
                setTiereOffen(false)
              }}
            >
              {treffer === 0 ? 'Kein Hof passt' : `${mitAnzahl(treffer, 'Hof', 'Höfe')} anzeigen`}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
