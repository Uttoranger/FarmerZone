import { cn } from '@/lib/utils'
import { UNTERSEITE_RAHMEN } from '@/components/hof-einstellungen/einstellungen-laden'
import { UnterseitenKopfLaden } from '@/components/hofbereich/hof-laden'

/**
 * Ladeansicht von /settings/teilen (Nr. 30) in den Maßen der Seite: Unterseiten-Kopf,
 * Titel, Satz, die Schalter-Karte und die Karte „Wann wir fragen".
 */
export default function TeilenMomenteLaden(): React.JSX.Element {
  return (
    <div className={cn(UNTERSEITE_RAHMEN, 'animate-pulse')} aria-busy="true">
      <UnterseitenKopfLaden />
      <div className="mb-5 md:mb-6">
        <div className="h-8 w-48 rounded-lg bg-border" />
        <div className="mt-2 h-4 w-72 max-w-full rounded bg-muted" />
      </div>
      <div className="flex flex-col gap-4">
        <div className="h-[78px] rounded-2xl border border-border bg-card" />
        <div className="h-44 rounded-2xl border border-border bg-card" />
      </div>
    </div>
  )
}
