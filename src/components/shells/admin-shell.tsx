'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { ADMIN_REITER, ADMIN_ZURUECK, adminAktiverReiter, type AdminReiter } from '@/lib/admin-navigation'
import { hofInitialen } from '@/lib/hof-initialen'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { StatusBadge } from '@/components/ui/status-badge'
import { Zaehler } from '@/components/ui/zaehler'
import { Wortmarke } from '@/components/shared/wortmarke'
import { ThemeUmschalter } from '@/components/shared/theme-umschalter'
import { INHALT_ID, SprungLink } from '@/components/shells/sprung-link'

/*
 * Die Shell des Betreiber-Bereichs im neuen Design (Gate 2): eigene
 * Kopfzeile mit den Reitern Höfe · Briefkasten · Finanzen (mit Zählern) und
 * „← Zu meinem Hof" — keine Hof-Seitenleiste (docs/ai/DESIGN_SYSTEM.md).
 * Am Handy rutschen die Reiter als Zeile unter den Kopf. Mockups:
 * admin-hoefe-und-freischaltung (Browser), admin-mobil-unterwegs-freischalten.
 *
 * Die Shell schützt nichts: Jede Admin-Seite prüft selbst mit
 * verlangeAdminSeite (src/server/admin-wache.ts). Noch nutzt keine Route
 * diese Shell (kein Big Bang).
 */

export type AdminShellProps = {
  personName: string
  /** Höfe, die auf Freischaltung warten; Meldungen, die zu entscheiden sind. */
  zahlen?: { hoefe?: number; briefkasten?: number }
  children: ReactNode
}

function zahlFuer(reiter: AdminReiter, zahlen: AdminShellProps['zahlen']): { anzahl?: number; wofuer: string } {
  if (reiter.zahl === 'hoefe') return { anzahl: zahlen?.hoefe, wofuer: 'Höfe warten auf Freischaltung' }
  if (reiter.zahl === 'briefkasten') return { anzahl: zahlen?.briefkasten, wofuer: 'Meldungen zu entscheiden' }
  return { wofuer: '' }
}

export function AdminShell({ personName, zahlen, children }: AdminShellProps): React.JSX.Element {
  const pathname = usePathname()
  const aktiv = adminAktiverReiter(pathname)
  const anzeige = personName.trim() || 'Dein Konto'

  return (
    <div data-design="neu" className="min-h-dvh bg-background text-foreground">
      <SprungLink />
      <header className="border-b border-border bg-card print:hidden">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2 px-4 py-2 sm:gap-x-3 md:min-h-16 md:flex-nowrap md:gap-x-[18px] md:px-8">
          <div className="flex min-h-11 items-center gap-2.5">
            <Link href="/admin" aria-label="FarmerZone Admin – Übersicht der Höfe" className={cn('rounded-md', FOKUS_RAHMEN)}>
              <Wortmarke />
            </Link>
            {/* Am schmalen Handy passt die Marke nicht neben Rückweg und Hell/Dunkel in eine Zeile; die Reiter darunter sagen ohnehin, wo man ist. */}
            <StatusBadge status="offen" className="hidden min-[400px]:inline-flex">
              Admin
            </StatusBadge>
          </div>

          <nav aria-label="Admin-Bereiche" className="order-last -mx-4 w-[calc(100%+2rem)] overflow-x-auto px-4 pb-1 md:order-none md:mx-0 md:ml-5 md:w-auto md:p-0">
            <ul className="flex gap-2 md:gap-1">
              {ADMIN_REITER.map((reiter) => {
                const istAktiv = aktiv === reiter.id
                const zahl = zahlFuer(reiter, zahlen)
                return (
                  <li key={reiter.id}>
                    <Link
                      href={reiter.href}
                      aria-current={istAktiv ? (pathname === reiter.href ? 'page' : 'true') : undefined}
                      className={cn(
                        'flex h-[38px] items-center gap-2 rounded-full px-4 text-[14px] whitespace-nowrap transition-colors duration-[250ms]',
                        istAktiv
                          ? 'bg-foreground font-semibold text-background'
                          : 'border border-border font-medium text-foreground hover:bg-muted md:border-transparent',
                        FOKUS_RAHMEN
                      )}
                    >
                      {reiter.label}
                      <Zaehler anzahl={zahl.anzahl} wofuer={zahl.wofuer} />
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>

          <span className="flex-1" />

          <Link
            href={ADMIN_ZURUECK.href}
            className={cn(
              'inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-[14px] font-semibold text-brand-text hover:bg-muted',
              FOKUS_RAHMEN
            )}
          >
            <ArrowLeft className="size-4" strokeWidth={1.7} aria-hidden="true" />
            <span className="md:hidden">{ADMIN_ZURUECK.kurz}</span>
            <span className="hidden md:inline">{ADMIN_ZURUECK.label}</span>
          </Link>
          <ThemeUmschalter className={cn('rounded-full text-foreground hover:bg-muted', FOKUS_RAHMEN)} />
          <span
            title={`Angemeldet: ${anzeige}`}
            className="hidden size-8 items-center justify-center rounded-full bg-border text-[12px] font-semibold text-foreground md:flex"
          >
            <span aria-hidden="true">{hofInitialen(anzeige)}</span>
            <span className="sr-only">Angemeldet: {anzeige}</span>
          </span>
        </div>
      </header>

      <main id={INHALT_ID} tabIndex={-1} className="px-4 py-5 outline-none md:px-8 md:py-7">
        {children}
      </main>
    </div>
  )
}
