import Link from 'next/link'
import { WIDERRUF_TEXT } from '@/lib/widerruf'
import { textlinkKlassen } from '@/components/ui/textlink'
import { cn } from '@/lib/utils'

/**
 * „Vertrag widerrufen“ auf Bestätigungs- und Bestellseite (Nr. 200, N39): eine leise Zeile unter den Karten,
 * links bündig, grün unterstrichen wie im Board (s1-/w1-bestaetigung, s1-/w1-bestellung-link), 44 px
 * Trefferfläche (V16). Das Board schreibt „Rücktrittsrecht“; die Beschriftung der Online-Funktion bleibt bis
 * zur Entscheidung der Anwältin wörtlich nach N39 (N43 (1), V88). Den signierten Pfad baut der Server
 * (`widerrufPfad`) — das Geheimnis gehört nie in den Browser.
 */
export function WiderrufLink({ href }: { href: string }): React.JSX.Element {
  return (
    <p className="print:hidden">
      <Link href={href} className={cn(textlinkKlassen(), 'text-[14px] font-medium underline')}>
        {WIDERRUF_TEXT.knopfWiderrufen}
      </Link>
    </p>
  )
}
