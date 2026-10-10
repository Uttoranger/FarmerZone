'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { triageMeldungAction } from '@/server/actions/admin'
import { ohneKiNotiz } from '@/lib/meldung'
import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/status-badge'
import { DialogFehler } from '@/components/hof-bestellungen/bestell-dialog'
import { KARTE, KICKER, KNOPF_RAHMEN, TEXT_GRUEN } from '@/components/hof-bestellungen/stil'
import type { TriageWerte } from './triage-form'

/**
 * Der Vorschlag der KI „Das ist ein Wunsch" — NUR ein Vorschlag (Gate 8):
 * Die KI entscheidet nichts, der Mensch entscheidet mit einem Knopf (Sprint
 * Briefkasten-Rückkopplung; im neuen Design seit Nr. 22f, Mockup
 * admin-meldung-entscheiden). Beide Knöpfe gehen über die bestehende
 * triageMeldungAction und schicken die GESPEICHERTEN Werte mit: die Action
 * schreibt alle Triage-Felder, ein halb getipptes Formular daneben soll dabei
 * nicht mitgespeichert werden.
 *   „Ja, ein Wunsch"   Art WUNSCH, Status GEPRUEFT — landet in der Wunschliste
 *   „Nein, ein Fehler" Status GEPRUEFT, die Zeile der KI verschwindet aus der Notiz
 */
export function KiVorschlag({
  meldungId,
  gespeichert,
  begruendung,
}: {
  meldungId: string
  gespeichert: TriageWerte
  begruendung: string | null
}): React.JSX.Element {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [fehler, setFehler] = useState<string | null>(null)

  function entscheide(wunsch: boolean) {
    // Der Ausgangsstand geht mit: hat das CLI die Meldung inzwischen geplant,
    // dreht der Knopf das nicht zurück, sondern bittet um Neuladen.
    const vorher = {
      vorherStatus: gespeichert.status,
      vorherNotiz: gespeichert.triageNotiz === '' ? null : gespeichert.triageNotiz,
    }
    setFehler(null)
    startTransition(async () => {
      const result = await triageMeldungAction(
        meldungId,
        wunsch
          ? { ...gespeichert, ...vorher, status: 'GEPRUEFT', art: 'WUNSCH' }
          : { ...gespeichert, ...vorher, status: 'GEPRUEFT', triageNotiz: ohneKiNotiz(gespeichert.triageNotiz) ?? '' }
      )
      if (result.error) {
        setFehler(result.error)
        return
      }
      toast.success(wunsch ? 'Als Wunsch eingeordnet.' : 'Bleibt ein Fehler.')
      router.refresh()
    })
  }

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
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button type="button" disabled={pending} onClick={() => entscheide(true)} className={KNOPF_RAHMEN}>
          Ja, ein Wunsch
        </button>
        <button type="button" disabled={pending} onClick={() => entscheide(false)} className={TEXT_GRUEN}>
          Nein, ein Fehler
        </button>
      </div>
      <DialogFehler text={fehler} />
    </section>
  )
}
