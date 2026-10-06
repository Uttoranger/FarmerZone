'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ERNEUT_SENDEN } from '@/lib/email-bestaetigung'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { sendeBestaetigungErneut } from '@/server/actions/email-bestaetigung'

/*
 * „E-Mail erneut senden" (S3, Nachtlauf Nr. 17b) — auf /verify als
 * Hauptknopf (orange, Hof-Aktion), auf /onboarding als Umriss (dort ist
 * „Mit Stripe einrichten" der eine orange Knopf). Die Bremse sitzt auf dem
 * Server (ERNEUT_SENDEN, je Konto über alle Instanzen); der Knopf wartet nur
 * sichtbar mit, damit niemand ins Leere klickt.
 */

const BASIS = cn(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-[18px] text-[14px] font-semibold transition-opacity duration-[250ms] disabled:opacity-60',
  FOKUS_RAHMEN
)
const ORANGE = cn(BASIS, 'h-12 w-full border border-primary-foreground/30 bg-primary text-primary-foreground hover:opacity-90')
const UMRISS = cn(BASIS, 'border border-border font-medium text-foreground hover:bg-muted')

export function ErneutSendenKnopf({
  warteSekunden,
  variante = 'umriss',
}: {
  /** Vom Server: Sekunden bis zum nächsten erlaubten Versand (0 = sofort). */
  warteSekunden: number
  variante?: 'orange' | 'umriss'
}): React.JSX.Element {
  const router = useRouter()
  const [rest, setRest] = useState(warteSekunden)
  const [laedt, starte] = useTransition()
  const [hinweis, setHinweis] = useState<string | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)

  // Der Zähler läuft nur, solange gewartet wird — eine Sekunde je Schritt.
  useEffect(() => {
    if (rest <= 0) return
    const uhr = setTimeout(() => setRest((r) => Math.max(0, r - 1)), 1000)
    return () => clearTimeout(uhr)
  }, [rest])

  function senden(): void {
    setHinweis(null)
    setFehler(null)
    starte(async () => {
      const antwort = await sendeBestaetigungErneut()
      if ('error' in antwort) {
        setFehler(antwort.error)
        if (antwort.warteSekunden) setRest(antwort.warteSekunden)
        return
      }
      if (antwort.schonBestaetigt) {
        router.refresh()
        return
      }
      setHinweis('Wir haben dir eine neue E-Mail geschickt. Schau auch im Spam-Ordner nach.')
      setRest(ERNEUT_SENDEN.abstandSekunden)
    })
  }

  return (
    <div className={cn('flex flex-col gap-2', variante === 'orange' && 'w-full')}>
      <button type="button" onClick={senden} disabled={laedt || rest > 0} className={variante === 'orange' ? ORANGE : UMRISS}>
        {laedt ? (
          <>
            <Loader2 className="size-4 animate-spin" strokeWidth={1.7} aria-hidden="true" />
            Einen Moment …
          </>
        ) : rest > 0 ? (
          `E-Mail erneut senden (${rest} s)`
        ) : (
          'E-Mail erneut senden'
        )}
      </button>
      {/* Immer da, damit Screenreader die erste Meldung ansagen. */}
      <p role="status" className={cn('text-[13px] leading-normal text-status-fertig', !hinweis && 'sr-only')}>
        {hinweis ?? ''}
      </p>
      {fehler && (
        <p role="alert" className="text-[13px] leading-normal text-status-offen">
          {fehler}
        </p>
      )}
    </div>
  )
}
