'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Activity,
  ArrowLeft,
  BookOpen,
  CircleAlert,
  ClipboardList,
  Euro,
  Inbox,
  LayoutTemplate,
  LogOut,
  MoreHorizontal,
  Settings,
  Store,
  Sun,
  TriangleAlert,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import {
  ADMIN_ABMELDEN,
  ADMIN_HANDBUCH,
  ADMIN_KONTO,
  ADMIN_HEUTE_ZAEHLER,
  ADMIN_MEHR_TEXT,
  ADMIN_MEHR_ZEILE,
  ADMIN_REITER,
  ADMIN_ZURUECK,
  adminAktiverReiter,
  type AdminReiter,
  type AdminReiterId,
} from '@/lib/admin-navigation'
import { hofInitialen } from '@/lib/hof-initialen'
import { TESTBETRIEB_TEXT } from '@/lib/stripe-modus'
import type { StripeMarke } from '@/lib/testumgebung'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN, FOKUS_RAHMEN_INNEN } from '@/components/ui/fokus'
import { BottomNav, BottomNavLink, bottomNavEintragKlassen } from '@/components/ui/bottom-nav'
import { ListGruppe, ListRow } from '@/components/ui/list-row'
import { Sheet, SheetBlatt, SheetClose, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Hinweiskarte } from '@/components/ui/hinweiskarte'
import { StatusBadge } from '@/components/ui/status-badge'
import { Zaehler } from '@/components/ui/zaehler'
import { Wortmarke } from '@/components/shared/wortmarke'
import { ThemeUmschalter } from '@/components/shared/theme-umschalter'
import { INHALT_ID, SprungLink } from '@/components/shells/sprung-link'
import { ADMIN_RAHMEN } from '@/components/admin/admin-teile'
import { AdminAbmeldenKnopf, AdminKontoMenue, PLAKETTEN_KREIS, useAbmelden } from '@/components/shells/admin-konto'
import { MenueZielAnbieter } from '@/components/ui/menue-ziel'
import { MARKE } from '@/lib/marke'
import { ADMIN_POSTFACH_TEXT } from '@/lib/postfach'
import { warnungenText, type BetriebHinweis } from '@/lib/betrieb'
import type { AufgabenLeiste } from '@/lib/admin-aufgaben'

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
 * Seit Nr. 103 (Register N15/N18) der Reiter Betrieb: ein Punkt am Reiter,
 * solange eine Warnung offen ist. Ob, entscheidet der Server (ladeAdminbereich,
 * nur in der Produktion); die Shell bekommt nur Zahl und Text.
 *
 * Seit Nr. 185 (Register N32) steht rechts in der Betriebsleiste statt der
 * einzelnen Warnung „n offen · m überfällig – ansehen“ mit Link auf Heute —
 * die Zahl aus derselben Quelle wie „Braucht dich“ (ladeAdminAufgaben).
 *
 * Seit Nr. 193 (Register N32; Mockups admin-umbau-karte, mobil-admin-mehr):
 * Reiter Heute · Höfe · Bestellungen · Postfach · Startseite · Geld · Betrieb ·
 * Einstellungen mit Zahlen an Heute (offen), Höfe (warten) und Postfach
 * (ungelesen); ein Reiter ohne Recht fehlt (`reiter` vom Layout, N35). Am
 * Handy (unter 768 px) statt der Reiterzeile eine Leiste unten nach dem
 * Muster BottomNav: Heute · Höfe · Bestellungen · Postfach · Mehr; „Mehr“ als
 * Blatt mit Startseite, Geld, Betrieb, Einstellungen, Handbuch, Zu meinem Hof,
 * Konto und Sicherheit und Abmelden.
 */

