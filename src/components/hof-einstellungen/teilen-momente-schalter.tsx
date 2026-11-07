'use client'

import { useId, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { HinweiskarteFehler } from '@/components/ui/hinweiskarte'
import { RUNDUNG } from '@/components/ui/rundung'
import { setzeTeilenMomente } from '@/server/actions/teilen-momente'
import { TEILEN_MOMENTE_SCHALTER, teilenMomenteFehler, teilenMomenteMeldung } from '@/lib/teilen-momente'
import { cn } from '@/lib/utils'

/** Die drei Momente, die der Schalter betrifft — so wie der Hof sie sieht. */
const MOMENTE = [
  'Wenn dein Hof freigeschaltet ist („Dein Hof ist online!“)',
  'Wenn du ein neues Produkt anlegst, das sofort auf deiner Hofseite steht',
  'Wenn ein ausverkauftes Produkt wieder Vorrat hat',
] as const

/*
 * Schalter „Teilen-Hinweise zeigen" (/settings/teilen, Nachtlauf Nr. 30).
 * Die ganze Zeile ist der Schalter (44 px, role="switch") wie „Sichtbar" in
 * der Produkttabelle — dieselben Tokens, keine zweite Schienenfarbe. An =
 * Momente kommen (Farm.teilenMomenteAus = false). Gespeichert wird sofort;
 * scheitert es, springt der Schalter zurück, und seit Nr. 250 (G6, Board
 * s2-konto-hof Bild 6) steht der Fehler als Kasten unter dem Schalter mit
 * „Nochmal“ statt als Toast. Wiederholen ist sicher: Die Aktion setzt den
 * Stand, sie schaltet nicht um.
 */
export function TeilenMomenteSchalter({ anfangsAn }: { anfangsAn: boolean }): React.JSX.Element {
  const [an, setAn] = useState(anfangsAn)
  const [laeuft, startTransition] = useTransition()
  const standId = useId()
  const wannId = useId()

  // Der Stand, der gespeichert werden sollte, als es scheiterte — „Nochmal“ versucht genau ihn wieder.
  const [fehlerNach, setFehlerNach] = useState<boolean | null>(null)

  function speichere(nach: boolean) {
    // Nie deaktiviert (G6): Ein Tipp, während gespeichert wird, verpufft.
    if (laeuft) return
    setFehlerNach(null)
    setAn(nach)
    startTransition(async () => {
      try {
        const ergebnis = await setzeTeilenMomente({ an: nach })
        if ('error' in ergebnis) {
          setAn(!nach)
          setFehlerNach(nach)
          return
        }
        toast.success(teilenMomenteMeldung(ergebnis.an))
      } catch {
        setAn(!nach)
        setFehlerNach(nach)
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className={cn('border border-border bg-card p-4', RUNDUNG.karte)}>
        <button
          type="button"
          role="switch"
          aria-checked={an}
          // Fester Name; den Zustand liest die Vorlesehilfe aus aria-checked, der Satz ist nur Beschreibung.
          aria-label={TEILEN_MOMENTE_SCHALTER}
          aria-describedby={standId}
          aria-busy={laeuft || undefined}
          onClick={() => speichere(!an)}
          className={cn('flex min-h-11 w-full items-center gap-3 text-left aria-busy:opacity-60', RUNDUNG.feld, FOKUS_RAHMEN)}
        >
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
        {fehlerNach !== null && (
          <HinweiskarteFehler className="mt-3" nochmal={() => speichere(fehlerNach)} laeuft={laeuft}>
            {teilenMomenteFehler(!fehlerNach)}
          </HinweiskarteFehler>
        )}
      </div>

      {/* Kartenüberschrift in der Serifenschrift, Punkte in Textfarbe (Liste Lauf 32, konto-hof „Wann wir fragen“). */}
      <section aria-labelledby={wannId} className={cn('border border-border bg-card p-4', RUNDUNG.karte)}>
        <h2 id={wannId} className="font-heading text-[18px] font-semibold text-foreground">
          Wann wir fragen
        </h2>
        <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-[14px] leading-normal text-foreground">
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
