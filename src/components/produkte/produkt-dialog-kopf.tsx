'use client'

import { ChevronLeft, XIcon } from 'lucide-react'
import { DialogClose, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { RUNDUNG } from '@/components/ui/rundung'
import { cn } from '@/lib/utils'

/**
 * Der Kopf der Produkt-Formulare (Lebensmittel, Futter, Brennmaterial), Liste Lauf 32 (produkt-neu 390):
 * am Handy „‹“ links, Titel, darunter die Produktart; der Erklärsatz entfällt dort. Ab 640 px Titel und
 * Erklärsatz wie bisher mit dem Kreuz rechts. Der Aufrufer setzt am DialogContent `showCloseButton={false}` —
 * beide Wege zum Schließen stellt dieser Kopf, je nach Breite einer.
 */
export function ProduktDialogKopf({
  titel,
  art,
  satz,
  zurueckGesperrt = false,
}: {
  titel: string
  /** „Lebensmittel“, „Futtermittel“, „Brennmaterial“ — die Unterzeile am Handy. */
  art: string
  /** Der Erklärsatz ab 640 px; am Handy steht stattdessen die Produktart. */
  satz?: string
  /** Während des Speicherns schließt der Pfeil nicht (wie „Abbrechen“). */
  zurueckGesperrt?: boolean
}): React.JSX.Element {
  return (
    <div className="flex shrink-0 items-center gap-1 border-border px-2 pt-2 pb-2 max-sm:border-b max-sm:bg-card sm:px-6 sm:pt-6 sm:pb-3">
      <DialogClose
        disabled={zurueckGesperrt}
        className={cn(
          'grid size-11 shrink-0 place-items-center text-foreground transition-colors duration-[250ms] hover:bg-muted disabled:opacity-50 sm:hidden',
          RUNDUNG.feld,
          FOKUS_RAHMEN
        )}
      >
        <ChevronLeft className="size-[22px]" strokeWidth={2} aria-hidden="true" />
        <span className="sr-only">Zurück</span>
      </DialogClose>
      <div className="min-w-0 flex-1">
        <DialogTitle className="font-heading text-lg font-semibold text-foreground sm:text-xl md:text-2xl">{titel}</DialogTitle>
        <p className="text-[13px] text-muted-foreground sm:hidden">{art}</p>
        {satz && <DialogDescription className="mt-1 text-[13px] text-muted-foreground max-sm:hidden">{satz}</DialogDescription>}
      </div>
      {/* Ab 640 px das Kreuz oben rechts, wie es der Dialog sonst selbst zeichnet (44 px, sichtbarer Kreis 28 px). */}
      <DialogClose
        disabled={zurueckGesperrt}
        className={cn(
          'group/kreuz -mt-3 -mr-3 grid size-11 shrink-0 place-items-center self-start rounded-full text-foreground disabled:opacity-50 max-sm:hidden',
          FOKUS_RAHMEN
        )}
      >
        <span aria-hidden="true" className="flex size-7 items-center justify-center rounded-full transition-colors group-hover/kreuz:bg-muted">
          <XIcon className="size-4" />
        </span>
        <span className="sr-only">Schließen</span>
      </DialogClose>
    </div>
  )
}
