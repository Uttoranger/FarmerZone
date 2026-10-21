import { MeinHofLaden } from '@/components/mein-hof/mein-hof-laden'

/**
 * /status leitet in den Reiter „Beiträge" von Mein Hof um (E12). Während die
 * Umleitung läuft, steht schon die Form des Ziels da — dieselbe Ladeansicht
 * wie /farm-page, nicht die der Übersicht (Nachtlauf Nr. 31). Das Skelett kommt
 * seit Nr. 127 aus dem Bauteil: /farm-page selbst zeigt beim Reiterwechsel einen
 * Ladepunkt statt eines Skeletts.
 */
export default function StatusLaden(): React.JSX.Element {
  return <MeinHofLaden />
}
