import Link from 'next/link'
import { Undo2 } from 'lucide-react'
import { WIDERRUF_TEXT } from '@/lib/widerruf'
import type { HofWiderruf } from '@/server/widerruf'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { cn } from '@/lib/utils'

/**
 * Heute (Nr. 200, N39): offene Widerrufe nach der Abholung — je Bestellung
 * ein Link ins Bestell-Detail, dort erstattet oder lehnt der Hof ab. Ohne
 * Name, Adresse oder Nachricht der Kundin.
 */
export function WiderrufHeuteKarte({ widerrufe }: { widerrufe: readonly HofWiderruf[] }): React.JSX.Element | null {
  if (widerrufe.length === 0) return null
  return (
    <Hinweiskarte ton="orange" symbol={Undo2} titel={WIDERRUF_TEXT.hofKarteTitel}>
      <p className="text-[12.5px]">{WIDERRUF_TEXT.hofKarteSatz(widerrufe.length)}</p>
      <ul className="mt-1 flex flex-col">
        {widerrufe.map((w) => (
          <li key={w.id}>
            <Link
              href={`/orders/${w.orderId}`}
              className={cn('inline-flex min-h-11 items-center gap-2 rounded-md text-[13.5px] font-semibold text-foreground underline-offset-2 hover:underline', FOKUS_RAHMEN)}
            >
              {w.bestellnummer}
              <span className="font-normal text-muted-foreground">· {w.eingegangenAm}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Hinweiskarte>
  )
}
