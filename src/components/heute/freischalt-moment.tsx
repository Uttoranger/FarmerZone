'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, Printer } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetBlatt, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { HofTeilenKnopf } from '@/components/farmer/hof-teilen-knopf'
import {
  browserSpeicher,
  freischaltMomentOeffnen,
  leseFreischaltGesehen,
  merkeFreischaltGesehen,
} from '@/lib/freischalt-moment'
import { useMindestbreite } from '@/lib/use-mindestbreite'
import { PLAKAT_PFAD } from '@/lib/teilen-fenster'
import { cn } from '@/lib/utils'

/*
 * „Dein Hof ist online!" (Mockup web-h1-freigeschaltet-jetzt-teilen,
 * Nachtlauf Nr. 17). Die Seite bindet ihn nur ein, wenn der Server
 * `freischaltMomentMoeglich` bejaht hat (Zeitfenster nach der Freigabe, Hof
 * sichtbar, nicht pausiert); hier zählt nur noch der Merker des Geräts. Er wird gesetzt,
 * sobald der Moment aufgeht — höchstens einmal, auch wenn die Seite danach
 * ohne Schließen neu lädt. Ohne lesbaren Speicher kommt er gar nicht.
 *
 * Geteilt wird die Hofseite über teileHof (HofTeilenKnopf); seit Nr. 21
 * (Gate 7) dazu „Plakat drucken" (QR-Plakat). „Stammkunden per WhatsApp"
 * aus dem Mockup bleibt beim Beitrag mit WhatsApp-Versand (/status/new) —
 * der Moment verspricht nichts, was es hier nicht gibt.
 * Web: Dialog; Handy: Blatt von unten (DESIGN_SYSTEM „Dialoge und Blätter").
 */
export function FreischaltMoment({
  farmId,
  hofName,
  hofSlug,
}: {
  farmId: string
  hofName: string
  hofSlug: string
}): React.JSX.Element | null {
  const [offen, setOffen] = useState(false)
  const breit = useMindestbreite(768)

  useEffect(() => {
    // Der Speicher existiert erst im Browser — deshalb nach dem Einhängen, nie beim Rendern.
    const speicher = browserSpeicher()
    if (!freischaltMomentOeffnen(leseFreischaltGesehen(speicher, farmId))) return
    merkeFreischaltGesehen(speicher, farmId)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- einmaliges Öffnen nach dem Lesen des Gerätespeichers, den der Server nicht kennt
    setOffen(true)
  }, [farmId])

  const titel = 'Dein Hof ist online!'
  const satz = 'Ab jetzt können Kunden bei dir bestellen. Am schnellsten finden dich die, die dich schon kennen – sag ihnen Bescheid.'

  const inhalt = (Titel: typeof DialogTitle | typeof SheetTitle, Satz: typeof DialogDescription | typeof SheetDescription) => (
    <div className="flex flex-col items-center gap-3.5 text-center">
      <span className="flex size-[70px] items-center justify-center rounded-full bg-accent/28">
        <span className="flex size-[42px] items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Check className="size-6" strokeWidth={2.2} aria-hidden="true" />
        </span>
      </span>
      <Titel className="font-heading text-[26px] font-semibold md:text-[28px]">{titel}</Titel>
      <Satz className="max-w-sm text-[13px] leading-normal text-muted-foreground">{satz}</Satz>
      {/* Nach dem Teilen ist der Moment erledigt — das Teilen-Menü des Geräts liegt dann obenauf. */}
      <div className="mt-1.5 flex w-full justify-center" onClickCapture={() => setOffen(false)}>
        <HofTeilenKnopf
          name={hofName}
          slug={hofSlug}
          label="Hof teilen"
          className={cn(
            'inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-primary-foreground/25 bg-primary px-4 text-[13.5px] font-semibold text-primary-foreground transition-opacity duration-[250ms] hover:opacity-90 md:w-auto',
            FOKUS_RAHMEN
          )}
        />
      </div>
      {/* Seit Nr. 21 (Gate 7): der Aushang für alle, die am Hof vorbeikommen. */}
      <Link
        href={PLAKAT_PFAD}
        className={cn(
          'inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 text-[13.5px] font-semibold transition-colors duration-[250ms] hover:bg-muted md:w-auto',
          FOKUS_RAHMEN
        )}
      >
        <Printer className="size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
        Plakat drucken
      </Link>
      <button
        type="button"
        onClick={() => setOffen(false)}
        className={cn('min-h-11 rounded-full px-5 text-sm font-semibold text-status-fertig hover:bg-muted', FOKUS_RAHMEN)}
      >
        Später
      </button>
    </div>
  )

  if (breit) {
    return (
      <Dialog open={offen} onOpenChange={setOffen}>
        <DialogContent showCloseButton={false} className="p-[30px] sm:max-w-[560px]">
          {inhalt(DialogTitle, DialogDescription)}
        </DialogContent>
      </Dialog>
    )
  }
  return (
    <Sheet open={offen} onOpenChange={setOffen}>
      <SheetBlatt>{inhalt(SheetTitle, SheetDescription)}</SheetBlatt>
    </Sheet>
  )
}
