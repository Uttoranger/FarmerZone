import { AuswertungLaden } from '@/components/analytics/auswertung-laden'

/**
 * Ladeansicht der Auswertung, Reiter „In der Nähe" (Nachtlauf Nr. 31) — ohne
 * sie nähme Next.js die des Umsatz-Reiters (eine Ebene höher).
 */
export default function UmfeldLadenSeite(): React.JSX.Element {
  return <AuswertungLaden reiter="umfeld" />
}
