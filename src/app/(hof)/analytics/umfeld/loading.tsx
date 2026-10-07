import { RegionLaden } from '@/components/region/region-zustaende'

/**
 * Ladeansicht der Umleitung /analytics/umfeld → /region: zeigt schon die Form
 * von Region, wohin die Seite führt. Jede Route im Hofbereich hat eine eigene
 * Ladeansicht (Nachtlauf Nr. 31) — ohne sie hielte die Wache aus Nr. 31 diese
 * Umleitung nach dem Merge für eine Lücke.
 */
export default function UmfeldUmleitungLaden(): React.JSX.Element {
  return <RegionLaden />
}
