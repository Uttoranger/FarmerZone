'use client'

import { useEffect, useId } from 'react'
import { Check, Share2, X } from 'lucide-react'
import { Sheet, SheetBlatt, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { teileHof } from '@/components/shared/hof-teilen'
import { useMindestbreite } from '@/lib/use-mindestbreite'
import { cn } from '@/lib/utils'
import type { WiederDaTexte } from '@/lib/produkte-hof'

/*
 * Moment „wieder da" (Mockups web-h2-ware-wieder-da-teilen,
 * mobil-h2-gespeichert-teilen; Nachtlauf Nr. 18). Ob er kommt, haben vorher
 * entschieden: der Server (Vorrat 0 → mehr, bedingt gesetzt), die Ansicht
 * (Hof und Produkt sichtbar, wiederDaMomentMoeglich) und der Merker des Geräts
 * (je Produkt und Woche einmal, src/lib/wieder-da-moment.ts). Hier wird nur
 * gezeigt.
 *
 * Web: schwebende Karte unten rechts, ohne Schleier — der Hof soll in der
 * Tabelle weiterarbeiten können; Escape oder „Nicht jetzt" schließen. Handy:
 * Blatt von unten. Geteilt wird die Hofseite über teileHof mit dem
 * vorgeschlagenen Satz, ohne Zählung (Gate 7).
 */
export function WiederDaMoment({
  texte,
  hof,
  onSchliessen,
}: {
  texte: WiederDaTexte
  hof: { name: string; slug: string }
  onSchliessen: () => void
}): React.JSX.Element {
  const breit = useMindestbreite(768)
  const titelId = useId()

  useEffect(() => {
    if (!breit) return
    const beiTaste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSchliessen()
    }
    document.addEventListener('keydown', beiTaste)
    return () => document.removeEventListener('keydown', beiTaste)
  }, [breit, onSchliessen])

  function teilen() {
    onSchliessen()
    void teileHof(hof, { text: texte.teilenText })
  }

  const zeichen = (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
      <Check className="size-3.5" strokeWidth={2.4} aria-hidden="true" />
    </span>
  )
  const zitat = (
    <p className="rounded-[10px] border border-border bg-background px-3 py-2.5 text-[12.5px] leading-normal text-foreground">
      „{texte.teilenText}“
    </p>
  )
  const teilenKnopf = (
    <button
      type="button"
      onClick={teilen}
      className={cn(
        'inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-primary-foreground/25 bg-primary px-4 text-[13.5px] font-semibold text-primary-foreground transition-opacity duration-[250ms] hover:opacity-90',
        FOKUS_RAHMEN
      )}
    >
      <Share2 className="size-4" strokeWidth={1.7} aria-hidden="true" />
      Teilen
    </button>
  )
  const nichtJetzt = (
    <button
      type="button"
      onClick={onSchliessen}
      className={cn('min-h-11 rounded-full px-[18px] text-sm font-semibold text-status-fertig hover:bg-muted', FOKUS_RAHMEN)}
    >
      Nicht jetzt
    </button>
  )

  if (breit) {
    return (
      // Kein Dialog mit Fokusfalle: Die Karte schwebt über der Tabelle, der Fokus
      // bleibt am Stepper. Angesagt wird sie über die Live-Region.
      <section
        aria-labelledby={titelId}
        aria-live="polite"
        className="fixed right-9 bottom-[30px] z-50 flex w-[400px] flex-col gap-2.5 rounded-2xl border border-primary/55 bg-card p-4 shadow-2xl shadow-primary-foreground/40"
      >
        <div className="flex items-center gap-2.5">
          {zeichen}
          <h2 id={titelId} className="min-w-0 flex-1 text-[14.5px] font-semibold break-words text-foreground">
            {texte.titel}
          </h2>
          <button
            type="button"
            onClick={onSchliessen}
            aria-label="Schließen"
            className={cn('-mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted', FOKUS_RAHMEN)}
          >
            <X className="size-4" strokeWidth={1.7} aria-hidden="true" />
          </button>
        </div>
        <p className="text-[13px] leading-normal text-muted-foreground">{texte.satz}</p>
        {zitat}
        <div className="flex gap-2">
          {teilenKnopf}
          {nichtJetzt}
        </div>
      </section>
    )
  }

  return (
    <Sheet open onOpenChange={(offen) => !offen && onSchliessen()}>
      <SheetBlatt>
        <div className="flex items-center gap-2.5">
          {zeichen}
          <SheetTitle className="min-w-0 text-base font-semibold break-words">{texte.titel}</SheetTitle>
        </div>
        <SheetDescription className="text-[13px] leading-normal text-muted-foreground">{texte.satz}</SheetDescription>
        {zitat}
        <div className="flex flex-col gap-1 [&>button:first-child]:h-12 [&>button:first-child]:w-full [&>button:first-child]:rounded-full">
          {teilenKnopf}
          {nichtJetzt}
        </div>
      </SheetBlatt>
    </Sheet>
  )
}
