'use client'

import type { ReactNode } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetBlatt, SheetClose, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { useMindestbreite } from '@/lib/use-mindestbreite'
import { cn } from '@/lib/utils'
import { KNOPF_GRUEN, KNOPF_ORANGE_RAHMEN, KNOPF_RAHMEN } from './stil'

export type Hauptaktion = {
  text: string
  onClick: () => void
  /** grün = Hauptaktion, orange = zerstörend (Orange-Umriss). */
  ton: 'gruen' | 'orange'
  laeuft?: boolean
  gesperrt?: boolean
}

/**
 * Die Rückfragen der Bestellungen (Storno, Artikel fehlt, Nicht abgeholt,
 * Rückwege): ab 768 px ein Dialog (Titel links, Aktionen rechts unten), am
 * Handy ein Blatt von unten mit der Hauptaktion über die volle Breite und
 * „Abbrechen" als Textknopf darunter (DESIGN_SYSTEM „Dialoge und Blätter").
 * Solange die Aktion läuft, schließt nichts — ein zweiter Tipp landet nicht.
 */
export function BestellDialog({
  offen,
  onOffenChange,
  titel,
  unterzeile,
  breite = 'schmal',
  hauptaktion,
  children,
}: {
  offen: boolean
  onOffenChange: (offen: boolean) => void
  titel: string
  unterzeile?: string
  breite?: 'schmal' | 'breit'
  hauptaktion: Hauptaktion
  children: ReactNode
}): React.JSX.Element {
  const breit = useMindestbreite(768)
  const laeuft = hauptaktion.laeuft === true
  const wechsel = (o: boolean) => {
    if (!laeuft) onOffenChange(o)
  }
  const hauptKnopf = (
    <button
      type="button"
      onClick={hauptaktion.onClick}
      disabled={laeuft || hauptaktion.gesperrt}
      aria-busy={laeuft || undefined}
      className={cn(hauptaktion.ton === 'gruen' ? KNOPF_GRUEN : KNOPF_ORANGE_RAHMEN, !breit && 'w-full rounded-[14px]')}
    >
      {laeuft ? 'Einen Moment …' : hauptaktion.text}
    </button>
  )

  if (breit) {
    return (
      <Dialog open={offen} onOpenChange={wechsel}>
        <DialogContent
          showCloseButton={false}
          className={cn('gap-4 p-[22px] md:p-6', breite === 'breit' ? 'sm:max-w-[600px]' : 'sm:max-w-[520px]')}
        >
          <div className="min-w-0">
            <DialogTitle className="font-heading text-[22px] leading-tight font-semibold break-words">{titel}</DialogTitle>
            {unterzeile && (
              <DialogDescription className="mt-1 text-[13px] break-words text-muted-foreground">{unterzeile}</DialogDescription>
            )}
          </div>
          {children}
          <div className="flex flex-wrap justify-end gap-2.5">
            <button type="button" onClick={() => wechsel(false)} disabled={laeuft} className={KNOPF_RAHMEN}>
              Abbrechen
            </button>
            {hauptKnopf}
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Sheet open={offen} onOpenChange={wechsel}>
      <SheetBlatt>
        <div className="min-w-0">
          <SheetTitle className="font-heading text-xl leading-tight font-semibold break-words">{titel}</SheetTitle>
          {unterzeile && <SheetDescription className="mt-1 text-[13px] break-words">{unterzeile}</SheetDescription>}
        </div>
        {children}
        {hauptKnopf}
        <SheetClose
          disabled={laeuft}
          className={cn('mx-auto min-h-11 rounded-full px-5 text-sm font-semibold text-status-fertig hover:bg-muted', FOKUS_RAHMEN)}
        >
          Abbrechen
        </SheetClose>
      </SheetBlatt>
    </Sheet>
  )
}

/** Fehler einer Aktion — inline im Dialog, orange (Register O1: kein Fehler-Token). */
export function DialogFehler({ text }: { text: string | null }): React.JSX.Element | null {
  if (!text) return null
  return (
    <p role="alert" className="rounded-xl border border-primary/45 bg-primary/12 px-3.5 py-2.5 text-[13px] font-medium text-foreground">
      {text}
    </p>
  )
}
