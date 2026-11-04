'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogOut, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { signOut } from '@/lib/auth-client'
import { fuehreAbmeldenAus } from '@/lib/abmelden'
import { ADMIN_ABMELDEN, ADMIN_KONTO, ADMIN_MEHR_TEXT } from '@/lib/admin-navigation'
import { hofInitialen } from '@/lib/hof-initialen'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/*
 * „Abmelden" im Kopf der AdminShell (Register N20, Nr. 126): ein Menü hinter
 * der Konto-Plakette — seit Nr. 220 in jeder Breite (Boards s3-/w3-admin-shell,
 * Bild 4 „Web: Menü der Plakette“; vorher am Computer ein Knopf daneben). Beides geht über `useAbmelden`, den seit
 * Nr. 132 auch die HofShell nutzt: `fuehreAbmeldenAus` (src/lib/abmelden.ts),
 * hier mit dem Ziel der Admin-Anmeldung (`ADMIN_ABMELDEN`). Beide Teile sind
 * 44 px hoch.
 */

/** Der Kreis mit den Initialen — 32 px sichtbar, grün getönt wie im Board w3-admin-shell; die Fläche darum ist die 44 px große Tippfläche. */
export const PLAKETTEN_KREIS =
  'flex size-8 shrink-0 items-center justify-center rounded-full bg-zustand-laeuft-grund text-[12px] font-semibold text-zustand-laeuft'

/**
 * Der Ablauf hinter „Abmelden" in beiden Shells (Nr. 132): Better Auth meldet
 * ab, danach zum `ziel` der Shell (AdminShell /login/admin, HofShell /login).
 * `ersatz` gibt es nur in der Vorschau unter /intern — dort sitzt ein echter
 * Admin vor der Shell und darf nicht abgemeldet werden.
 */
export function useAbmelden(ziel: string, ersatz?: () => void): () => Promise<void> {
  const router = useRouter()
  return () =>
    fuehreAbmeldenAus({
      ersatz,
      abmelden: () => signOut(),
      beiFehler: (satz) => toast.error(satz),
      danach: () => {
        router.push(ziel)
        router.refresh()
      },
    })
}

/**
 * Die Plakette öffnet ein Menü (seit Nr. 220 in jeder Breite): oben, wer
 * angemeldet ist, dann „Konto und Sicherheit" (nur mit eigenem Hof — die Seite
 * liegt im Hofbereich) und „Abmelden". Der Name des
 * Auslösers beginnt mit den sichtbaren Initialen (WCAG 2.5.3). `menueZiel`
 * (Nr. 132): das Element im Kopf der Shell, in das das Menü gehängt wird — so
 * liegt es in der Landmarke `header` statt frei im `<body>` (Axe „region").
 */
export function AdminKontoMenue({
  anzeige,
  hatHof,
  ersatz,
  menueZiel,
}: {
  anzeige: string
  hatHof: boolean
  ersatz?: () => void
  menueZiel?: React.RefObject<HTMLElement | null>
}): React.JSX.Element {
  const abmelden = useAbmelden(ADMIN_ABMELDEN.ziel, ersatz)
  const initialen = hofInitialen(anzeige)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${initialen} – Konto-Menü (angemeldet: ${anzeige})`}
        className={cn('flex size-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-muted', FOKUS_RAHMEN)}
      >
        <span aria-hidden="true" className={PLAKETTEN_KREIS}>
          {initialen}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64" container={menueZiel}>
        <DropdownMenuGroup>
          <DropdownMenuLabel className="truncate font-normal">
            {ADMIN_MEHR_TEXT.angemeldetAls} <span className="font-semibold text-foreground">{anzeige}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        {hatHof && (
          <DropdownMenuLinkItem render={<Link href={ADMIN_KONTO.href} />}>
            <UserRound className="size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
            {ADMIN_KONTO.label}
          </DropdownMenuLinkItem>
        )}
        <DropdownMenuItem onClick={abmelden}>
          <LogOut className="size-4 shrink-0" strokeWidth={1.7} aria-hidden="true" />
          {ADMIN_ABMELDEN.label}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
