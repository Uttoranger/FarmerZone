import type { GruendungSatzTeile } from '@/lib/gruendungshof'

/**
 * Ein Satz der Gründungs-Bausteine mit seinem hervorgehobenen Teil (Mockup
 * system-k2-gruendung-bausteine): fett in der Vordergrundfarbe, der Rest in
 * der Farbe des umgebenden Texts. Text aus GRUENDUNG_TEXT (gruendungshof.ts).
 */
export function SatzTeile({ teile }: { teile: GruendungSatzTeile }): React.JSX.Element {
  return (
    <>
      {teile.vor}
      <b className="font-semibold text-foreground">{teile.betont}</b>
      {teile.nach}
    </>
  )
}
