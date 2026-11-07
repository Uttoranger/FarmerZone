import { cn } from '@/lib/utils'
import { UNTERSEITE_RAHMEN } from '@/components/hof-einstellungen/einstellungen-laden'
import { WerkzeugKopfLaden } from '@/components/ui/werkzeug-kopf'
import { RUNDUNG } from '@/components/ui/rundung'

/**
 * Ladeansicht von /settings/teilen (Nr. 30) in den Maßen der Seite: Werkzeug-Kopf (G1, seit Nr. 250),
 * Satz, die Schalter-Karte und die Karte „Wann wir fragen".
 */
export default function TeilenMomenteLaden(): React.JSX.Element {
  return (
    <div className={cn(UNTERSEITE_RAHMEN, 'animate-pulse')} aria-busy="true">
      <WerkzeugKopfLaden />
      <div className="mb-5 h-4 w-72 max-w-full rounded bg-muted md:mb-6" />
      <div className="flex flex-col gap-4">
        <div className={cn('h-[78px] border border-border bg-card', RUNDUNG.karte)} />
        <div className={cn('h-44 border border-border bg-card', RUNDUNG.karte)} />
      </div>
    </div>
  )
}
