import { FlaskConical } from 'lucide-react'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { TESTHOF_HINWEIS, zeigtTesthofHinweis } from '@/lib/testhof'
import { cn } from '@/lib/utils'

/**
 * Oben auf Hofseite, Produktseite und Kasse eines Testhofs (Register N21,
 * Nr. 207): die ruhige Hinweiskarte im neutralen Ton (nie orange oder grün —
 * der Hinweis bewertet nichts), Text aus src/lib/testhof.ts. Für echte Höfe
 * rendert sie nichts. Den Abstand um die Karte gibt die Seite vor.
 */
export function TesthofHinweis({ farm, className }: { farm: { istTesthof: boolean }; className?: string }): React.JSX.Element | null {
  if (!zeigtTesthofHinweis(farm)) return null
  return (
    <div className={cn('mx-auto max-w-[1200px] px-4 md:px-6', className)}>
      <Hinweiskarte ton="neutral" symbol={FlaskConical}>
        {TESTHOF_HINWEIS}
      </Hinweiskarte>
    </div>
  )
}
