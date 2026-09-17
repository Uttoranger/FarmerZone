'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { triageMeldungAction } from '@/server/actions/admin'
import { MELDUNG_STATUS, STATUS_INTERN, STATUS_OEFFENTLICH, type MeldungStatus } from '@/lib/meldung'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

export type TriageWerte = {
  status: MeldungStatus
  clusterKey: string
  triageNotiz: string
  duplikatVonId: string
  sprintName: string
  antwortAnMelder: string
}

/**
 * Die Triage-Felder des Betreibers. Alles außer der Antwort bleibt intern —
 * die Antwort ist das EINZIGE Feld, das der Hof unter „Meine Meldungen" liest,
 * und steht deshalb sichtbar so beschriftet. Native Elemente statt Select-
 * Komponente: sechs Status passen in ein <select>, und das tippt sich bei
 * 375px zuverlässig.
 */
export function TriageForm({
  meldungId,
  werte,
  hatHof,
}: {
  meldungId: string
  werte: TriageWerte
  hatHof: boolean
}) {
  const router = useRouter()
  const [form, setForm] = useState<TriageWerte>(werte)
  const [pending, startTransition] = useTransition()

  function setze<K extends keyof TriageWerte>(feld: K, wert: TriageWerte[K]) {
    setForm((f) => ({ ...f, [feld]: wert }))
  }

  function speichern(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await triageMeldungAction(meldungId, form)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success('Triage gespeichert.')
      router.refresh()
    })
  }

  const feld = 'block text-xs font-medium text-muted-foreground mb-1'

  return (
    <form onSubmit={speichern} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="triage-status" className={feld}>
            Status
          </label>
          <select
            id="triage-status"
            value={form.status}
            onChange={(e) => setze('status', e.target.value as MeldungStatus)}
            className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
          >
            {MELDUNG_STATUS.map((s) => (
              <option key={s} value={s}>
                {STATUS_INTERN[s]}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Der Hof liest: &bdquo;{STATUS_OEFFENTLICH[form.status]}&ldquo;
          </p>
        </div>
        <div>
          <label htmlFor="triage-cluster" className={feld}>
            Cluster-Schlüssel
          </label>
          <Input
            id="triage-cluster"
            value={form.clusterKey}
            onChange={(e) => setze('clusterKey', e.target.value)}
            maxLength={60}
            placeholder="z. B. abholzeiten-mehrere"
            className="h-10"
          />
        </div>
        <div>
          <label htmlFor="triage-duplikat" className={feld}>
            Duplikat von (Kurznummer)
          </label>
          <Input
            id="triage-duplikat"
            value={form.duplikatVonId}
            onChange={(e) => setze('duplikatVonId', e.target.value)}
            maxLength={40}
            placeholder="8 Zeichen"
            className="h-10 font-mono"
          />
        </div>
        <div>
          <label htmlFor="triage-sprint" className={feld}>
            Sprint
          </label>
          <Input
            id="triage-sprint"
            value={form.sprintName}
            onChange={(e) => setze('sprintName', e.target.value)}
            maxLength={60}
            placeholder="z. B. abholzeiten-v2"
            className="h-10"
          />
        </div>
      </div>

      <div>
        <label htmlFor="triage-notiz" className={feld}>
          Notiz (intern)
        </label>
        <Textarea
          id="triage-notiz"
          value={form.triageNotiz}
          onChange={(e) => setze('triageNotiz', e.target.value)}
          maxLength={2000}
          rows={3}
        />
      </div>

      <div>
        <label htmlFor="triage-antwort" className={feld}>
          Antwort an den Melder{' '}
          <span className="font-semibold text-foreground">— sichtbar für den Hof</span>
        </label>
        <Textarea
          id="triage-antwort"
          value={form.antwortAnMelder}
          onChange={(e) => setze('antwortAnMelder', e.target.value)}
          maxLength={500}
          rows={3}
          placeholder={hatHof ? 'Kurz und in Alltagssprache — der Hof liest das unter „Meine Meldungen".' : 'Ohne Hof-Konto liest das niemand — nur für die Akte.'}
        />
        <p className="mt-1 text-[11px] text-muted-foreground">{form.antwortAnMelder.length}/500</p>
      </div>

      <Button type="submit" disabled={pending} className="min-h-11 w-full sm:w-auto">
        {pending ? 'Speichert …' : 'Triage speichern'}
      </Button>
    </form>
  )
}
