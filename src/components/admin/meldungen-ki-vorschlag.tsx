'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { triageMeldungAction } from '@/server/actions/admin'
import { MELDUNG_KLICK_TEXT, kiEntscheidung, type TriageStand } from '@/lib/meldung'
import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/status-badge'
import { DialogFehler } from '@/components/hof-bestellungen/bestell-dialog'
import { KARTE, KICKER, KNOPF_RAHMEN, TEXT_GRUEN } from '@/components/hof-bestellungen/stil'
import { useMeldungenWerkzeug } from './meldungen-werkzeug'

/**
 * Der Vorschlag der KI „Das ist ein Wunsch" — NUR ein Vorschlag (Gate 8,
 * Register N14): Die KI entscheidet nichts, der Mensch entscheidet mit einem
 * Knopf, und jeder Klick lässt sich rückgängig machen. EINE Logik für die
 * Spalte im Eingang (KiVorschlag) und die Karte im Ablauf (KiKnoepfe):
 *   „Ja, ein Wunsch"   Art WUNSCH, Status GEPRUEFT — wandert nach Gesammelt
 *   „Nein, ein Fehler" Status GEPRUEFT, die Zeile der KI verschwindet aus der Notiz
 * Beide gehen über die bestehende triageMeldungAction mit den GESPEICHERTEN
 * Werten und dem Ausgangsstand (kiEntscheidung). Danach 8 Sekunden ein Toast
 * mit „Rückgängig" (zweiter Aufruf auf dem Stand danach — scheitert sauber mit
 * dem Satz der Action, wenn inzwischen jemand anderes geschrieben hat) und
 * bei „Ja" zusätzlich „Ins Bündel …" (Dialog des Werkzeugs, schreibt das
 * Stichwort). Seit Nr. 101 hier statt unter src/app/admin/meldungen/[id].
 */
function useKiEntscheidung(meldungId: string, stand: TriageStand): { entscheide: (wunsch: boolean) => void; laeuft: boolean; fehler: string | null } {
  const router = useRouter()
  const werkzeug = useMeldungenWerkzeug()
  const [laeuft, starte] = useTransition()
  const [fehler, setFehler] = useState<string | null>(null)

  function rueckgaengig(aufruf: ReturnType<typeof kiEntscheidung>['rueckgaengig']): void {
    void triageMeldungAction(meldungId, aufruf).then((ergebnis) => {
      if (ergebnis.error) toast.error(ergebnis.error)
      else toast.success(MELDUNG_KLICK_TEXT.rueckgaengigGemacht)
      router.refresh()
    })
  }

  function entscheide(wunsch: boolean): void {
    const { aufruf, nachher, rueckgaengig: zurueck } = kiEntscheidung(stand, wunsch)
    setFehler(null)
    starte(async () => {
      const ergebnis = await triageMeldungAction(meldungId, aufruf)
      if (ergebnis.error) {
        setFehler(ergebnis.error)
        return
      }
      toast.success(wunsch ? MELDUNG_KLICK_TEXT.alsWunsch : MELDUNG_KLICK_TEXT.bleibtFehler, {
        duration: MELDUNG_KLICK_TEXT.toastMs,
        // Am Handy unten über der Liste, nah an den Knöpfen (Mockup mobil-admin-postfach-meldungen); gelesen beim Klick, nicht beim Rendern.
        position: window.matchMedia('(min-width: 1024px)').matches ? undefined : 'bottom-center',
        action: { label: MELDUNG_KLICK_TEXT.rueckgaengig, onClick: () => rueckgaengig(zurueck) },
        ...(wunsch && werkzeug ? { cancel: { label: MELDUNG_KLICK_TEXT.insBuendel, onClick: () => werkzeug.insBuendel(meldungId, nachher) } } : {}),
      })
      router.refresh()
    })
  }

  return { entscheide, laeuft, fehler }
}

/** Die zwei Knöpfe — nebeneinander, je mindestens 44 px (Mockup mobil-admin-postfach-meldungen). */
export function KiKnoepfe({ meldungId, stand }: { meldungId: string; stand: TriageStand }): React.JSX.Element {
  const { entscheide, laeuft, fehler } = useKiEntscheidung(meldungId, stand)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={laeuft} onClick={() => entscheide(true)} className={cn(KNOPF_RAHMEN, 'px-4')}>
          {MELDUNG_KLICK_TEXT.jaWunsch}
        </button>
        <button type="button" disabled={laeuft} onClick={() => entscheide(false)} className={TEXT_GRUEN}>
          {MELDUNG_KLICK_TEXT.neinFehler}
        </button>
      </div>
      <DialogFehler text={fehler} />
    </div>
  )
}

/** Die Karte „Vorschlag der KI" in Meldung entscheiden (Eingang). */
export function KiVorschlag({ meldungId, stand, begruendung }: { meldungId: string; stand: TriageStand; begruendung: string | null }): React.JSX.Element {
  return (
    <section aria-labelledby="ki-titel" className={cn(KARTE, 'flex flex-col gap-3 p-4 md:p-[18px]')}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="ki-titel" className={KICKER}>
          Vorschlag der KI
        </h2>
        <StatusBadge status="neutral">nur Vorschlag</StatusBadge>
      </div>
      <p className="text-[14px] text-foreground">
        <span className="font-semibold">Die KI hält das für einen Wunsch.</span>
        {begruendung && <> {begruendung}</>}
      </p>
      <KiKnoepfe meldungId={meldungId} stand={stand} />
    </section>
  )
}
