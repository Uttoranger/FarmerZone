'use client'

import { useId, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { HOFPREIS_STICHTAG_TEXT, pruefeHofpreisStichtag } from '@/lib/plattform-einstellung'
import { speichereHofpreisStichtag } from '@/server/actions/plattform-einstellung'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { FELD, FELD_LABEL, KNOPF_GRUEN } from '@/components/hof-bestellungen/stil'
import { DialogFehler } from '@/components/hof-bestellungen/bestell-dialog'
import { useFrischBestaetigt } from '@/components/admin/frisch-bestaetigen'

const TEXT = HOFPREIS_STICHTAG_TEXT

/**
 * Der Stichtag „Hofpreis-Modell ab“ (Register N38, Nr. 197, Punkt 6) — eine
 * Karte in Admin › Einstellungen. Nur Text an den Client (CODING_STANDARDS
 * §2): der gespeicherte Tag, ob er schon erreicht ist, und die Uhr der Seite.
 * Dieselbe Regel wie die Action (`pruefeHofpreisStichtag`); verbindlich prüft
 * die Action mit dem Stand aus der Datenbank, frisch mit Passkey bestätigt.
 */
export function HofpreisStichtag({
  daten,
}: {
  daten: { tag: string; stichtagIso: string | null; erreicht: boolean; jetzt: string }
}): React.JSX.Element {
  const router = useRouter()
  const [laeuft, startTransition] = useTransition()
  const [tag, setTag] = useState(daten.tag)
  const [fehler, setFehler] = useState<string | null>(null)
  const frisch = useFrischBestaetigt(speichereHofpreisStichtag)
  const feldId = useId()
  const satzId = useId()

  const bisher = { hofpreisModellAb: daten.stichtagIso ? new Date(daten.stichtagIso) : null }
  const geaendert = tag !== daten.tag

  function speichern(): void {
    const regel = pruefeHofpreisStichtag(tag, bisher, new Date(daten.jetzt))
    if (regel !== null) {
      setFehler(regel)
      return
    }
    setFehler(null)
    startTransition(async () => {
      const ergebnis = await frisch.ausfuehren({ tag })
      if ('error' in ergebnis) {
        setFehler(ergebnis.error)
        return
      }
      toast.success(TEXT.gespeichert)
      router.refresh()
    })
  }

  return (
    <section aria-labelledby={`${feldId}-titel`} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3.5 lg:p-5">
      <h2 id={`${feldId}-titel`} className="font-heading text-lg font-semibold text-foreground">
        {TEXT.titel}
      </h2>
      <p id={satzId} className="text-[13px] leading-snug text-muted-foreground">
        {TEXT.satz}
      </p>
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault()
          speichern()
        }}
      >
        <div className="flex min-w-0 flex-col sm:w-60">
          <label htmlFor={feldId} className={FELD_LABEL}>
            {TEXT.feld}
          </label>
          <input
            id={feldId}
            type="date"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            disabled={daten.erreicht || laeuft}
            aria-describedby={satzId}
            className={cn(FELD, FOKUS_RAHMEN, daten.erreicht && 'cursor-default bg-muted')}
          />
        </div>
        {!daten.erreicht && (
          <button type="submit" disabled={!geaendert || laeuft} aria-busy={laeuft || undefined} className={KNOPF_GRUEN}>
            {laeuft ? TEXT.speichert : TEXT.speichern}
          </button>
        )}
      </form>
      {daten.erreicht && <p className="text-[12.5px] leading-snug text-muted-foreground">{TEXT.erreicht}</p>}
      <DialogFehler text={fehler} />
      {frisch.dialog}
    </section>
  )
}
