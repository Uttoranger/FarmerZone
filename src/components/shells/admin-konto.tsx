'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogOut, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { signOut } from '@/lib/auth-client'
import { fuehreAbmeldenAus } from '@/lib/abmelden'
import { ADMIN_ABMELDEN, ADMIN_KONTO } from '@/lib/admin-navigation'
import { hofInitialen } from '@/lib/hof-initialen'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLinkItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

/*
 * „Abmelden" im Kopf der AdminShell (Register N20, Nr. 126): am Computer ein
 * Knopf neben der Konto-Plakette, am Handy ein Menü hinter der Plakette — die
 * Kopfzeile ist dort schon voll. Beides geht denselben Weg wie die HofShell:
 * `fuehreAbmeldenAus` (src/lib/abmelden.ts), nur mit dem Ziel der Admin-
 * Anmeldung (`ADMIN_ABMELDEN`). Beide Teile sind 44 px hoch.
 */

/** Der Kreis mit den Initialen — 32 px sichtbar, die Fläche darum ist die 44 px große Tippfläche. */
export const PLAKETTEN_KREIS = 'flex size-8 shrink-0 items-center justify-center rounded-full bg-border text-[12px] font-semibold text-foreground'

/**
 * Der Ablauf hinter „Abmelden": Better Auth meldet ab, danach zur Anmeldung der
 * Admins. `ersatz` gibt es nur in der Vorschau unter /intern — dort sitzt ein
 * echter Admin vor der Shell und darf nicht abgemeldet werden.
 */
function useAbmelden(ersatz?: () => void): () => Promise<void> {
  const router = useRouter()
  return () =>
    fuehreAbmeldenAus({
      ersatz,
      abmelden: () => signOut(),
      beiFehler: (satz) => toast.error(satz),
      danach: () => {
        router.push(ADMIN_ABMELDEN.ziel)
        router.refresh()
      },
    })
}

/**
 * Ab 768 px: der Knopf neben der Plakette. Zwischen 768 und 1023 px nur das
 * Symbol (die Reiter brauchen den Platz), der Name bleibt für Screenreader und
 * als Tooltip; ab 1024 px steht das Wort da.
 */
export function AdminAbmeldenKnopf({ ersatz }: { ersatz?: () => void }): React.JSX.Element {
  const abmelden = useAbmelden(ersatz)
  return (
    <button
      type="button"
      onClick={abmelden}
      title={ADMIN_ABMELDEN.label}
      className={cn(
        'inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-3 text-[14px] font-semibold whitespace-nowrap text-foreground transition-colors duration-[250ms] hover:bg-muted',
        FOKUS_RAHMEN
      )}
    >
      <LogOut className="size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
      <span className="sr-only lg:not-sr-only">{ADMIN_ABMELDEN.label}</span>
    </button>
  )
}

/**
 * Bis 767 px: Die Plakette öffnet ein Menü mit „Konto und Sicherheit" (nur mit
 * eigenem Hof — die Seite liegt im Hofbereich) und „Abmelden". Der Name des
 * Auslösers beginnt mit den sichtbaren Initialen (WCAG 2.5.3).
 */
export function AdminKontoMenue({ anzeige, hatHof, ersatz }: { anzeige: string; hatHof: boolean; ersatz?: () => void }): React.JSX.Element {
  const abmelden = useAbmelden(ersatz)
  const initialen = hofInitialen(anzeige)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${initialen} – Konto-Menü (angemeldet: ${anzeige})`}
        className={cn('flex size-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-muted md:hidden', FOKUS_RAHMEN)}
      >
        <span aria-hidden="true" className={PLAKETTEN_KREIS}>
          {initialen}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {hatHof && (
          <DropdownMenuLinkItem render={<Link href={ADMIN_KONTO.href} />} className="min-h-11">
            <UserRound className="size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
            {ADMIN_KONTO.label}
          </DropdownMenuLinkItem>
        )}
        <DropdownMenuItem onClick={abmelden} className="min-h-11">
          <LogOut className="size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
          {ADMIN_ABMELDEN.label}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
