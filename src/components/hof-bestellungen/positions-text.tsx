import type { Positionszeile } from '@/lib/positionszeile'

/**
 * Eine Position nach G14: die Anzahl fett vorn („**4** × Heumilch frisch (1 L)“); ohne Teile die alte Zeile.
 * EINE Form für die Packliste der Bestellung, die Vorschau neben der Liste und den Dialog „Was fehlt“
 * (Abnahme Lauf 32, bestellung Bild 3 und bestellungen 1440 Bild 1; Nr. 277).
 */
export function PositionsText({ zeile, teile }: { zeile: string; teile?: Positionszeile }): React.JSX.Element {
  if (!teile) return <>{zeile}</>
  return (
    <>
      <span className="font-bold">{teile.anzahl}</span> × {teile.name}
      {teile.gebinde && <> ({teile.gebinde})</>}
    </>
  )
}
