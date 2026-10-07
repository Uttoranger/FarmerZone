'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { triageMeldungAction } from '@/server/actions/admin'
import { MELDUNG_STATUS, STATUS_INTERN, oeffentlicherStatus, type MeldungArt, type MeldungStatus } from '@/lib/meldung'
import { cn } from '@/lib/utils'
import { DialogFehler } from '@/components/hof-bestellungen/bestell-dialog'
import { FELD, FELD_LABEL, KNOPF_GRUEN, TEXT_GRUEN } from '@/components/hof-bestellungen/stil'

export type TriageWerte = {
  status: MeldungStatus
  clusterKey: string
  triageNotiz: string
  duplikatVonId: string
  sprintName: string
  antwortAnMelder: string
}

/**
 * „Entscheiden" — die Triage-Felder des Betreibers (Mockup
 * admin-meldung-entscheiden, im neuen Design seit Nr. 22f). Alles außer der
 * Antwort bleibt intern — die Antwort ist das EINZIGE Feld, das der Hof unter
 * „Meine Meldungen" liest, und steht deshalb sichtbar so beschriftet.
 * Gespeichert wird unverändert über triageMeldungAction (mit Ausgangsstand,
 * damit ein zweiter Schreiber nichts zurückdreht). Native Elemente: sieben
 * Status passen in ein <select>, und das tippt sich am Handy zuverlässig.
 * Fehler stehen im Formular, kein Toast.
 */
export function TriageForm({
  meldungId,
  art,
  werte,
  hatHof,
}: {
  meldungId: string
  /** Für „Der Hof sieht": ERLEDIGT heißt je Art Behoben, Umgesetzt oder Beantwortet. */
  art: MeldungArt
  werte: TriageWerte
  hatHof: boolean
}): React.JSX.Element {
  const router = useRouter()
  const [form, setForm] = useState<TriageWerte>(werte)
  const [pending, startTransition] = useTransition()
  const [fehler, setFehler] = useState<string | null>(null)
  // Das Duplikat-Feld steht nur da, wenn es gebraucht wird (Mockup: „Als Duplikat markieren").
  const [duplikatOffen, setDuplikatOffen] = useState(werte.duplikatVonId !== '')

  function setze<K extends keyof TriageWerte>(feld: K, wert: TriageWerte[K]) {
    setForm((f) => ({ ...f, [feld]: wert }))
  }

  function speichern(e: React.FormEvent) {
    e.preventDefault()
    setFehler(null)
    startTransition(async () => {
      // Ausgangsstand mitschicken: hat inzwischen das CLI oder das Deployment
      // geschrieben, lehnt die Action ab, statt es zurückzudrehen.
      const result = await triageMeldungAction(meldungId, {
        ...form,
        vorherStatus: werte.status,
        vorherNotiz: werte.triageNotiz === '' ? null : werte.triageNotiz,
      })
      if (result.error) {
        setFehler(result.error)
        return
      }
      toast.success('Entscheidung gespeichert.')
      router.refresh()
    })
  }

  return (
    <form onSubmit={speichern} className="flex flex-col gap-4">
      <div>
        <label htmlFor="triage-status" className={FELD_LABEL}>
          Status
        </label>
        <select
          id="triage-status"
          value={form.status}
          onChange={(e) => setze('status', e.target.value as MeldungStatus)}
          className={cn(FELD, 'min-h-11')}
        >
          {MELDUNG_STATUS.map((s) => (
            <option key={s} value={s}>
              {STATUS_INTERN[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <div>
          <label htmlFor="triage-cluster" className={FELD_LABEL}>
            Bündel
          </label>
          <input
            id="triage-cluster"
            value={form.clusterKey}
            onChange={(e) => setze('clusterKey', e.target.value)}
            maxLength={60}
            placeholder="z. B. abholzeiten-mehrere"
            className={FELD}
          />
        </div>
        <div>
          <label htmlFor="triage-sprint" className={FELD_LABEL}>
            Sprint
          </label>
          <input
            id="triage-sprint"
            value={form.sprintName}
            onChange={(e) => setze('sprintName', e.target.value)}
            maxLength={60}
            placeholder="z. B. abholzeiten-v2"
            className={FELD}
          />
        </div>
      </div>

      <div>
        <label htmlFor="triage-antwort" className={FELD_LABEL}>
          Antwort an den Hof <span className="font-normal">· sieht der Hof unter „Meine Meldungen“</span>
        </label>
        <textarea
          id="triage-antwort"
          value={form.antwortAnMelder}
          onChange={(e) => setze('antwortAnMelder', e.target.value)}
          maxLength={500}
          rows={3}
          aria-describedby="triage-antwort-zaehler"
          placeholder={hatHof ? 'Kurz und in Alltagssprache.' : 'Ohne Hof-Konto liest das niemand — nur für die Akte.'}
          className={cn(FELD, 'resize-y')}
        />
        <p id="triage-antwort-zaehler" className="mt-1 text-[12px] text-muted-foreground tabular-nums">
          {form.antwortAnMelder.length}/500
        </p>
      </div>

      <div>
        <label htmlFor="triage-notiz" className={FELD_LABEL}>
          Interne Notiz <span className="font-normal">· nur für dich sichtbar</span>
        </label>
        <textarea
          id="triage-notiz"
          value={form.triageNotiz}
          onChange={(e) => setze('triageNotiz', e.target.value)}
          maxLength={2000}
          rows={3}
          className={cn(FELD, 'resize-y')}
        />
      </div>

      {duplikatOffen && (
        <div>
          <label htmlFor="triage-duplikat" className={FELD_LABEL}>
            Duplikat von (Kurznummer)
          </label>
          <input
            id="triage-duplikat"
            value={form.duplikatVonId}
            onChange={(e) => setze('duplikatVonId', e.target.value)}
            maxLength={40}
            placeholder="8 Zeichen"
            className={cn(FELD, 'font-mono')}
          />
        </div>
      )}

      <p className="rounded-xl border border-border px-3.5 py-2.5 text-[13px] text-muted-foreground">
        Der Hof sieht: <span className="font-semibold text-foreground">„{oeffentlicherStatus(form.status, art)}“</span>
        {form.antwortAnMelder.trim() !== '' && ' plus deine Antwort'}
      </p>

      <DialogFehler text={fehler} />

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
        {!duplikatOffen && (
          <button
            type="button"
            onClick={() => {
              setDuplikatOffen(true)
              setze('status', 'DUPLIKAT')
              // Der Knopf verschwindet — der Fokus geht ins neue Feld statt ins Leere.
              requestAnimationFrame(() => document.getElementById('triage-duplikat')?.focus())
            }}
            className={TEXT_GRUEN}
          >
            Als Duplikat markieren
          </button>
        )}
        <button type="submit" disabled={pending} className={cn(KNOPF_GRUEN, 'w-full rounded-[14px] sm:w-auto sm:rounded-full')}>
          {pending ? 'Speichert …' : 'Speichern'}
        </button>
      </div>
    </form>
  )
}
