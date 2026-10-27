import { KopfLaden } from '@/components/admin/admin-laden'

/**
 * Ladeansicht von /admin (Nachtlauf Nr. 22f) — die AdminShell steht schon. Seit
 * Nr. 193 (N32) ist /admin „Heute“, und diese Datei trägt jede Unterseite ohne
 * eigenes Laden: darum nur der Kopf des Seitenmusters und eine leere Fläche,
 * nicht mehr das Skelett der Höfe (das hat /admin/hoefe/loading.tsx).
 */
export default function Laden(): React.JSX.Element {
  return <KopfLaden />
}
