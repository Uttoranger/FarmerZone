import { cn } from '@/lib/utils'
import { MARKE } from '@/lib/marke'
import { MARKE_KOPF_PX, MARKE_KOPF_RUNDUNG_PROZENT } from '@/lib/marke-bild'
import { Bildmarke } from '@/components/shared/bildmarke'

/**
 * Bildmarke und Name (MARKE) — für die Kopfzeile der Kundenseiten.
 *
 * Auch die KundeShell, der Kopf der AdminShell und der Fuß der Startseite
 * zeigen sie. `wortKlasse` kann das Wort auf schmalen Handys ausblenden, wo der
 * Kopf sonst überliefe; die Bildmarke bleibt (der Link darum trägt den Namen).
 * Die Marke ist die kleine Fassung (32 px liegt unter der Grenze von 48 px)
 * aus der Datei unter public/marke/ — hier wird nichts gezeichnet (Register M1:
 * eine Bildmarke, eine Quelle). Vorab geladen wird sie nur in der Kopfzeile
 * (`priority`, Standard); der Fuß der Startseite gibt `false`.
 */
export function Wortmarke({ wortKlasse, priority = true }: { wortKlasse?: string; priority?: boolean }): React.JSX.Element {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Bildmarke groesse={MARKE_KOPF_PX} fassung="klein" rundung={MARKE_KOPF_RUNDUNG_PROZENT} priority={priority} />
      <span className={cn('whitespace-nowrap font-heading text-lg font-bold text-brand-text', wortKlasse)}>{MARKE}</span>
    </span>
  )
}
