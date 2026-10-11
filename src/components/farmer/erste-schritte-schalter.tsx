'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { blendeErsteSchritteAus, blendeErsteSchritteEin } from '@/server/actions/erste-schritte'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { cn } from '@/lib/utils'

/**
 * Die zwei Schalter der Liste „Zu tun" (Nr. 53, vorher die Einstiegs-Checkliste):
 * „Ausblenden" in ihrem Kopf, „Zu tun einblenden" als Zeile unten auf Heute.
 * Beide setzen nur den Cookie über die Action und laden die Seite neu; was
 * danach zu sehen ist, entscheidet der Server (ersteSchritteAnzeige in
 * src/lib/erste-schritte.ts). Nur noch im neuen Design: Tokens und der
 * sichtbare Fokus der neuen Bausteine.
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
      aria-label={richtung === 'aus' ? 'Zu tun ausblenden' : undefined}
      className={cn(
        // min-h-11 = 44 px Tippfläche, px-3 hält auch „Ausblenden" breiter als 44 px.
        'inline-flex min-h-11 items-center rounded-md px-3 text-[13px] font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline disabled:opacity-60',
        FOKUS_RAHMEN,
        className
      )}
    >
      {richtung === 'aus' ? 'Ausblenden' : 'Zu tun einblenden'}
    </button>
  )
}
