'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft, CircleAlert, TriangleAlert } from 'lucide-react'
import { ADMIN_KONTO, ADMIN_REITER, ADMIN_ZURUECK, adminAktiverReiter, type AdminReiter } from '@/lib/admin-navigation'
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
import { AdminAbmeldenKnopf, AdminKontoMenue, PLAKETTEN_KREIS } from '@/components/shells/admin-konto'
import { MARKE } from '@/lib/marke'
import { ADMIN_POSTFACH_TEXT } from '@/lib/postfach'
import { ADMIN_BETRIEB_HREF, BETRIEB_TEXT, warnungenText, type BetriebHinweis } from '@/lib/betrieb'

/*
 * Die Shell des Betreiber-Bereichs im neuen Design (Gate 2): eigene
 * Kopfzeile mit den Reitern Höfe · Postfach · Startseite · Finanzen ·
 * Einstellungen (Register N15; Höfe und Postfach mit Zählern) und
 * „← Zu meinem Hof" — keine Hof-Seitenleiste (docs/ai/DESIGN_SYSTEM.md).
 * Am Handy rutschen die Reiter als scrollbare Zeile unter den Kopf; der
 * gewählte Reiter scrollt in die Mitte, damit man ihn sieht. Mockups:
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
 *
 * Seit Nr. 43 (Register Z3) die Betriebsleiste unter dem Kopf: die Marke
 * „Stripe Live"/„Stripe Test". Sie entscheidet der Server (umgebung-server.ts)
 * und reicht nur Text und Ton herein. Den Link „Zur Testumgebung" gibt es seit
 * der Z3-Korrektur (15.10.2026, Nr. 94) nicht mehr: Die Testumgebung wurde
 * nie eingerichtet.
 *
 * Seit Nr. 126 (Register N20) „Abmelden": am Computer ein Knopf neben der
 * Plakette, am Handy öffnet die Plakette ein Menü (components/shells/admin-konto.tsx)
 * — derselbe Weg wie in der HofShell, danach /login/admin.
 *
 * Seit Nr. 103 (Register N15/N18) der Reiter Betrieb: ein Punkt am Reiter und
 * rechts in der Betriebsleiste der Hinweis mit Link, solange eine Warnung
 * offen ist. Ob, entscheidet der Server (ladeAdminbereich, nur in der
 * Produktion); die Shell bekommt nur Zahl und Text.
 */

export type AdminShellProps = {
  personName: string
  /** Ob das Konto einen eigenen Hof hat (kontoHatHof) — nur dann gibt es Wege in den Hofbereich. */
  hatHof: boolean
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
  /** Register N15/N18: offene Warnungen von Admin › Betrieb — Punkt am Reiter und Hinweis in der Betriebsleiste. */
  betrieb?: BetriebHinweis | null
  /**
   * Nur für die Vorschau unter /intern: ersetzt das echte Abmelden, damit der
   * Admin vor der Vorschau nicht abgemeldet wird (wie bei der HofShell).
   */
  onAbmelden?: () => void
  children: ReactNode
}

function zahlFuer(reiter: AdminReiter, zahlen: AdminShellProps['zahlen']): { anzahl?: number; wofuer: string } {
  if (reiter.zahl === 'hoefe') return { anzahl: zahlen?.hoefe, wofuer: 'Höfe warten auf Freischaltung' }
  if (reiter.zahl === 'briefkasten') return { anzahl: zahlen?.briefkasten, wofuer: ADMIN_POSTFACH_TEXT.zaehlerReiter }
  return { wofuer: '' }
}

/**
 * Die Initialen der angemeldeten Person und „Abmelden". Am Computer: mit
 * eigenem Hof ein Link auf „Konto und Sicherheit" (44 px Fläche, der Kreis
 * bleibt 32 px), ohne Hof kein Link — die Seite liegt im Hofbereich und
 * schickte das Konto auf /login —, daneben der Knopf „Abmelden". Am Handy
 * öffnet dieselbe Plakette ein Menü mit beidem (admin-konto.tsx).
 */
function KontoPlakette({ anzeige, hatHof, onAbmelden }: { anzeige: string; hatHof: boolean; onAbmelden?: () => void }): React.JSX.Element {
  const initialen = hofInitialen(anzeige)
  // Der Name beginnt mit dem, was man sieht (WCAG 2.5.3 „Label in Name"):
  // Wer per Sprache „MM antippen" sagt, trifft den Link.
  const beschriftung = `${initialen} – ${ADMIN_KONTO.label} (angemeldet: ${anzeige})`
  return (
    <>
      <AdminKontoMenue anzeige={anzeige} hatHof={hatHof} ersatz={onAbmelden} />
      <div className="hidden items-center gap-0.5 md:flex lg:gap-1.5">
        {hatHof ? (
          <Link
            href={ADMIN_KONTO.href}
            aria-label={beschriftung}
            title={beschriftung}
            className={cn('flex size-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-muted', FOKUS_RAHMEN)}
          >
            <span aria-hidden="true" className={PLAKETTEN_KREIS}>
              {initialen}
            </span>
          </Link>
        ) : (
          <span title={`Angemeldet: ${anzeige}`} className={PLAKETTEN_KREIS}>
            <span aria-hidden="true">{initialen}</span>
            <span className="sr-only">Angemeldet: {anzeige}</span>
          </span>
        )}
        <AdminAbmeldenKnopf ersatz={onAbmelden} />
      </div>
    </>
  )
}

