import { cn } from '@/lib/utils'
import { KARTE_LAEDT } from '@/lib/hoefe-anzeige'

/**
 * Der Platzhalter beider Leaflet-Karten (Hofübersicht, Standortkarte im
 * Hof-Profil), solange die Kartenbibliothek nachlädt — als `loading` von
 * next/dynamic (Nachtlauf Nr. 52). Er steht in GENAU der Größe der Karte:
 * ohne Angabe füllt er den Rahmen, den die Seite der Karte gibt (h-full),
 * sonst nimmt er dieselbe Klasse wie die Karte (STANDORT_KARTE_RAHMEN). So
 * fällt die Fläche beim Öffnen nicht zusammen, und die Karte springt nicht
 * herein.
 *
 * Kein Spinner (DESIGN_SYSTEM, „Zustände"): eine ruhige Fläche in Token-Farben,
 * die pulsiert — der Text pulsiert nicht mit, sonst fiele sein Kontrast in der
 * Animation unter 4,5:1.
 */
export function KarteLaedt({ className }: { className?: string }): React.JSX.Element {
  return (
    <div aria-busy="true" className={cn('relative flex h-full w-full items-center justify-center overflow-hidden', className)}>
      <div aria-hidden="true" className="absolute inset-0 animate-pulse bg-muted" />
      <p className="relative text-sm text-muted-foreground">{KARTE_LAEDT}</p>
    </div>
  )
}
