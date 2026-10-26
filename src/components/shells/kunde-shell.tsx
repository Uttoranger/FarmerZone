'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronLeft, Compass, ReceiptText, Search, ShoppingBasket, UserRound, type LucideIcon } from 'lucide-react'
import { kundenAriaAktuell, kundenNavigation, type KundenNavId, type KundenSitzung } from '@/lib/kunden-navigation'
import { useWarenkorbKopf } from '@/lib/use-warenkorb-kopf'
import { SUCHTEXT_PARAMETER } from '@/lib/suchtext-parameter'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { BottomNav, BottomNavLink, BottomNavMitte, mittelknopfKlassen } from '@/components/ui/bottom-nav'
import { Zaehler } from '@/components/ui/zaehler'
import { Wortmarke } from '@/components/shared/wortmarke'
import { ThemeUmschalter } from '@/components/shared/theme-umschalter'
import { INHALT_ID, SprungLink } from '@/components/shells/sprung-link'
import { KundeFuss } from '@/components/shells/kunde-fuss'
import { KUNDE_KOPF_ZEILE, KUNDE_SHELL_MASSE } from '@/lib/kunde-shell-masse'
import { MARKE } from '@/lib/marke'
import { VORSCHAU_LEISTE_HINWEIS, VORSCHAU_LEISTE_HINWEIS_MS } from '@/lib/hofseite-vorschau'
import { useImVorschauRahmen } from '@/components/farm/vorschau-im-rahmen'
import { NetzHinweis } from '@/components/ui/netz-hinweis'

/*
 * Die Shell der Kundenseiten im neuen Design (Gate 2): Kopfzeile im Browser,
 * Unterleiste am Handy, und als zweite Form die Fokus-Shell ohne Unterleiste
 * (Produktdetail, Checkout, Zahlung, Bestätigung, Bar-Bestätigung —
 * docs/ai/DESIGN_SYSTEM.md). Die Einträge kommen aus
 * src/lib/kunden-navigation.ts; Web und Handy lesen dieselbe Quelle.
 * Mockups: web-k1-entdecken-einstieg (Kopf), mobil-k1-entdecken und
 * mobil-k2-hofseite (Unterleiste), mobil-k3-warenkorb-bezahlen (Fokus).
 *
 * Route für Route (kein Big Bang): Nur Seiten, deren Gate sie umgestellt hat,
 * tragen diese Shells (tests/shells.test.ts, UMGESTELLT) — die Fokus-Shell
 * seit Nr. 12 die Kasse. Alle anderen Kundenseiten zeigen weiter KundenKopf
 * (components/shared/kunden-kopf.tsx).
 *
 * Seit Nr. 41 (Register N1) steht der Knopf rechts oben auch am Handy:
 * „Anmelden" (→ /login) bzw. mit Hof-Sitzung „Mein Hof" (→ /dashboard). Dafür
 * wandert Hell/Dunkel am Handy aus dem Kopf an den Seitenfuß; im Browser
 * bleibt er im Kopf.
 *
 * Seit Nr. 120 (Register N22) trägt jede Seite der KundeShell den Seitenfuß
 * (KundeFuss) mit Impressum, Datenschutz, AGB und „Problem melden"; Hell/Dunkel
 * am Handy steht darin. Die KundeFokusShell bleibt ohne Fuß.
 *
 * Seit Nr. 107 (Register N4, Ergänzung): Steht die Hofseite als Vorschau im
 * Rahmen (Kundenansicht von Mein Hof, Vorschau im Editor), zeigt die Shell
 * ihre Unterleiste blass und ohne Wirkung (`inert`, Deckkraft 0,55 auf den
 * Einträgen; der Grund bleibt deckend, sonst schiene die Seite durch) — die
 * Kundschaft sieht sie, also gehört sie ins Bild, aber aus der Vorschau
 * führt kein Weg hinaus. Ein Tipp darauf zeigt kurz „Vorschau – hier geht es
 * nicht weiter". Ohne Rahmen (neuer Tab) bleibt die Leiste, wie sie ist.
 */

const SYMBOL: Partial<Record<KundenNavId, LucideIcon>> = {
  entdecken: Compass,
  bestellungen: ReceiptText,
}

const TEXTLINK = cn(
  'relative inline-flex min-h-11 items-center rounded-lg px-1 text-[14px] whitespace-nowrap text-muted-foreground transition-colors duration-[250ms] hover:text-foreground aria-[current]:font-semibold aria-[current]:text-foreground',
  FOKUS_RAHMEN
)