export type AdminShellProps = {
  personName: string
  /** Ob das Konto einen eigenen Hof hat (kontoHatHof) — nur dann gibt es Wege in den Hofbereich. */
  hatHof: boolean
  /** Offene Aufgaben in Heute, Höfe, die auf Freischaltung warten, ungelesene Gespräche im Postfach (N32). */
  zahlen?: { heute?: number; hoefe?: number; postfach?: number }
  /** Die Reiter, die diese Person sieht (N35, sichtbareReiter) — ohne Angabe nur die mit „ansehen“. */
  reiter?: readonly AdminReiterId[]
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
  /** Register N15/N18: offene Warnungen von Admin › Betrieb — der Punkt am Reiter. */
  betrieb?: BetriebHinweis | null
  /** Register N32 (Nr. 185): „n offen · m überfällig – ansehen“ aus „Braucht dich“ — rechts in der Betriebsleiste; null = nichts offen. */
  aufgaben?: AufgabenLeiste | null
  /**
   * Nur für die Vorschau unter /intern: ersetzt das echte Abmelden, damit der
   * Admin vor der Vorschau nicht abgemeldet wird (wie bei der HofShell).
   */
  onAbmelden?: () => void
  children: ReactNode
}

function zahlFuer(reiter: AdminReiter, zahlen: AdminShellProps['zahlen']): { anzahl?: number; wofuer: string } {
  if (reiter.zahl === 'heute') return { anzahl: zahlen?.heute, wofuer: ADMIN_HEUTE_ZAEHLER }
  if (reiter.zahl === 'hoefe') return { anzahl: zahlen?.hoefe, wofuer: 'Höfe warten auf Freischaltung' }
  if (reiter.zahl === 'postfach') return { anzahl: zahlen?.postfach, wofuer: ADMIN_POSTFACH_TEXT.zaehlerReiter }
  return { wofuer: '' }
}

/** Die Symbole der Leiste und des Blatts „Mehr“ (Mockup mobil-admin-mehr) — Schmuck, das Wort steht daneben. */
const SYMBOL: Record<AdminReiterId, LucideIcon> = {
  heute: Sun,
  hoefe: Store,
  bestellungen: ClipboardList,
  postfach: Inbox,
  startseite: LayoutTemplate,
  geld: Euro,
  betrieb: Activity,
  einstellungen: Settings,
}

/** Ohne Angabe vom Layout: nur die Reiter, die jede Person sieht (Recht „ansehen“). */
const STANDARD_REITER: readonly AdminReiterId[] = ADMIN_REITER.filter((r) => r.recht === 'ansehen').map((r) => r.id)

/** aria-current eines Reiters: „page“ auf seiner eigenen Adresse, „true“ darunter (Akte, Meldung). */
function ariaAktuell(reiter: AdminReiter, aktiv: AdminReiterId | null, pfad: string): 'page' | 'true' | undefined {
  if (aktiv !== reiter.id) return undefined
  return pfad === reiter.href ? 'page' : 'true'
}

/**
 * Die Leiste unten am Handy (N32, Nr. 193; Muster BottomNav aus der HofShell):
 * die Reiter „leiste“ und „Mehr“ als Blatt mit den übrigen Reitern, dem
 * Handbuch, den Wegen in den Hofbereich (nur mit eigenem Hof) und
 * „Abmelden“. Ein Seitenwechsel schließt das Blatt; ab 768 px gibt es Leiste
 * und Blatt nicht.
 */