export function AdminShell({
  personName,
  hatHof,
  zahlen,
  testbetrieb = false,
  stripeMarke = null,
  betrieb = null,
  onAbmelden,
  children,
}: AdminShellProps): React.JSX.Element {
  const pathname = usePathname()
  const aktiv = adminAktiverReiter(pathname)
  const anzeige = personName.trim() || 'Dein Konto'

  // Am Handy ist die Reiter-Zeile breiter als der Bildschirm: Der gewählte Reiter
  // soll nicht außerhalb stehen. Nur die Zeile scrollt (scrollLeft), nie die Seite.
  const reiterZeile = useRef<HTMLElement>(null)
  useEffect(() => {
    const zeile = reiterZeile.current
    const gewaehlt = zeile?.querySelector<HTMLElement>('[aria-current]')
    if (!zeile || !gewaehlt) return
    const links = gewaehlt.getBoundingClientRect().left - zeile.getBoundingClientRect().left
    zeile.scrollLeft += links - (zeile.clientWidth - gewaehlt.offsetWidth) / 2
  }, [pathname])

  return (
    <div data-design="neu" className="min-h-dvh bg-background text-foreground">
      <SprungLink />
      <header className="border-b border-border bg-card print:hidden">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2 px-4 py-2 sm:gap-x-3 md:min-h-16 md:flex-nowrap md:gap-x-[18px] md:px-8">
          <div className="flex min-h-11 items-center gap-2.5">
            <Link href="/admin" aria-label={`${MARKE} Admin – Übersicht der Höfe`} className={cn('rounded-md', FOKUS_RAHMEN)}>
              <Wortmarke />
            </Link>
            {/* Am schmalen Handy passt die Marke nicht neben Rückweg und Hell/Dunkel in eine Zeile; die Reiter darunter sagen ohnehin, wo man ist. */}
            <StatusBadge status="offen" className="hidden min-[400px]:inline-flex">
              Admin
            </StatusBadge>
          </div>

          <nav ref={reiterZeile} aria-label="Admin-Bereiche" className="order-last -mx-4 w-[calc(100%+2rem)] overflow-x-auto px-4 pt-[3px] pb-1 md:order-none md:mx-0 md:ml-5 md:w-auto md:px-0 md:py-[3px]">
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
                        // Sichtbar 38 px, die Trefferfläche 44 px (WCAG 2.5.8): wie chip.tsx über ein Pseudo-Element.
                        // Es misst vom Innenrand — der 1-px-Rahmen (auch der unsichtbare am aktiven Reiter) zählt nicht mit, darum 4 statt 3 px.
                        "relative flex h-[38px] items-center gap-2 rounded-full px-4 text-[14px] whitespace-nowrap transition-colors duration-[250ms] before:absolute before:inset-x-0 before:-inset-y-[4px] before:content-['']",
                        istAktiv
                          ? 'border border-foreground bg-foreground font-semibold text-background'
                          : 'border border-border font-medium text-foreground hover:bg-muted md:border-transparent',
                        FOKUS_RAHMEN
                      )}
                    >
                      {reiter.label}
                      <Zaehler anzahl={zahl.anzahl} wofuer={zahl.wofuer} />
                      {reiter.warnpunkt && betrieb && (
                        <span role="img" aria-label={warnungenText(betrieb.anzahl)} className="size-2 shrink-0 rounded-full bg-primary" />
                      )}
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
            <KontoPlakette anzeige={anzeige} hatHof={hatHof} onAbmelden={onAbmelden} />
          </div>
        </div>
        {/* Betriebsleiste (Register Z3): welcher Stripe-Modus gilt. Eine eigene Zeile
            unter dem Kopf statt in ihm: Die Kopfzeile ist am Handy und bis 1024 px
            schon voll. Rechts seit Nr. 103 der Hinweis auf eine offene Warnung
            (Register N15). Ohne Marke und ohne Warnung keine Leiste. */}
        {(stripeMarke || betrieb) && (
          <div className="flex min-h-11 items-center gap-3 border-t border-border px-4 md:px-8">
            {stripeMarke && <StatusBadge status={stripeMarke.ton}>{stripeMarke.text}</StatusBadge>}
            {betrieb && (
              <Link
                href={ADMIN_BETRIEB_HREF}
                className={cn(
                  'ml-auto inline-flex min-h-11 min-w-0 items-center gap-1.5 rounded-md text-[13px] font-semibold text-status-offen hover:underline',
                  FOKUS_RAHMEN
                )}
              >
                <TriangleAlert className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                <span className="truncate sm:hidden">{betrieb.kurz}</span>
                <span className="hidden truncate sm:inline">{BETRIEB_TEXT.leiste(betrieb.text)}</span>
              </Link>
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