/** Der Warenkorb in der Kopfzeile: Symbol mit Anzahl, führt zum Hof, der den Korb gleich öffnet. */
function WarenkorbKopf({ anzahl, href }: { anzahl: number; href: string }) {
  return (
    <Link
      href={href}
      aria-label={`Warenkorb, ${anzahl} Artikel`}
      className={cn('relative flex size-11 items-center justify-center rounded-full text-foreground hover:bg-muted', FOKUS_RAHMEN)}
    >
      <ShoppingBasket className="size-5" strokeWidth={1.7} aria-hidden="true" />
      <Zaehler anzahl={anzahl} wofuer="Artikel im Warenkorb" ton="gruen" className="absolute top-0.5 right-0 h-4 min-w-4 px-1 text-[9.5px]" />
    </Link>
  )
}

/**
 * Über der blassen Leiste in der Vorschau im Rahmen: fängt den Tipp, den die
 * Leiste mit `inert` nicht mehr bekommt (er fiele sonst auf die Seite darunter),
 * und zeigt kurz den Hinweis. Gleich groß wie die Leiste samt erhobenem
 * Mittelknopf (Maße der Shell). Für Screenreader nicht da — die Leiste ist es
 * mit `inert` auch nicht. Ebene 50 wie die Leiste, im Quelltext danach, also
 * darüber.
 */
function VorschauLeisteSperre(): React.JSX.Element {
  const [tipp, setTipp] = useState(false)
  useEffect(() => {
    if (!tipp) return
    const weg = setTimeout(() => setTipp(false), VORSCHAU_LEISTE_HINWEIS_MS)
    return () => clearTimeout(weg)
  }, [tipp])

  return (
    <div
      aria-hidden="true"
      data-vorschau-sperre=""
      // Feste Fläche unten: Der Cookie-Hinweis steht darüber, nie darauf (src/lib/cookie-hinweis.ts).
      data-unten-fest=""
      onClick={() => setTipp(true)}
      className="fixed inset-x-0 bottom-0 z-50 h-[calc(var(--kunde-unterleiste)+var(--kunde-ueberstand))] md:hidden print:hidden"
    >
      {tipp && (
        <p className="absolute bottom-full left-1/2 mb-3 -translate-x-1/2 rounded-full bg-foreground px-3.5 py-2 text-[12.5px] font-semibold whitespace-nowrap text-background shadow-lg">
          {VORSCHAU_LEISTE_HINWEIS}
        </p>
      )}
    </div>
  )
}

/** Der Knopf rechts im Kopf: Pille mit 44 px Höhe — auch am Handy gut zu treffen und zu lesen. */
const KOPF_KNOPF = cn(
  'inline-flex h-11 shrink-0 items-center rounded-full border border-border px-4 text-[14px] font-semibold whitespace-nowrap text-foreground transition-colors duration-[250ms] hover:bg-muted',
  FOKUS_RAHMEN
)

export type KundeShellProps = {
  /**
   * Wie die Seite die Sitzung sieht (kundenSitzung): ohne Sitzung „Anmelden",
   * mit Kundensitzung Suche und „Mein Konto", mit Hof-Sitzung „Mein Hof".
   */
  sitzung: KundenSitzung
  /**
   * Fokus-Seite mit Kopf (Produktseite, Nr. 11): `false` lässt die
   * Unterleiste am Handy weg — die Seite bringt genau eine feste Leiste mit
   * ihrer Hauptaktion (DESIGN_SYSTEM, „Fokus-Seiten ohne Unterleiste"). Der
   * Warenkorb steht dann auch am Handy im Kopf, sonst wäre er dort
   * unerreichbar. Ohne Angabe: mit Unterleiste.
   */
  unterleiste?: boolean
  /**
   * Der Punkt, der auf dieser Seite aktiv ist, wo der Pfad es nicht sagt (Nr. 177):
   * Hof- und Produktseite setzen `entdecken` (kundenAriaAktuell).
   */
  aktiv?: KundenNavId
  children: ReactNode
}

