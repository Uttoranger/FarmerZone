'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronLeft, Compass, ReceiptText, Search, ShoppingBasket, UserRound, type LucideIcon } from 'lucide-react'
import { kundenAriaAktuell, kundenNavigation, type KundenNavId, type KundenSitzung } from '@/lib/kunden-navigation'
import { useWarenkorbKopf } from '@/lib/use-warenkorb-kopf'
import { SUCHTEXT_PARAMETER } from '@/schemas/hoefe-filter'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { BottomNav, BottomNavLink, BottomNavMitte, mittelknopfKlassen } from '@/components/ui/bottom-nav'
import { Zaehler } from '@/components/ui/zaehler'
import { Wortmarke } from '@/components/shared/wortmarke'
import { ThemeUmschalter, ThemeUmschalterZeile } from '@/components/shared/theme-umschalter'
import { INHALT_ID, SprungLink } from '@/components/shells/sprung-link'

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
      <Zaehler anzahl={anzahl} wofuer="Artikel im Korb" ton="gruen" className="absolute top-0.5 right-0 h-4 min-w-4 px-1 text-[9.5px]" />
    </Link>
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
  children: ReactNode
}

export function KundeShell({ sitzung, unterleiste = true, children }: KundeShellProps): React.JSX.Element {
  const pathname = usePathname()
  const nav = kundenNavigation({ sitzung })
  const korb = useWarenkorbKopf()
  // Steht der Warenkorb auch am Handy im Kopf (Fokus-Seiten ohne Unterleiste),
  // reicht der Platz neben „Anmelden" unter 360 px nicht für das Wort „FarmerZone".
  const korbAmHandy = korb !== null && !unterleiste

  return (
    <div data-design="neu" className="min-h-dvh bg-background text-foreground">
      <SprungLink />
      <header className="sticky top-0 z-40 border-b border-border bg-background print:hidden">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-3 px-4 md:h-16 md:gap-3 md:px-6 lg:gap-[22px]">
          <Link href="/" aria-label="FarmerZone – zur Startseite" className={cn('rounded-md', FOKUS_RAHMEN)}>
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
                  <Link href={punkt.href} aria-current={kundenAriaAktuell(pathname, punkt)} className={TEXTLINK}>
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
              <Link href={nav.knopf.href} aria-current={kundenAriaAktuell(pathname, nav.knopf)} className={KOPF_KNOPF}>
                {nav.knopf.label}
              </Link>
            )}
            {nav.konto && (
              <Link
                href={nav.konto.href}
                aria-label={nav.konto.label}
                title={nav.konto.label}
                aria-current={kundenAriaAktuell(pathname, nav.konto)}
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

      <main id={INHALT_ID} tabIndex={-1} className="pb-28 outline-none md:pb-0 print:pb-0">
        {children}
        {/* Seitenfuß am Handy: Hell/Dunkel (im Browser im Kopf). Als letzter
            Teil des Inhalts, auf jeder Seite der Shell — auch dort, wo kein
            Fuß der Startseite steht. */}
        <div className="border-t border-border px-2 py-1.5 md:hidden print:hidden">
          <ThemeUmschalterZeile className={cn('w-auto text-muted-foreground hover:text-foreground', FOKUS_RAHMEN)} />
        </div>
      </main>

      {unterleiste && (
        <BottomNav>
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
                        wofuer="Artikel im Korb"
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
                aktuell={kundenAriaAktuell(pathname, punkt)}
              />
            )
          })}
        </BottomNav>
      )}
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
        <div className="mx-auto flex h-[52px] max-w-[1200px] items-center gap-1.5 px-2 md:h-16 md:px-6">
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

      <main id={INHALT_ID} tabIndex={-1} className={cn('outline-none', aktion && 'pb-28 md:pb-0')}>
        {children}
      </main>

      {aktion && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] md:static md:border-0 md:bg-transparent md:pt-6 md:pb-10 print:hidden">
          <div className="mx-auto max-w-[1200px]">{aktion}</div>
        </div>
      )}
    </div>
  )
}
