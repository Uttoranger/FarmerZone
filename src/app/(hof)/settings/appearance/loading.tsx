import MeinHofLaden from '../../farm-page/loading'

/**
 * /settings/appearance leitet seit Nr. 50 in Mein Hof um (Register N4).
 * Während die Umleitung läuft, steht schon die Form des Ziels da — dieselbe
 * Ladeansicht wie /farm-page, nicht die einer Einstellungs-Unterseite
 * (ARCHITECTURE §4: Eine Route, die nur umleitet, zeigt die Ladeansicht
 * ihres Ziels).
 */
export default function MeinAuftrittLaden(): React.JSX.Element {
  return <MeinHofLaden />
}
