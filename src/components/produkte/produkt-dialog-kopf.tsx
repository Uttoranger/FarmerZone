'use client'

import { ChevronLeft } from 'lucide-react'
import { DialogClose, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { RUNDUNG } from '@/components/ui/rundung'
import { cn } from '@/lib/utils'

/**
 * Am Handy versteckt diese Klasse am DialogContent das Kreuz oben rechts — dort führt der Pfeil links
 * aus dem Kopf zurück (Liste Lauf 32, produkt-neu 390). Ab 640 px bleibt das Kreuz des Dialogs.
 */
export const KREUZ_NUR_AB_SM = 'max-sm:[&>[data-slot=dialog-close]]:hidden'

/**
 * Der Kopf der Produkt-Formulare (Lebensmittel, Futter, Brennmaterial), Liste Lauf 32 (produkt-neu 390):
 * am Handy „‹“ links, Titel, darunter die Produktart; der Erklärsatz entfällt dort. Ab 640 px Titel und
 * Erklärsatz wie bisher, das Kreuz rechts stellt der Dialog.
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
      <div className="min-w-0 flex-1 sm:pr-10">
        <DialogTitle className="font-heading text-lg font-semibold text-foreground sm:text-xl md:text-2xl">{titel}</DialogTitle>
        <p className="text-[13px] text-muted-foreground sm:hidden">{art}</p>
        {satz && <DialogDescription className="mt-1 text-[13px] text-muted-foreground max-sm:hidden">{satz}</DialogDescription>}
      </div>
    </div>
  )
}
