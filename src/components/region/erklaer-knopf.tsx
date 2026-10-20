'use client'

import { Check, Info, X } from 'lucide-react'
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { cn } from '@/lib/utils'

/**
 * „So rechnen wir" als Baustein (Register N23, Board system-h5-region-eigene-
 * teile §4): ein echter Knopf mit (i), dessen `aria-label` der Titel ist
 * (Trefferfläche 44 px), öffnet einen Dialog mit Überschrift, den Punkten
 * und „Verstanden". Escape schließt, der Fokus geht zurück auf den Knopf —
 * beides tut der Dialog von Base UI selbst (ungesteuert über DialogTrigger,
 * finalFocus bleibt beim Auslöser). Am Handy steht er unten wie im Board.
 * Die Texte geben die Reiter (123 und 124) aus ihrer Quelle in src/lib.
 */
export function ErklaerKnopf({ titel, punkte }: { titel: string; punkte: readonly string[] }): React.JSX.Element {
  return (
    <Dialog>
      <DialogTrigger
        type="button"
        aria-label={titel}
        // Das Symbol ist 17 px, die Fläche 44 px — der negative Rand hält die Zeile so hoch wie ihr Text.
        className={cn('-m-3 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-status-fertig', FOKUS_RAHMEN)}
      >
        <Info className="size-[17px]" strokeWidth={1.8} aria-hidden="true" />
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="gap-3.5 max-sm:top-auto max-sm:bottom-0 max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-b-none"
      >
        <div className="flex items-center">
          <DialogTitle className="flex-1 font-heading text-[21px] leading-snug font-semibold text-foreground">{titel}</DialogTitle>
          <DialogClose
            className={cn(
              '-my-2.5 -mr-3 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors duration-[250ms] hover:text-foreground',
              FOKUS_RAHMEN
            )}
          >
            <X className="size-[18px]" strokeWidth={1.8} aria-hidden="true" />
            <span className="sr-only">Schließen</span>
          </DialogClose>
        </div>
        <ul className="flex flex-col gap-2.5">
          {punkte.map((punkt) => (
            <li key={punkt} className="flex gap-2.5 text-sm leading-normal text-foreground">
              <Check className="mt-[3px] size-[15px] shrink-0 text-status-fertig" strokeWidth={2.2} aria-hidden="true" />
              <span>{punkt}</span>
            </li>
          ))}
        </ul>
        <DialogClose
          className={cn(
            'inline-flex h-12 w-full items-center justify-center rounded-full bg-foreground text-[15px] font-semibold text-background transition-opacity duration-[250ms] hover:opacity-90',
            FOKUS_RAHMEN
          )}
        >
          Verstanden
        </DialogClose>
      </DialogContent>
    </Dialog>
  )
}
