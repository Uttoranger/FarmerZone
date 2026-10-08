'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { ADMIN_KONTO, ADMIN_REITER, ADMIN_ZURUECK, adminAktiverReiter, type AdminReiter } from '@/lib/admin-navigation'
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
 * verlangeAdminSeite (src/server/admin-wache.ts). Seit Nr. 22f trägt
 * src/app/admin/layout.tsx sie um alle /admin-Routen; Name, Zähler und ob
 * das Konto einen Hof hat lädt dort ladeAdminbereich (nach der Wache).
 *
 * Seit Nr. 41 (Register N1): „← Mein Hof" nur mit eigenem Hof — ohne führte er
 * über /dashboard auf /login. Die Initialen-Plakette ist dann ein Link auf
 * „Konto und Sicherheit" und steht auch am Handy da.
 */

export type AdminShellProps = {
  personName: string
  /** Ob das Konto einen eigenen Hof hat (kontoHatHof) — nur dann gibt es Wege in den Hofbereich. */
  hatHof: boolean
  /** Höfe, die auf Freischaltung warten; Meldungen, die zu entscheiden sind. */
  zahlen?: { hoefe?: number; briefkasten?: number }
  children: ReactNode
}

function zahlFuer(reiter: AdminReiter, zahlen: AdminShellProps['zahlen']): { anzahl?: number; wofuer: string } {
  if (reiter.zahl === 'hoefe') return { anzahl: zahlen?.hoefe, wofuer: 'Höfe warten auf Freischaltung' }
  if (reiter.zahl === 'briefkasten') return { anzahl: zahlen?.briefkasten, wofuer: 'Meldungen zu entscheiden' }
  return { wofuer: '' }
}

/**
 * Die Initialen der angemeldeten Person — mit eigenem Hof ein Link auf
 * „Konto und Sicherheit" (44 px Fläche, der Kreis bleibt 32 px). Ohne Hof
 * kein Link: Die Seite liegt im Hofbereich und schickte das Konto auf /login.
 */
function KontoPlakette({ anzeige, hatHof }: { anzeige: string; hatHof: boolean }): React.JSX.Element {
  const kreis = 'flex size-8 shrink-0 items-center justify-center rounded-full bg-border text-[12px] font-semibold text-foreground'
  if (!hatHof) {
    return (
      <span title={`Angemeldet: ${anzeige}`} className={kreis}>
        <span aria-hidden="true">{hofInitialen(anzeige)}</span>
        <span className="sr-only">Angemeldet: {anzeige}</span>
      </span>
    )
  }
  const beschriftung = `${ADMIN_KONTO.label} – angemeldet: ${anzeige}`
  return (
    <Link
      href={ADMIN_KONTO.href}
      aria-label={beschriftung}
      title={beschriftung}
      className={cn('flex size-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-muted', FOKUS_RAHMEN)}
    >
      <span aria-hidden="true" className={kreis}>
        {hofInitialen(anzeige)}
      </span>
    </Link>
  )
}

export function AdminShell({ personName, hatHof, zahlen, children }: AdminShellProps): React.JSX.Element {
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

          {/* Rechts als eine Gruppe: Am Handy passen Marke, „← Mein Hof", Hell/Dunkel
              und Plakette ab 375 px in eine Zeile; ist es noch schmaler, rutscht die
              Gruppe geschlossen unter die Marke statt einzeln umzubrechen. Bis
              1023 px der Kurzname — neben den Reitern bräche „Zu meinem Hof" sonst um. */}
          <div className="ml-auto flex items-center gap-0.5 md:gap-1.5 lg:gap-3">
            {hatHof && (
              <Link
                href={ADMIN_ZURUECK.href}
                className={cn(
                  'inline-flex min-h-11 items-center gap-1 rounded-full px-1.5 text-[14px] font-semibold whitespace-nowrap text-brand-text hover:bg-muted md:gap-1.5 md:px-3',
                  FOKUS_RAHMEN
                )}
              >
                <ArrowLeft className="size-4" strokeWidth={1.7} aria-hidden="true" />
                <span className="lg:hidden">{ADMIN_ZURUECK.kurz}</span>
                <span className="hidden lg:inline">{ADMIN_ZURUECK.label}</span>
              </Link>
            )}
            <ThemeUmschalter className={cn('rounded-full text-foreground hover:bg-muted', FOKUS_RAHMEN)} />
            <KontoPlakette anzeige={anzeige} hatHof={hatHof} />
          </div>
        </div>
      </header>

      <main id={INHALT_ID} tabIndex={-1} className="px-4 py-5 outline-none md:px-8 md:py-7">
        {children}
      </main>
    </div>
  )
}
