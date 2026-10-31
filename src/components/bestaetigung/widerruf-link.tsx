import Link from 'next/link'
import { WIDERRUF_TEXT } from '@/lib/widerruf'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { cn } from '@/lib/utils'

/**
 * „Vertrag widerrufen“ auf Bestätigungs- und Bestellseite (Nr. 200, N39):
 * eine leise Zeile unter den Aktionen, 44 px Trefferfläche. Den signierten
 * Pfad baut der Server (`widerrufPfad`) — das Geheimnis gehört nie in den Browser.
 */
export function WiderrufLink({ href }: { href: string }): React.JSX.Element {
  return (
    <p className="text-center print:hidden">
      <Link
        href={href}
        className={cn('inline-flex min-h-11 items-center rounded-md px-2 text-[13.5px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline', FOKUS_RAHMEN)}
      >
        {WIDERRUF_TEXT.knopfWiderrufen}
      </Link>
    </p>
  )
}
