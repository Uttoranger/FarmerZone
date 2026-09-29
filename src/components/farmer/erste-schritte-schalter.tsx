'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { blendeErsteSchritteAus, blendeErsteSchritteEin } from '@/server/actions/erste-schritte'
import { cn } from '@/lib/utils'

/**
 * Die zwei Schalter der Erste-Schritte-Karte: „Ausblenden" in ihrem Kopf,
 * „Erste Schritte einblenden" als Zeile unten auf Heute. Beide setzen nur den
 * Cookie über die Action und laden die Seite neu; was danach zu sehen ist,
 * entscheidet der Server (ersteSchritteAnzeige in src/lib/erste-schritte.ts).
 */
export function ErsteSchritteSchalter({
  richtung,
  className,
}: {
  richtung: 'aus' | 'ein'
  className?: string
}): React.JSX.Element {
  const router = useRouter()
  const [laeuft, starte] = useTransition()

  function klick() {
    starte(async () => {
      const ergebnis = richtung === 'aus' ? await blendeErsteSchritteAus() : await blendeErsteSchritteEin()
      if ('error' in ergebnis) {
        toast.error(ergebnis.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <button
      type="button"
      onClick={klick}
      disabled={laeuft}
      // Im Kopf der Karte heißt er nur „Ausblenden" — der Screenreader braucht den Bezug.
      aria-label={richtung === 'aus' ? 'Erste Schritte ausblenden' : undefined}
      className={cn(
        // min-h-11 = 44 px Tippfläche; -my-2 hält die Zeile trotzdem schlank.
        'inline-flex min-h-11 items-center rounded-md text-[13px] font-medium text-app-ink-soft underline-offset-2 transition-colors hover:text-app-ink hover:underline disabled:opacity-60 outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
        className
      )}
    >
      {richtung === 'aus' ? 'Ausblenden' : 'Erste Schritte einblenden'}
    </button>
  )
}
