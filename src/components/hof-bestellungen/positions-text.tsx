import type { Positionszeile } from '@/lib/positionszeile'
import { cn } from '@/lib/utils'

/**
 * Eine Position nach G14: die Anzahl fett vorn („**4** × Heumilch frisch (1 L)“); ohne Teile die alte Zeile.
 * EINE Form für die Packliste der Bestellung, die Vorschau neben der Liste und den Dialog „Was fehlt“
 * (Abnahme Lauf 32, bestellung Bild 3 und bestellungen 1440 Bild 1; Nr. 277) und die Packliste auf Papier.
 * `anzahlKlasse`: die Farbe der fetten Anzahl, wo die Zeile selbst leiser steht (Papier: volle Papier-Schriftfarbe).
 */
export function PositionsText({ zeile, teile, anzahlKlasse }: { zeile: string; teile?: Positionszeile; anzahlKlasse?: string }): React.JSX.Element {
  if (!teile) return <>{zeile}</>
  return (
    <>
      <span className={cn('font-bold', anzahlKlasse)}>{teile.anzahl}</span> × {teile.name}
      {teile.gebinde && <> ({teile.gebinde})</>}
    </>
  )
}
