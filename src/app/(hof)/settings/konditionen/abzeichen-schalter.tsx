'use client'

import { useId, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { ABZEICHEN_TEXT } from '@/lib/gruendungshof'
import { setzeAbzeichenSichtbar } from '@/server/actions/abzeichen'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { Abzeichen } from '@/components/ui/abzeichen'

/*
 * Schalter „Abzeichen zeigen“ im Block „Dein Stand“ (Register K2, Änderung
 * Nr. 116; Mockup system-k2-gruendung-abzeichen, „Konditionen und Tarif“).
 * Nur für Gründungshöfe. Die ganze Zeile ist der Schalter (44 px,
 * role="switch") wie „Teilen-Hinweise zeigen“ — dieselben Tokens. Gespeichert
 * wird sofort; scheitert es, springt der Schalter zurück und sagt es.
 */
export function AbzeichenSchalter({ anfangsAn }: { anfangsAn: boolean }): React.JSX.Element {
  const [an, setAn] = useState(anfangsAn)
  const [laeuft, startTransition] = useTransition()
  const zeileId = useId()

  function umschalten() {
    const nach = !an
    setAn(nach)
    startTransition(async () => {
      const ergebnis = await setzeAbzeichenSichtbar({ zeigen: nach })
      if ('error' in ergebnis) {
        setAn(!nach)
        toast.error(ergebnis.error)
      }
    })
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      <button
        type="button"
        role="switch"
        aria-checked={an}
        // Fester Name; den Zustand liest die Vorlesehilfe aus aria-checked, die Zeile ist nur Beschreibung.
        aria-label={ABZEICHEN_TEXT.schalter}
        aria-describedby={zeileId}
        disabled={laeuft}
        onClick={umschalten}
        className={cn('flex min-h-11 w-full items-center gap-3 rounded-xl text-left disabled:cursor-wait', FOKUS_RAHMEN)}
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[14px] font-semibold text-foreground">{ABZEICHEN_TEXT.schalter}</span>
            <Abzeichen groesse="klein" />
          </span>
          {/* Normale Textfarbe: Leise Schrift hielte auf der Tönung von „Dein Stand“ im hellen Thema keine 4,5:1 (Axe). */}
          <span id={zeileId} className="mt-0.5 block text-[12.5px] leading-snug text-foreground">
            {ABZEICHEN_TEXT.schalterZeile}
          </span>
        </span>
        <span aria-hidden="true" className={cn('relative block h-6 w-10 shrink-0 rounded-full transition-colors duration-[250ms]', an ? 'bg-accent' : 'bg-border')}>
          <span
            className={cn(
              'absolute top-[3px] block size-[18px] rounded-full transition-transform duration-[250ms]',
              an ? 'translate-x-[19px] bg-accent-foreground' : 'translate-x-[3px] bg-muted-foreground'
            )}
          />
        </span>
      </button>
      <p className="text-[12.5px] leading-snug text-foreground">{ABZEICHEN_TEXT.schalterSatz}</p>
    </div>
  )
}
