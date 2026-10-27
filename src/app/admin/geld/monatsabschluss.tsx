'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { useFrischBestaetigt } from '@/components/admin/frisch-bestaetigen'
import { KARTE, KNOPF_RAHMEN, LEISE } from '@/components/hof-bestellungen/stil'
import { cn } from '@/lib/utils'
import type { MonatsabschlussPunkt } from '@/lib/finanzen'
import { monatAbschliessen } from '@/server/actions/finanzen'
import { GELD_TEXT } from './texte'

/**
 * Der Monatsabschluss (Register N37, Nr. 191; Mockup admin-geld): die
 * Prüfliste mit Wort je Punkt („erledigt“/„offen“ — nie nur Farbe), die CSV
 * und „<Monat> abschließen …“. Der Knopf ist gesperrt, solange ein Punkt
 * offen ist, und sagt warum; der Server prüft beim Klick noch einmal selbst.
 * Abschließen ist heikel (Geld): frisch mit Passkey bestätigt.
 */
export function Monatsabschluss({
  monat,
  bezeichnung,
  monatName,
  punkte,
  zeile,
  gesperrt,
  abgeschlossen,
  csvHref,
  csvText,
}: {
  monat: string
  bezeichnung: string
  monatName: string
  punkte: MonatsabschlussPunkt[]
  zeile: string
  /** null = abschließbar, sonst der Grund. */
  gesperrt: string | null
  /** „am 3. Nov“ — null, solange offen. */
  abgeschlossen: string | null
  csvHref: string
  csvText: string
}): React.JSX.Element {
  const router = useRouter()
  const [laeuft, startTransition] = useTransition()
  const frisch = useFrischBestaetigt(monatAbschliessen)

  function abschliessen(): void {
    startTransition(async () => {
      const ergebnis = await frisch.ausfuehren({ monat })
      if ('error' in ergebnis) {
        toast.error(ergebnis.error)
        return
      }
      toast.success(`${bezeichnung} ist abgeschlossen.`)
      router.refresh()
    })
  }

  return (
    <section aria-labelledby="abschluss-titel" className={cn(KARTE, 'flex flex-col gap-3 p-4 md:p-[18px]')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="abschluss-titel" className="font-heading text-[17px] font-semibold text-foreground">
          {GELD_TEXT.abschluss(bezeichnung)}
        </h2>
        {abgeschlossen ? (
          <StatusBadge status="fertig">{`${GELD_TEXT.abgeschlossen} ${abgeschlossen}`}</StatusBadge>
        ) : (
          <span className={cn('text-[13px]', LEISE)}>{zeile}</span>
        )}
      </div>
      <ul className="[&>li]:border-t [&>li]:border-border">
        {punkte.map((p) => (
          <li key={p.id} className="flex min-h-11 items-center gap-3 py-2">
            <StatusBadge status={p.erledigt ? 'fertig' : 'offen'} className="shrink-0">
              {p.erledigt ? 'erledigt' : 'offen'}
            </StatusBadge>
            <span className="min-w-0 flex-1 text-[14px] text-foreground">{p.text}</span>
          </li>
        ))}
      </ul>
      {!abgeschlossen && (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {/* Eine Route, kein Seitenaufruf: eine Datei zum Speichern. */}
          <a href={csvHref} download className={KNOPF_RAHMEN}>
            <Download className="size-4" strokeWidth={1.7} aria-hidden="true" />
            {csvText}
          </a>
          <Button type="button" onClick={abschliessen} disabled={laeuft || gesperrt !== null} className="min-h-11" aria-describedby="abschluss-satz">
            {GELD_TEXT.abschliessen(monatName)}
          </Button>
        </div>
      )}
      <p id="abschluss-satz" className={cn('text-[13px] leading-relaxed', LEISE)}>
        {abgeschlossen ? GELD_TEXT.nachAbschluss : `${gesperrt ?? 'Alles erledigt.'} ${GELD_TEXT.nachAbschluss}`}
      </p>
      {frisch.dialog}
    </section>
  )
}
