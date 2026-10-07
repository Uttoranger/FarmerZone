import MeinHofLaden from '../farm-page/loading'

/**
 * /status leitet in den Reiter „Beiträge" von Mein Hof um (E12). Während die
 * Umleitung läuft, steht schon die Form des Ziels da — dieselbe Ladeansicht
 * wie /farm-page, nicht die der Übersicht (Nachtlauf Nr. 31).
 */
export default function StatusLaden(): React.JSX.Element {
  return <MeinHofLaden />
}
