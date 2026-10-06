'use client'

import { useState, type ReactNode } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { Sheet, SheetBlatt, SheetClose, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

/**
 * Die Filter am Handy als Blatt (Mockup mobil-k1-filter): Umkreis, „Was
 * suchst du?", Menge (nur bei Futtermitteln), Siegel — dieselben Chips wie
 * im Browser, also echte Links, die beim Tippen sofort wirken (die Liste
 * dahinter ändert sich mit). Unten die Hauptaktion „N … anzeigen" (schließt
 * nur), darunter „Abbrechen": Es stellt den Stand vom Öffnen wieder her —
 * sonst hieße Abbrechen dasselbe wie Anzeigen.
 *
 * Die Reihen kommen als Kinder herein; das Blatt selbst kennt keinen Filter.
 */
export function EntdeckenFilterblatt({
  anzahlFilter,
  anzeigenText,
  zuruecksetzen,
  onOeffnen,
  onAbbrechen,
  children,
}: {
  /** Die Zahl am Knopf („Filter · 2"); 0 = keine. */
  anzahlFilter: number
  /** „3 Angebote anzeigen" — die Hauptaktion. */
  anzeigenText: string
  /** Der Link „Zurücksetzen" oben rechts, null ohne gesetzte Filter. */
  zuruecksetzen: ReactNode
  /** Merkt sich den Stand beim Öffnen … */
  onOeffnen: () => void
  /** … und stellt ihn bei „Abbrechen" wieder her. */
  onAbbrechen: () => void
  children: ReactNode
}): React.JSX.Element {
  const [offen, setOffen] = useState(false)

  return (
    <Sheet
      open={offen}
      onOpenChange={(neu) => {
        if (neu) onOeffnen()
        setOffen(neu)
      }}
    >
      <SheetTrigger
        className={cn(
          'inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-4 text-[13.5px] font-semibold text-foreground transition-colors duration-[250ms] hover:bg-muted',
          FOKUS_RAHMEN
        )}
      >
        <SlidersHorizontal className="size-4" strokeWidth={1.7} aria-hidden="true" />
        Filter
        {anzahlFilter > 0 && (
          <>
            <span aria-hidden="true">· {anzahlFilter}</span>
            <span className="sr-only">, {anzahlFilter} gesetzt</span>
          </>
        )}
      </SheetTrigger>
      <SheetBlatt>
        <div className="flex items-center justify-between gap-2">
          <SheetTitle className="font-heading text-xl font-semibold">Filter</SheetTitle>
          {zuruecksetzen}
        </div>
        <div className="flex flex-col gap-4">{children}</div>
        <SheetClose
          className={cn(
            'mt-1 h-12 w-full rounded-[14px] bg-accent text-[15px] font-semibold text-accent-foreground transition-opacity duration-[250ms] hover:opacity-90',
            FOKUS_RAHMEN
          )}
        >
          {anzeigenText}
        </SheetClose>
        <button
          type="button"
          onClick={() => {
            onAbbrechen()
            setOffen(false)
          }}
          className={cn('mx-auto min-h-11 rounded-full px-5 text-sm font-semibold text-status-fertig hover:bg-muted', FOKUS_RAHMEN)}
        >
          Abbrechen
        </button>
      </SheetBlatt>
    </Sheet>
  )
}

/** Eine Gruppe im Blatt: leise Überschrift in Großbuchstaben, darunter die Chips. */
export function BlattGruppe({ titel, children }: { titel: string; children: ReactNode }): React.JSX.Element {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[11.5px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">{titel}</h3>
      {children}
    </section>
  )
}
