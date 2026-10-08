'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft, CircleAlert, FlaskConical } from 'lucide-react'
import { ADMIN_REITER, ADMIN_TESTUMGEBUNG, ADMIN_ZURUECK, adminAktiverReiter, type AdminReiter } from '@/lib/admin-navigation'
import { hofInitialen } from '@/lib/hof-initialen'
import { TESTBETRIEB_TEXT } from '@/lib/stripe-modus'
import type { StripeMarke } from '@/lib/testumgebung'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { StatusBadge } from '@/components/ui/status-badge'
import { Zaehler } from '@/components/ui/zaehler'
import { Wortmarke } from '@/components/shared/wortmarke'
import { ThemeUmschalter } from '@/components/shared/theme-umschalter'
import { INHALT_ID, SprungLink } from '@/components/shells/sprung-link'
import { ADMIN_RAHMEN } from '@/components/admin/admin-teile'

/*
 * Die Shell des Betreiber-Bereichs im neuen Design (Gate 2): eigene
 * Kopfzeile mit den Reitern Höfe · Briefkasten · Finanzen (mit Zählern) und
 * „← Zu meinem Hof" — keine Hof-Seitenleiste (docs/ai/DESIGN_SYSTEM.md).
 * Am Handy rutschen die Reiter als Zeile unter den Kopf. Mockups:
 * admin-hoefe-und-freischaltung (Browser), admin-mobil-unterwegs-freischalten.
 *
 * Die Shell schützt nichts: Jede Admin-Seite prüft selbst mit
 * verlangeAdminSeite (src/server/admin-wache.ts). Seit Nr. 22f trägt
 * src/app/admin/layout.tsx sie um alle /admin-Routen; Name und Zähler lädt
 * dort ladeAdminbereich (nach der Wache).
 *
 * Seit Nr. 43 (Register Z3) die Betriebsleiste unter dem Kopf: Marke
 * „Stripe Live"/„Stripe Test" und „Zur Testumgebung". Beides entscheidet der
 * Server (umgebung-server.ts) und reicht nur Text, Ton und Adresse herein.
 */

export type AdminShellProps = {
  personName: string
  /** Höfe, die auf Freischaltung warten; Meldungen, die zu entscheiden sind. */
  zahlen?: { hoefe?: number; briefkasten?: number }
  /**
   * Register Z2: Die Produktion läuft mit Test-Schlüssel (TESTBETRIEB aus
   * umgebung-server.ts) — dann steht über jeder Admin-Seite die orange Karte.
   * Nur der Wahrheitswert, nie der Schlüssel.
   */
  testbetrieb?: boolean
  /**
   * Register Z3: „Stripe Live" bzw. „Stripe Test" (STRIPE_MARKE aus
   * umgebung-server.ts) — nur Text und Ton, nie der Schlüssel.
   */
  stripeMarke?: StripeMarke | null
  /** Ziel von „Zur Testumgebung" (TESTUMGEBUNG_URL) — ohne Adresse kein Link. */
  testumgebungUrl?: string | null
  children: ReactNode
}

function zahlFuer(reiter: AdminReiter, zahlen: AdminShellProps['zahlen']): { anzahl?: number; wofuer: string } {
  if (reiter.zahl === 'hoefe') return { anzahl: zahlen?.hoefe, wofuer: 'Höfe warten auf Freischaltung' }
  if (reiter.zahl === 'briefkasten') return { anzahl: zahlen?.briefkasten, wofuer: 'Meldungen zu entscheiden' }
  return { wofuer: '' }
}

export function AdminShell({
  personName,
  zahlen,
  testbetrieb = false,
  stripeMarke = null,
  testumgebungUrl = null,
  children,
}: AdminShellProps): React.JSX.Element {
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
        {/* Betriebsleiste (Register Z3): welcher Stripe-Modus gilt und der Weg
            in die Testumgebung. Eine eigene Zeile unter dem Kopf statt in ihm:
            Die Kopfzeile ist am Handy und bis 1024 px schon voll, hier stehen
            Marke und Link in jeder Breite gleich. */}
        {(stripeMarke || testumgebungUrl) && (
          <div className="flex min-h-11 items-center justify-between gap-3 border-t border-border px-4 md:px-8">
            {stripeMarke ? <StatusBadge status={stripeMarke.ton}>{stripeMarke.text}</StatusBadge> : <span />}
            {testumgebungUrl && (
              <a
                href={testumgebungUrl}
                className={cn(
                  '-mr-3 inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-[14px] font-semibold whitespace-nowrap text-brand-text hover:bg-muted',
                  FOKUS_RAHMEN
                )}
              >
                <FlaskConical className="size-4" strokeWidth={1.7} aria-hidden="true" />
                {ADMIN_TESTUMGEBUNG.label}
              </a>
            )}
          </div>
        )}
      </header>

      <main id={INHALT_ID} tabIndex={-1} className="px-4 py-5 outline-none md:px-8 md:py-7">
        {/* Testbetrieb (Register Z2): über jeder Admin-Seite, in ihrer Breite.
            Mit Live-Schlüssel ist TESTBETRIEB false — die Karte verschwindet von selbst. */}
        {testbetrieb && (
          <div className={cn(ADMIN_RAHMEN, 'mb-5')}>
            <Hinweiskarte ton="orange" symbol={CircleAlert}>
              {TESTBETRIEB_TEXT.admin}
            </Hinweiskarte>
          </div>
        )}
        {children}
      </main>
    </div>
  )
}