function AdminLeiste({
  reiter,
  aktiv,
  pfad,
  zahlen,
  betrieb,
  hatHof,
  onAbmelden,
}: {
  reiter: readonly AdminReiter[]
  aktiv: AdminReiterId | null
  pfad: string
  zahlen: AdminShellProps['zahlen']
  betrieb: BetriebHinweis | null
  hatHof: boolean
  onAbmelden?: () => void
}): React.JSX.Element {
  const [offen, setOffen] = useState(false)
  const [letzterPfad, setLetzterPfad] = useState(pfad)
  if (pfad !== letzterPfad) {
    setLetzterPfad(pfad)
    setOffen(false)
  }
  useEffect(() => {
    const breit = window.matchMedia('(min-width: 768px)')
    const beiWechsel = () => {
      if (breit.matches) setOffen(false)
    }
    breit.addEventListener('change', beiWechsel)
    return () => breit.removeEventListener('change', beiWechsel)
  }, [])
  const abmelden = useAbmelden(ADMIN_ABMELDEN.ziel, onAbmelden)
  const schliessen = () => setOffen(false)
  const leiste = reiter.filter((r) => r.amHandy === 'leiste')
  const mehr = reiter.filter((r) => r.amHandy === 'mehr')
  const mehrAktiv = mehr.some((r) => r.id === aktiv)
  // Das Blatt liegt über der Leiste; sie bleibt sichtbar und bedienbar (wie in der HofShell).
  const ueberDerLeiste = 'bottom-[calc(68px+env(safe-area-inset-bottom))] max-h-[calc(100dvh-68px-env(safe-area-inset-bottom)-1rem)] pb-4'
  const zeile = cn('flex min-h-[50px] w-full items-center gap-3 px-3.5 text-left text-[14.5px] font-medium text-foreground transition-colors duration-[250ms] hover:bg-muted', FOKUS_RAHMEN_INNEN)
  return (
    <BottomNav beschriftung="Admin-Bereiche" ueberSchleier={offen}>
      {leiste.map((r) => {
        const zahl = zahlFuer(r, zahlen)
        return (
          <BottomNavLink
            key={r.id}
            href={r.href}
            label={r.label}
            symbol={SYMBOL[r.id]}
            aktuell={offen ? undefined : ariaAktuell(r, aktiv, pfad)}
            zahl={zahl.anzahl}
            zahlWofuer={zahl.wofuer}
            onNavigate={schliessen}
          />
        )
      })}
      <Sheet open={offen} onOpenChange={setOffen}>
        <SheetTrigger aria-current={!offen && mehrAktiv ? 'true' : undefined} className={bottomNavEintragKlassen(offen || mehrAktiv)}>
          <span className="relative">
            <MoreHorizontal className="size-[22px]" strokeWidth={1.7} aria-hidden="true" />
            {betrieb && mehr.some((r) => r.warnpunkt) && (
              <span role="img" aria-label={warnungenText(betrieb.anzahl)} className="absolute -top-0.5 -right-1 size-2 rounded-full bg-primary" />
            )}
          </span>
          <span>{ADMIN_MEHR_TEXT.titel}</span>
        </SheetTrigger>
        <SheetBlatt className={ueberDerLeiste}>
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="font-heading text-2xl font-semibold">{ADMIN_MEHR_TEXT.titel}</SheetTitle>
            <SheetClose className={cn('min-h-11 rounded-full px-4 text-sm font-semibold text-brand-text hover:bg-muted', FOKUS_RAHMEN)}>
              {ADMIN_MEHR_TEXT.schliessen}
            </SheetClose>
          </div>
          <ListGruppe beschriftung={ADMIN_MEHR_TEXT.bereiche}>
            {mehr.map((r) => (
              <ListRow
                key={r.id}
                titel={r.label}
                untertitel={ADMIN_MEHR_ZEILE[r.id]}
                symbol={SYMBOL[r.id]}
                href={r.href}
                aktuell={ariaAktuell(r, aktiv, pfad)}
                ende={r.warnpunkt && betrieb ? <span role="img" aria-label={warnungenText(betrieb.anzahl)} className="size-2 shrink-0 rounded-full bg-primary" /> : undefined}
                onNavigate={schliessen}
              />
            ))}
            <li>
              <a href={ADMIN_HANDBUCH.href} target="_blank" rel="noopener noreferrer" className={zeile}>
                <BookOpen className="size-[18px] shrink-0 text-muted-foreground" strokeWidth={1.7} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{ADMIN_HANDBUCH.label}</span>
                  <span className="mt-0.5 block truncate text-[12.5px] font-normal text-muted-foreground">{ADMIN_HANDBUCH.zeile}</span>
                </span>
                <span className="sr-only">{ADMIN_MEHR_TEXT.neuerTab}</span>
              </a>
            </li>
          </ListGruppe>
          <ListGruppe beschriftung={ADMIN_MEHR_TEXT.konto}>
            {hatHof && <ListRow titel={ADMIN_ZURUECK.label} symbol={ArrowLeft} href={ADMIN_ZURUECK.href} onNavigate={schliessen} />}
            {hatHof && <ListRow titel={ADMIN_KONTO.label} symbol={UserRound} href={ADMIN_KONTO.href} onNavigate={schliessen} />}
            <li>
              <button type="button" onClick={abmelden} className={zeile}>
                <LogOut className="size-[18px] shrink-0 text-muted-foreground" strokeWidth={1.7} aria-hidden="true" />
                {ADMIN_ABMELDEN.label}
              </button>
            </li>
          </ListGruppe>
        </SheetBlatt>
      </Sheet>
    </BottomNav>
  )
}


