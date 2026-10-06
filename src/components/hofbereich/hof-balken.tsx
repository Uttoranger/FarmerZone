import Link from 'next/link'
import { Clock, PowerOff } from 'lucide-react'
import { FARM_ARCHIVED_OWNER_BANNER } from '@/lib/farm-archive'
import { FARM_PENDING_OWNER_BANNER, FARM_PENDING_OWNER_HINT, freischaltungsMailto } from '@/lib/farm-approval'
import { DE_VORBEREITUNG_HINWEIS, alsLand } from '@/lib/laender'
import { SUPPORT_EMAIL } from '@/lib/support'
import type { Hofbereich } from '@/server/hofbereich'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { cn } from '@/lib/utils'

/**
 * Die Balken über jeder Seite der HofShell — dieselben Zustände und Wortlaute
 * wie im Bestandslayout (ArchivedFarmBanner, PendingApprovalBanner), im neuen
 * Design als orange Hinweiskarte: Beides ist „Offenes beim Hof", kein Alarm.
 * Nicht schließbar, weil es der Zustand des Hofs ist, kein Tipp. Welcher
 * Balken gilt, entscheidet der Lader (stillgelegt sticht „wartet").
 */
export function HofBalken({ balken }: { balken: Hofbereich['balken'] }): React.JSX.Element | null {
  if (!balken) return null

  if (balken.art === 'stillgelegt') {
    return (
      <div className="px-4 pt-4 md:px-8 print:hidden">
        <Hinweiskarte
          ton="orange"
          symbol={PowerOff}
          titel={FARM_ARCHIVED_OWNER_BANNER}
          aktion={
            <Link
              href="/settings/account"
              className={cn(
                'inline-flex min-h-11 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90',
                FOKUS_RAHMEN
              )}
            >
              Hof reaktivieren
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="px-4 pt-4 md:px-8 print:hidden">
      <Hinweiskarte ton="orange" symbol={Clock} titel={FARM_PENDING_OWNER_BANNER}>
        <p className="text-muted-foreground">{FARM_PENDING_OWNER_HINT}</p>
        {alsLand(balken.country) === 'DE' && <p className="mt-1 text-muted-foreground">{DE_VORBEREITUNG_HINWEIS}</p>}
        <p className="mt-2 text-muted-foreground">
          Deine Hof-ID: <span className="font-mono font-medium break-all text-foreground">{balken.farmId}</span>
        </p>
        <p className="mt-1 text-muted-foreground">
          <a
            href={freischaltungsMailto(SUPPORT_EMAIL, balken.farmName, balken.farmId)}
            className={cn('font-semibold break-words text-foreground underline underline-offset-2', FOKUS_RAHMEN)}
          >
            Frage zur Freischaltung stellen
          </a>{' '}
          — die Hof-ID ist in der Nachricht schon eingetragen.
        </p>
      </Hinweiskarte>
    </div>
  )
}
