'use client'

import { Stepper } from '@/components/ui/stepper'
import { useVorratSetzen } from '@/components/produkte/use-vorrat-setzen'
import { VORRAT_MAX } from '@/lib/eingabegrenzen'
import { cn } from '@/lib/utils'

/*
 * Der Vorrat einer Zeile, direkt änderbar (Mockup web-h2-produkte: „Vorrat
 * direkt hier ändern"). − und + oder eine eingetippte Zahl; zum Server geht
 * der Wert erst, wenn er fertig ist (Loslassen, Verlassen des Felds —
 * `onWertBestaetigt`), nicht bei jedem Tastendruck.
 *
 * Gesetzt wird bedingt über `useVorratSetzen` — dieselbe Schleife wie im
 * Vorrat-Blatt der Karten-Zeilen (N25): Warteschlange, `vorher`, Antworten.
 * Hat eine Bestellung dazwischen gebucht, zeigt das Feld den Stand des
 * Servers und den Satz dazu, inline.
 */
export function VorratFeld({
  productId,
  name,
  stock,
  onWiederDa,
  className,
}: {
  productId: string
  name: string
  /** Der Vorrat aus der letzten Server-Antwort der Seite. */
  stock: number
  /** Der Server hat 0 → mehr als 0 bestätigt; ob der Moment kommt, entscheidet die Ansicht. */
  onWiederDa: (vorrat: number) => void
  className?: string
}): React.JSX.Element {
  const { anzeige, setAnzeige, bestaetigt, laeuft, fehler, senden } = useVorratSetzen({ productId, stock, onWiederDa })

  return (
    <div className={cn('flex flex-col items-start', className)}>
      <Stepper
        beschriftung={`Vorrat ${name}`}
        wert={anzeige}
        onWertChange={setAnzeige}
        onWertBestaetigt={(wert) => void senden(wert)}
        min={0}
        // Ein Altbestand über der Grenze bleibt sichtbar und darf sinken (src/schemas/vorrat.ts).
        max={Math.max(VORRAT_MAX, bestaetigt)}
        laeuft={laeuft}
        eingabeClassName="w-14"
      />
      {/* Ständig vorhanden, damit der Screenreader die Meldung ansagt, sobald sie kommt. */}
      <p aria-live="polite" className={cn('max-w-[11rem] text-xs leading-snug text-status-offen', !fehler && 'sr-only')}>
        {fehler}
      </p>
    </div>
  )
}
