'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { triageMeldungAction } from '@/server/actions/admin'
import { ohneKiNotiz } from '@/lib/meldung'
import { Button } from '@/components/ui/button'
import type { TriageWerte } from './triage-form'

/**
 * Der Vorschlag der KI „Das ist ein Wunsch" — der Mensch entscheidet mit einem
 * Knopf (Sprint Briefkasten-Rückkopplung). Beide Knöpfe gehen über die
 * bestehende triageMeldungAction und schicken die GESPEICHERTEN Werte mit:
 * die Action schreibt alle Triage-Felder, ein halb getipptes Formular darunter
 * soll dabei nicht mitgespeichert werden.
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
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function entscheide(wunsch: boolean) {
    // Der Ausgangsstand geht mit: hat das CLI die Meldung inzwischen geplant,
    // dreht der Knopf das nicht zurück, sondern bittet um Neuladen.
    const vorher = {
      vorherStatus: gespeichert.status,
      vorherNotiz: gespeichert.triageNotiz === '' ? null : gespeichert.triageNotiz,
    }
    startTransition(async () => {
      const result = await triageMeldungAction(
        meldungId,
        wunsch
          ? { ...gespeichert, ...vorher, status: 'GEPRUEFT', art: 'WUNSCH' }
          : { ...gespeichert, ...vorher, status: 'GEPRUEFT', triageNotiz: ohneKiNotiz(gespeichert.triageNotiz) ?? '' }
      )
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(wunsch ? 'Als Wunsch eingeordnet.' : 'Bleibt ein Fehler.')
      router.refresh()
    })
  }

  return (
    <section className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
      <p className="text-sm font-semibold">Die KI hält das für einen Wunsch.</p>
      {begruendung && <p className="mt-1 text-sm">{begruendung}</p>}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Button type="button" disabled={pending} onClick={() => entscheide(true)} className="min-h-11 sm:w-auto">
          Ja, ein Wunsch
        </Button>
        <Button type="button" variant="outline" disabled={pending} onClick={() => entscheide(false)} className="min-h-11 sm:w-auto">
          Nein, ein Fehler
        </Button>
      </div>
    </section>
  )
}