export function KundeShell({ sitzung, unterleiste = true, aktiv, children }: KundeShellProps): React.JSX.Element {
  const pathname = usePathname()
  const nav = kundenNavigation({ sitzung })
  const korb = useWarenkorbKopf()
  // Steht der Warenkorb auch am Handy im Kopf (Fokus-Seiten ohne Unterleiste),
  // reicht der Platz neben „Anmelden" unter 360 px nicht für den Namen.
  const korbAmHandy = korb !== null && !unterleiste
  // Vorschau im Rahmen: erst nach dem Mounten bekannt, vom Server und beim Hydrieren false.
  const imRahmen = useImVorschauRahmen()

  return (
    // Die Maße als CSS-Variablen (src/lib/kunde-shell-masse.ts): Der Kartenmodus auf
    // /hoefe füllt damit genau den Platz zwischen Kopfzeile und Unterleiste.
    // data-scroll-rand: Der Fokus scrollt nie unter Kopf und Unterleiste (WCAG 2.4.11, scroll-padding in globals.css, Nr. 177).
    <div data-design="neu" data-scroll-rand={unterleiste ? 'kunde' : 'kunde-ohne-leiste'} className={cn('min-h-dvh bg-background text-foreground', KUNDE_SHELL_MASSE)}>
      <SprungLink />
      <header className="sticky top-0 z-40 border-b border-border bg-background print:hidden">
        <div className={cn(KUNDE_KOPF_ZEILE, 'mx-auto flex max-w-[1200px] items-center gap-3 px-4 md:gap-3 md:px-6 lg:gap-[22px]')}>
          <Link href="/" aria-label={`${MARKE} – zur Startseite`} className={cn('rounded-md', FOKUS_RAHMEN)}>
            <Wortmarke wortKlasse={korbAmHandy ? 'max-[359px]:hidden' : undefined} />
          </Link>

          {/* Mit Kundensitzung sitzt die Suche im Kopf; am Handy oben in „Entdecken" (DESIGN_SYSTEM). */}
          {sitzung === 'kunde' && (
            <form role="search" action="/hoefe" method="get" className="hidden w-[340px] md:block">
              <label className="relative block">
                <span className="sr-only">Hof oder Produkt suchen</span>
                <Search
                  className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
                  strokeWidth={1.7}
                  aria-hidden="true"
                />
                <input
                  type="search"
                  name={SUCHTEXT_PARAMETER}
                  placeholder="Hof oder Produkt suchen …"
                  className={cn(
                    'h-[38px] w-full rounded-full border border-border bg-card pr-4 pl-10 text-[13.5px] text-foreground placeholder:text-muted-foreground',
                    FOKUS_RAHMEN
                  )}
                />
              </label>
            </form>
          )}

          <span className="flex-1" />

          <nav aria-label="Hauptnavigation" className="hidden md:block">
            <ul className="flex items-center gap-4 lg:gap-[22px]">
              {nav.web.map((punkt) => (
                <li key={punkt.id}>
                  <Link href={punkt.href} aria-current={kundenAriaAktuell(pathname, punkt, aktiv)} className={TEXTLINK}>
                    {/* Zwischen 768 und 1024 px der kurze Name („Entdecken",
                        „Bestellungen"): Seit Nr. 14 stehen abgemeldet vier
                        Links im Kopf, mit den langen Namen bräche er um. */}
                    {punkt.kurz ? (
                      <>
                        <span className="lg:hidden">{punkt.kurz}</span>
                        <span className="hidden lg:inline">{punkt.label}</span>
                      </>
                    ) : (
                      punkt.label
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-1 md:gap-2">
            {korb && (
              <span className={unterleiste ? 'hidden md:block' : undefined}>
                <WarenkorbKopf anzahl={korb.anzahl} href={korb.href} />
              </span>
            )}
            {/* Am Handy steht Hell/Dunkel am Seitenfuß — oben rechts gehört der Platz dem Knopf. */}
            <ThemeUmschalter className={cn('hidden rounded-full text-foreground hover:bg-muted md:inline-flex', FOKUS_RAHMEN)} />
            {nav.knopf && (
              <Link href={nav.knopf.href} aria-current={kundenAriaAktuell(pathname, nav.knopf, aktiv)} className={KOPF_KNOPF}>
                {nav.knopf.label}
              </Link>
            )}
            {nav.konto && (
              <Link
                href={nav.konto.href}
                aria-label={nav.konto.label}
                title={nav.konto.label}
                aria-current={kundenAriaAktuell(pathname, nav.konto, aktiv)}
                className={cn('flex size-11 items-center justify-center rounded-full', FOKUS_RAHMEN)}
              >
                <span className="flex size-8 items-center justify-center rounded-full bg-border text-foreground">
                  <UserRound className="size-4" strokeWidth={1.7} aria-hidden="true" />
                </span>
              </Link>
            )}
          </div>
        </div>
      </header>
      {/* Kein Netz (Register N29): die Zeile unter dem Kopf, bis das Netz zurück ist. */}
      <NetzHinweis />

      <main id={INHALT_ID} tabIndex={-1} className="outline-none">
        {children}
      </main>
      {/* Der Seitenfuß auf jeder Seite der Shell, am Handy samt Hell/Dunkel (im
          Browser im Kopf). Unten hält er Platz für die Unterleiste bzw. die
          feste Leiste einer Fokus-Seite frei — vorher tat das der Inhalt. */}
      <KundeFuss className="pb-28 md:pb-0 print:pb-0" />

      {unterleiste && (
        // In der Vorschau im Rahmen ohne Wirkung — keine Klicks nach außen (VorschauLeisteSperre).
        <div inert={imRahmen}>
          <BottomNav className={imRahmen ? '[&>div]:opacity-55' : undefined}>
            {nav.handy.map((platz) => {
              if (platz.art === 'warenkorb') {
                // Leer gibt es keinen Korb, aber einen Ausweg: zu den Höfen (DESIGN_SYSTEM, „Leerzustand mit Ausweg").
                return (
                  <BottomNavMitte key="warenkorb">
                    <Link
                      href={korb?.href ?? '/hoefe'}
                      aria-label={korb ? `Warenkorb öffnen, ${korb.anzahl} Artikel` : 'Warenkorb ist leer – Höfe entdecken'}
                      className={mittelknopfKlassen('gruen')}
                    >
                      <ShoppingBasket className="size-6" strokeWidth={1.7} aria-hidden="true" />
                      {korb && (
                        <Zaehler
                          anzahl={korb.anzahl}
                          wofuer="Artikel im Warenkorb"
                          ton="orange"
                          className="absolute -top-1 -right-1 ring-2 ring-card"
                        />
                      )}
                    </Link>
                  </BottomNavMitte>
                )
              }
              const { punkt } = platz
              const Symbol = SYMBOL[punkt.id] ?? Compass
              return (
                <BottomNavLink
                  key={punkt.id}
                  href={punkt.href}
                  label={punkt.kurz ?? punkt.label}
                  symbol={Symbol}
                  aktuell={kundenAriaAktuell(pathname, punkt, aktiv)}
                />
              )
            })}
          </BottomNav>
        </div>
      )}
      {unterleiste && imRahmen && <VorschauLeisteSperre />}
    </div>
  )
}

export type KundeFokusShellProps = {
  /** Die Überschrift der Seite („Warenkorb", „Bestätigung") — die Seite setzt kein eigenes h1. */
  titel: string
  /**
   * Wohin „Zurück" führt: immer ein echtes Ziel, nie der Verlauf (ARCHITECTURE §4, „Rückweg").
   * Ein Knopf (`onClick`) nur für einen Schritt innerhalb derselben Seite — die
   * Kasse, sobald eine Bestellung steht und kein Weg hinausführen darf
   * (`kassenZurueck`, src/lib/kasse.ts).
   */
  zurueck: { href: string; label: string } | { onClick: () => void; label: string }
  /** Rechts im Kopf, z. B. der Hofname. */
  rechts?: ReactNode
  /** Die eine feste Leiste unten (Hauptaktion); am Handy fest, im Browser unter dem Inhalt. */
  aktion?: ReactNode
  children: ReactNode
}

/**
 * Fokus-Seiten: keine Unterleiste, kein Menü — nur Zurück, Titel und genau
 * eine feste Leiste unten mit der Hauptaktion (nie zwei Leisten übereinander).
 */
export function KundeFokusShell({ titel, zurueck, rechts, aktion, children }: KundeFokusShellProps): React.JSX.Element {
  return (
    <div data-design="neu" className="min-h-dvh bg-background text-foreground">
      <SprungLink />
      <header className="sticky top-0 z-40 border-b border-border bg-background print:hidden">
        {/* 56 px wie die KundeShell (Nr. 177; vorher 52) — die Ladeansichten der Fokus-Seiten haben dieselbe Höhe. */}
        <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-1.5 px-2 md:h-16 md:px-6">
          {'href' in zurueck ? (
            <Link
              href={zurueck.href}
              aria-label={zurueck.label}
              title={zurueck.label}
              className={cn('flex size-11 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-muted', FOKUS_RAHMEN)}
            >
              <ChevronLeft className="size-[22px]" strokeWidth={1.7} aria-hidden="true" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={zurueck.onClick}
              aria-label={zurueck.label}
              title={zurueck.label}
              className={cn('flex size-11 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-muted', FOKUS_RAHMEN)}
            >
              <ChevronLeft className="size-[22px]" strokeWidth={1.7} aria-hidden="true" />
            </button>
          )}
          <h1 className="min-w-0 truncate font-heading text-[17px] font-semibold md:text-xl">{titel}</h1>
          <span className="flex-1" />
          {rechts && <div className="min-w-0 truncate pr-2.5 text-[12.5px] text-muted-foreground">{rechts}</div>}
        </div>
      </header>
      {/* Kein Netz (Register N29): die Zeile unter dem Kopf, bis das Netz zurück ist. */}
      <NetzHinweis />

      <main id={INHALT_ID} tabIndex={-1} className={cn('outline-none', aktion && 'pb-28 md:pb-0')}>
        {children}
      </main>

      {aktion && (
        // data-unten-fest: Der Cookie-Hinweis steht über der Leiste (src/lib/cookie-hinweis.ts).
        <div data-unten-fest="" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] md:static md:border-0 md:bg-transparent md:pt-6 md:pb-10 print:hidden">
          <div className="mx-auto max-w-[1200px]">{aktion}</div>
        </div>
      )}
    </div>
  )
}