/**
 * Die Initialen der angemeldeten Person und „Abmelden". Am Computer: mit
 * eigenem Hof ein Link auf „Konto und Sicherheit" (44 px Fläche, der Kreis
 * bleibt 32 px), ohne Hof kein Link — die Seite liegt im Hofbereich und
 * schickte das Konto auf /login —, daneben der Knopf „Abmelden". Am Handy
 * öffnet dieselbe Plakette ein Menü mit beidem (admin-konto.tsx).
 */
function KontoPlakette({
  anzeige,
  hatHof,
  onAbmelden,
  menueZiel,
}: {
  anzeige: string
  hatHof: boolean
  onAbmelden?: () => void
  menueZiel: React.RefObject<HTMLElement | null>
}): React.JSX.Element {
  const initialen = hofInitialen(anzeige)
  // Der Name beginnt mit dem, was man sieht (WCAG 2.5.3 „Label in Name"):
  // Wer per Sprache „MM antippen" sagt, trifft den Link.
  const beschriftung = `${initialen} – ${ADMIN_KONTO.label} (angemeldet: ${anzeige})`
  return (
    <>
      <AdminKontoMenue anzeige={anzeige} hatHof={hatHof} ersatz={onAbmelden} menueZiel={menueZiel} />
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
  reiter: sichtbar = STANDARD_REITER,
  testbetrieb = false,
  stripeMarke = null,
  betrieb = null,
  aufgaben = null,
  onAbmelden,
  children,
}: AdminShellProps): React.JSX.Element {
  const pathname = usePathname()
  const leiste = aufgaben
  const aktiv = adminAktiverReiter(pathname)
  const anzeige = personName.trim() || 'Dein Konto'
  const reiterListe = ADMIN_REITER.filter((r) => sichtbar.includes(r.id))

  // Am Handy ist die Reiter-Zeile breiter als der Bildschirm: Der gewählte Reiter
  // soll nicht außerhalb stehen. Nur die Zeile scrollt (scrollLeft), nie die Seite.
  const reiterZeile = useRef<HTMLElement>(null)
  // Hierhin hängen die Menüs (Nr. 132): in den Kopf statt frei in den <body>. Das Konto-Menü bekommt das Ziel von Hand,
  // alle Menüs im Inhalt (Hofliste, Meldungen) über den Anbieter um Kopf und Inhalt.
  const menueZiel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const zeile = reiterZeile.current
    const gewaehlt = zeile?.querySelector<HTMLElement>('[aria-current]')
    if (!zeile || !gewaehlt) return
    const links = gewaehlt.getBoundingClientRect().left - zeile.getBoundingClientRect().left
    zeile.scrollLeft += links - (zeile.clientWidth - gewaehlt.offsetWidth) / 2
  }, [pathname])

  return (
    <div data-design="neu" className="min-h-dvh bg-background text-foreground">
      <MenueZielAnbieter ziel={menueZiel}>
        <SprungLink />
        <header className="border-b border-border bg-card print:hidden">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2 px-4 py-2 sm:gap-x-3 md:min-h-16 md:flex-nowrap md:gap-x-[18px] md:px-8">
            <div className="flex min-h-11 items-center gap-2.5">
              <Link href="/admin" aria-label={`${MARKE} Admin – Heute`} className={cn('rounded-md', FOKUS_RAHMEN)}>
                <Wortmarke />
              </Link>
              {/* Am schmalen Handy passt die Marke nicht neben Rückweg und Hell/Dunkel in eine Zeile; die Reiter darunter sagen ohnehin, wo man ist. */}
              <StatusBadge status="offen" className="hidden min-[400px]:inline-flex">
                Admin
              </StatusBadge>
            </div>

            {/* Ab 768 px die Reiterzeile; darunter die Leiste unten (AdminLeiste). Zwischen 768 und 1279 px scrollt die Zeile waagrecht. */}
            <nav ref={reiterZeile} aria-label="Admin-Bereiche" className="hidden min-w-0 overflow-x-auto md:ml-5 md:block md:py-[3px]">
              <ul className="flex gap-1">
                {reiterListe.map((reiter) => {
                  const istAktiv = aktiv === reiter.id
                  const zahl = zahlFuer(reiter, zahlen)
                  return (
                    <li key={reiter.id}>
                      <Link
                        href={reiter.href}
                        aria-current={ariaAktuell(reiter, aktiv, pathname)}
                        className={cn(
                          // Sichtbar 38 px, die Trefferfläche 44 px (WCAG 2.5.8): wie chip.tsx über ein Pseudo-Element.
                          // Es misst vom Innenrand — der 1-px-Rahmen (auch der unsichtbare am aktiven Reiter) zählt nicht mit, darum 4 statt 3 px.
                          "relative flex h-[38px] items-center gap-2 rounded-full px-4 text-[14px] whitespace-nowrap transition-colors duration-[250ms] before:absolute before:inset-x-0 before:-inset-y-[4px] before:content-['']",
                          istAktiv
                            ? 'border border-foreground bg-foreground font-semibold text-background'
                            : 'border border-transparent font-medium text-foreground hover:bg-muted',
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
              <KontoPlakette anzeige={anzeige} hatHof={hatHof} onAbmelden={onAbmelden} menueZiel={menueZiel} />
            </div>
          </div>
          {/* Ziel des Konto-Menüs: ohne Höhe, außerhalb der scrollenden Reiterzeile — der Kopf hat kein
              overflow, transform oder backdrop-filter, das Menü wird also nicht abgeschnitten. */}
          <div ref={menueZiel} data-menue-ziel="" />
          {/* Betriebsleiste (Register Z3): welcher Stripe-Modus gilt. Eine eigene Zeile
              unter dem Kopf statt in ihm: Die Kopfzeile ist am Handy und bis 1024 px
              schon voll. Rechts seit Nr. 185 „n offen · m überfällig – ansehen“
              (Register N32) statt der einzelnen Warnung von Nr. 103/161. Ohne Marke
              und ohne offene Aufgabe keine Leiste. */}
          {(stripeMarke || leiste) && (
            <div className="flex min-h-11 items-center gap-3 border-t border-border px-4 md:px-8">
              {stripeMarke && <StatusBadge status={stripeMarke.ton}>{stripeMarke.text}</StatusBadge>}
              {leiste && (
                <Link
                  href={leiste.href}
                  className={cn(
                    'ml-auto inline-flex min-h-11 min-w-0 items-center gap-1.5 rounded-md text-[13px] font-semibold text-status-offen hover:underline',
                    FOKUS_RAHMEN
                  )}
                >
                  <TriangleAlert className="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                  <span className="truncate sm:hidden">{leiste.kurz}</span>
                  <span className="hidden truncate sm:inline">{leiste.text}</span>
                </Link>
              )}
            </div>
          )}
        </header>

        {/* Unten Platz für die Leiste am Handy (68 px und Home-Indicator). */}
        <main id={INHALT_ID} tabIndex={-1} className="px-4 pt-5 pb-28 outline-none md:px-8 md:py-7">
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
        <AdminLeiste reiter={reiterListe} aktiv={aktiv} pfad={pathname} zahlen={zahlen} betrieb={betrieb} hatHof={hatHof} onAbmelden={onAbmelden} />
      </MenueZielAnbieter>
    </div>
  )
}
