'use client'

import { useId, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Share2 } from 'lucide-react'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { setzeTeilenMomente } from '@/server/actions/teilen-momente'
import { TEILEN_MOMENTE_SCHALTER, teilenMomenteMeldung } from '@/lib/teilen-momente'
import { cn } from '@/lib/utils'

/** Die drei Momente, die der Schalter betrifft — so wie der Hof sie sieht. */
const MOMENTE = [
  'Wenn dein Hof freigeschaltet ist („Dein Hof ist online!“)',
  'Wenn du ein neues Produkt anlegst, das sofort im Shop steht',
  'Wenn ein ausverkauftes Produkt wieder Vorrat hat',
] as const

/*
 * Schalter „Teilen-Hinweise zeigen" (/settings/teilen, Nachtlauf Nr. 30).
 * Die ganze Zeile ist der Schalter (44 px, role="switch") wie „Sichtbar" in
 * der Produkttabelle — dieselben Tokens, keine zweite Schienenfarbe. An =
 * Momente kommen (Farm.teilenMomenteAus = false). Gespeichert wird sofort;
 * scheitert es, springt der Schalter zurück und sagt es.
 */
export function TeilenMomenteSchalter({ anfangsAn }: { anfangsAn: boolean }): React.JSX.Element {
  const [an, setAn] = useState(anfangsAn)
  const [laeuft, startTransition] = useTransition()
  const standId = useId()
  const wannId = useId()

  function umschalten() {
    const nach = !an
    setAn(nach)
    startTransition(async () => {
      try {
        const ergebnis = await setzeTeilenMomente({ an: nach })
        if ('error' in ergebnis) {
          setAn(!nach)
          toast.error(ergebnis.error)
          return
        }
        toast.success(teilenMomenteMeldung(ergebnis.an))
      } catch {
        setAn(!nach)
        toast.error('Wir konnten die Einstellung nicht speichern. Bitte versuch es noch einmal.')
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <button
          type="button"
          role="switch"
          aria-checked={an}
          // Fester Name; den Zustand liest die Vorlesehilfe aus aria-checked, der Satz ist nur Beschreibung.
          aria-label={TEILEN_MOMENTE_SCHALTER}
          aria-describedby={standId}
          disabled={laeuft}
          onClick={umschalten}
          className={cn('flex min-h-11 w-full items-center gap-3 rounded-xl text-left disabled:opacity-60', FOKUS_RAHMEN)}
        >
          <Share2 className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.7} aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-foreground">{TEILEN_MOMENTE_SCHALTER}</span>
            <span id={standId} className="block text-[13px] leading-normal text-muted-foreground">
              {an ? 'An – wir fragen jeweils einmal.' : 'Aus – wir fragen nicht mehr.'}
            </span>
          </span>
          <span
            aria-hidden="true"
            className={cn('relative block h-6 w-10 shrink-0 rounded-full transition-colors duration-[250ms]', an ? 'bg-accent' : 'bg-border')}
          >
            <span
              className={cn(
                'absolute top-[3px] block size-[18px] rounded-full transition-transform duration-[250ms]',
                an ? 'translate-x-[19px] bg-accent-foreground' : 'translate-x-[3px] bg-muted-foreground'
              )}
            />
          </span>
        </button>
      </div>

      <section aria-labelledby={wannId} className="rounded-2xl border border-border bg-card p-4">
        <h2 id={wannId} className="text-[14.5px] font-semibold text-foreground">
          Wann wir fragen
        </h2>
        <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-[13.5px] leading-normal text-muted-foreground">
          {MOMENTE.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
        <p className="mt-3 text-[13px] leading-normal text-muted-foreground">
          Jeder Hinweis kommt höchstens einmal je Anlass und Gerät, und „Später“ bzw. „Nicht jetzt“ schließt ihn immer. Teilen
          kannst du jederzeit selbst – zum Beispiel über die Teilen-Karte auf Heute.
        </p>
      </section>
    </div>
  )
}
