'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft, ChevronLeft, Compass, Handbag, ReceiptText, Search, UserRound, type LucideIcon } from 'lucide-react'
import {
  warenkorbKopfText,
  kundenAriaAktuell,
  kundenHandyAriaAktuell,
  kundenNavigation,
  type KundenNavId,
  type KundenSitzung,
} from '@/lib/kunden-navigation'
import { useWarenkorbKopf } from '@/lib/use-warenkorb-kopf'
import { SUCHTEXT_PARAMETER } from '@/lib/suchtext-parameter'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { BottomNav, BottomNavLink, BottomNavMitte, mittelknopfMitWortKlassen, mittelkreisKlassen } from '@/components/ui/bottom-nav'
import { Zaehler } from '@/components/ui/zaehler'
import { Wortmarke } from '@/components/shared/wortmarke'
import { ThemeUmschalter } from '@/components/shared/theme-umschalter'
import { INHALT_ID, SprungLink } from '@/components/shells/sprung-link'
import { KundeFuss } from '@/components/shells/kunde-fuss'
import { KUNDE_KOPF_ZEILE, KUNDE_SHELL_MASSE } from '@/lib/kunde-shell-masse'
import { MARKE } from '@/lib/marke'
import { WIDERRUF_PFAD, WIDERRUF_TEXT } from '@/lib/widerruf'
import { VORSCHAU_LEISTE_HINWEIS, VORSCHAU_LEISTE_HINWEIS_MS } from '@/lib/hofseite-vorschau'
import { useImVorschauRahmen } from '@/components/farm/vorschau-im-rahmen'
import { NetzHinweis } from '@/components/ui/netz-hinweis'
import { NotbremseBand } from '@/components/notbremse-band'

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

/**
 * Ein Link der Kopfzeile (Boards w1-startseite, w1-hofseite; V12): 15 px in
 * der Textfarbe, der aktive grün, fett und unterstrichen. Zwischen 768 und
 * 1023 px enger und 14 px, damit vier Links mit Kurznamen in eine Zeile passen.
 */
const TEXTLINK = cn(
  'relative inline-flex min-h-11 items-center rounded-lg px-1.5 text-[14px] font-medium whitespace-nowrap text-foreground underline-offset-[6px] transition-colors duration-[250ms] hover:text-brand-text lg:px-3 lg:text-[15px] aria-[current]:font-bold aria-[current]:text-brand-text aria-[current]:underline',
  FOKUS_RAHMEN
)

/** Umriss-Pille mit 44 px (V12): „Anmelden“, „Mein Hof“, „Warenkorb · n“ — der Rand ist der Feldrand (≥ 3:1). */
const KOPF_PILLE = cn(
  'inline-flex h-11 shrink-0 items-center rounded-full border border-input px-4 text-[14px] font-semibold whitespace-nowrap text-foreground transition-colors duration-[250ms] hover:bg-muted',
  FOKUS_RAHMEN
)

/**
 * „Warenkorb · n“ im Browser-Kopf (N41 c, V12) — nur bei gefülltem Warenkorb;
 * leer steht dort nichts. Führt zum Hof, der den Korb gleich öffnet. Der Name
 * beginnt mit dem sichtbaren Text, „Artikel“ sagt nur der Screenreader.
 */
function WarenkorbPille({ anzahl, href, className }: { anzahl: number; href: string; className?: string }) {
  return (
    <Link href={href} className={cn(KOPF_PILLE, className)}>
      {warenkorbKopfText(anzahl)}
      <span className="sr-only"> Artikel</span>
    </Link>
  )
}

/** Der Warenkorb im Kopf am Handy (Fokus-Seiten ohne Unterleiste): Symbol mit Anzahl — für die Pille fehlt dort der Platz. */
function WarenkorbKopf({ anzahl, href }: { anzahl: number; href: string }) {
  return (
    <Link
      href={href}
      aria-label={`Warenkorb, ${anzahl} Artikel`}
      className={cn('relative flex size-11 items-center justify-center rounded-full text-foreground hover:bg-muted', FOKUS_RAHMEN)}
    >
      <Handbag className="size-5" strokeWidth={1.7} aria-hidden="true" />
      {/* 12 px wie jede Schrift der Kundschaft (Lauf 31, vorher 9,5 px); der Zähler ragt über den Rand des Symbols. */}
      <Zaehler anzahl={anzahl} wofuer="Artikel im Warenkorb" ton="gruen" className="absolute -top-0.5 -right-0.5 h-5 min-w-5 px-1 text-[12px]" />
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
  /**
   * Am Handy statt Marke und Knopf eine Titelzeile (Boards s1-bestaetigung, s1-bestellung-link, Lauf 31):
   * „Bestellung bei Hof Müller“ in der Überschriftenschrift. Nur Text — die h1 setzt die Seite; ab 768 px
   * bleibt der Kopf, wie er ist.
   */
  handyTitel?: string
  /**
   * Breite der Spalte, in der der Seitenfuß im Browser steht (Boards w1-bestaetigung, w1-meine-bestellungen):
   * so breit wie der Inhalt der Seite, z. B. `md:max-w-[928px]`. Ohne Angabe 1200 px.
   */
  fussSpalte?: string
  children: ReactNode
}

export function KundeShell({ sitzung, unterleiste = true, aktiv, handyTitel, fussSpalte, children }: KundeShellProps): React.JSX.Element {
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
      {/* Der Kopf auf der Fläche (bg-card) mit Linie unten wie im Board w1-startseite; die Seite darunter steht auf dem Grund. */}
      <header className="sticky top-0 z-40 border-b border-border bg-card print:hidden">
        {handyTitel && (
          // Die Titelzeile am Handy (Boards s1-bestaetigung, s1-bestellung-link): kein Logo, kein Knopf — die Seite
          // hat ihre eine Hauptaktion unten, der Weg zurück steht als Link im Inhalt.
          <div className={cn(KUNDE_KOPF_ZEILE, 'flex items-center px-4 md:hidden')}>
            <p className="min-w-0 truncate font-heading text-[20px] font-semibold text-foreground" title={handyTitel}>
              {handyTitel}
            </p>
          </div>
        )}
        {/* Über die volle Breite mit 40 px Rand ab 1024 px wie in allen Web-Boards (w1-startseite, w1-bestaetigung, Lauf 31). */}
        <div className={cn(KUNDE_KOPF_ZEILE, 'flex items-center gap-3 px-4 md:gap-3 md:px-6 lg:gap-5 lg:px-10', handyTitel && 'max-md:hidden')}>
          <Link href="/" aria-label={`${MARKE} – zur Startseite`} className={cn('inline-flex min-h-11 min-w-0 items-center rounded-md', FOKUS_RAHMEN)}>
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

          {/* Die Links stehen gleich nach Marke (und Suche), rechts nur Warenkorb, Hell/Dunkel und der Knopf (V12). */}
          <span className="flex-1 md:hidden" />
          <nav aria-label="Hauptnavigation" className="hidden min-w-0 flex-1 md:block">
            <ul className="flex items-center gap-0.5 lg:gap-1">
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
              <>
                {/* Am Handy steht der Warenkorb in der Unterleiste; nur Fokus-Seiten ohne sie zeigen ihn oben als Symbol. */}
                {!unterleiste && (
                  <span className="md:hidden">
                    <WarenkorbKopf anzahl={korb.anzahl} href={korb.href} />
                  </span>
                )}
                <WarenkorbPille anzahl={korb.anzahl} href={korb.href} className="hidden md:inline-flex" />
              </>
            )}
            {/* Am Handy steht Hell/Dunkel am Seitenfuß — oben rechts gehört der Platz dem Knopf. */}
            <ThemeUmschalter className="hidden rounded-full border border-input text-foreground hover:bg-muted md:inline-flex" />
            {nav.knopf && (
              <Link href={nav.knopf.href} aria-current={kundenAriaAktuell(pathname, nav.knopf, aktiv)} className={KOPF_PILLE}>
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
      {/* Notbremse (Register N34, Nr. 189): das Band unter dem Kopf, solange neue Bestellungen angehalten sind. */}
      <NotbremseBand />

      <main id={INHALT_ID} tabIndex={-1} className="outline-none">
        {children}
      </main>
      {/* Der Seitenfuß auf jeder Seite der Shell, am Handy samt Hell/Dunkel (im
          Browser im Kopf). Unten hält er Platz für die Unterleiste bzw. die
          feste Leiste einer Fokus-Seite frei — vorher tat das der Inhalt. */}
      <KundeFuss className="pb-28 md:pb-0 print:pb-0" spalte={fussSpalte} />

      {unterleiste && (
        // In der Vorschau im Rahmen ohne Wirkung — keine Klicks nach außen (VorschauLeisteSperre).
        <div inert={imRahmen}>
          <BottomNav className={imRahmen ? '[&>div]:opacity-55' : undefined}>
            {nav.handy.map((platz) => {
              if (platz.art === 'warenkorb') {
                // Leer gibt es keinen Korb, aber einen Ausweg: zu den Höfen (DESIGN_SYSTEM, „Leerzustand mit Ausweg").
                // Das Wort „Warenkorb“ unter dem Kreis wie „Neu“ im Hofbereich (V10, Board s1-startseite):
                // Kreis und Wort sind EIN Link, der Name beginnt mit dem Wort (WCAG 2.5.3).
                return (
                  <BottomNavMitte key="warenkorb">
                    <Link
                      href={korb?.href ?? '/hoefe'}
                      aria-label={korb ? `${warenkorbKopfText(korb.anzahl)} Artikel – öffnen` : 'Warenkorb ist leer – Höfe entdecken'}
                      className={mittelknopfMitWortKlassen()}
                    >
                      <span className={cn(mittelkreisKlassen('gruen'), 'relative')}>
                        {/* Die Tasche der Boards (s1-startseite, s1-meine-bestellungen), dieselbe wie im Kopf der Fokus-Seiten. */}
                        <Handbag className="size-6" strokeWidth={1.7} aria-hidden="true" />
                        {korb && (
                          <Zaehler
                            anzahl={korb.anzahl}
                            wofuer="Artikel im Warenkorb"
                            ton="orange"
                            // 12 px statt der 11 px des Bausteins (Lauf 31: keine Schrift unter 12 px).
                            className="absolute -top-1 -right-1 h-5 min-w-5 text-[12px] ring-2 ring-card"
                          />
                        )}
                      </span>
                      <span>{platz.wort}</span>
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
                  aktuell={kundenHandyAriaAktuell(pathname, punkt, aktiv)}
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
  /** Die Überschrift der Seite („Warenkorb", „Bestätigung") — die Seite setzt kein eigenes h1 (außer mit `h1InSeiteAbMd`). */
  titel: string
  /**
   * Wohin „Zurück" führt: immer ein echtes Ziel, nie der Verlauf (ARCHITECTURE §4, „Rückweg").
   * Ein Knopf (`onClick`) nur für einen Schritt innerhalb derselben Seite — die
   * Kasse, sobald eine Bestellung steht und kein Weg hinausführen darf
   * (`kassenZurueck`, src/lib/kasse.ts).
   */
  zurueck: { href: string; label: string } | { onClick: () => void; label: string }
  /**
   * Am Handy die zweite Zeile unter dem Titel (Boards s1-kasse „bei Hof Müller“, s1-bestellung-link „Zurück zu
   * Hof Müller“, Lauf 31). Im Browser steht sie nicht: Dort trägt der Kopf den Rückweg als Textlink.
   */
  unterzeile?: string
  /** Am Handy ohne Zurück-Pfeil (Board s1-bestellung-link Bild 3: verfallen, der Weg zurück steht in der Karte). */
  ohnePfeilAmHandy?: boolean
  /**
   * Ab 768 px setzt die Seite die h1 selbst (Board w1-kasse: „Bestellen bei Hof Müller“ über dem Inhalt) — der
   * Kopf zeigt dort nur Marke und Rückweg. Ohne Angabe steht der Titel als h1 neben der Marke (w1-bestellung-link).
   */
  h1InSeiteAbMd?: boolean
  /** Rechts im Kopf, z. B. der Hofname — nur am Handy (im Browser steht dort der Rückweg). */
  rechts?: ReactNode
  /** Die eine feste Leiste unten (Hauptaktion); am Handy fest, im Browser unter dem Inhalt. */
  aktion?: ReactNode
  /**
   * Die Leiste klebt auch im Browser am unteren Rand (Board w1-bestellung-link Bild 2: die Knöpfe unten am
   * Fenster, über einer Linie) — `sticky`, nicht `fixed`: Am Ende der Seite gibt sie den Inhalt frei.
   */
  aktionKlebtImBrowser?: boolean
  /** Breite der Zeile „Vertrag widerrufen“ am Ende — so breit wie die Spalte der Seite (Board w1-bestellung-link). */
  spalte?: string
  children: ReactNode
}

/** Der runde Zurück-Pfeil am Handy und der Textlink „← Zurück …“ im Browser — dasselbe Ziel. */
function FokusZurueck({ zurueck, form }: { zurueck: KundeFokusShellProps['zurueck']; form: 'pfeil' | 'text' }): React.JSX.Element {
  const klasse =
    form === 'pfeil'
      ? cn('flex size-11 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-muted', FOKUS_RAHMEN)
      : cn(
          'inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md px-1.5 text-[15px] font-semibold whitespace-nowrap text-status-fertig underline underline-offset-4',
          FOKUS_RAHMEN
        )
  const inhalt =
    form === 'pfeil' ? (
      <ChevronLeft className="size-[22px]" strokeWidth={1.7} aria-hidden="true" />
    ) : (
      <>
        <ArrowLeft className="size-4" strokeWidth={1.7} aria-hidden="true" />
        {zurueck.label}
      </>
    )
  // Der Pfeil trägt den Namen als aria-label; der Textlink hat ihn sichtbar.
  const name = form === 'pfeil' ? { 'aria-label': zurueck.label, title: zurueck.label } : {}
  return 'href' in zurueck ? (
    <Link href={zurueck.href} {...name} className={klasse}>
      {inhalt}
    </Link>
  ) : (
    <button type="button" onClick={zurueck.onClick} {...name} className={klasse}>
      {inhalt}
    </button>
  )
}

/**
 * Fokus-Seiten: keine Unterleiste, kein Menü — nur Zurück, Titel und genau
 * eine feste Leiste unten mit der Hauptaktion (nie zwei Leisten übereinander).
 *
 * Kopf nach den Boards (Lauf 31): am Handy Pfeil, Titel und darunter die Unterzeile (s1-kasse,
 * s1-bestellung-link); im Browser über die volle Breite die Marke, daneben der Titel und rechts
 * „← Zurück …“ als grüner Textlink (w1-kasse, w1-bestellung-link, w2-registrieren).
 */
export function KundeFokusShell({
  titel,
  zurueck,
  unterzeile,
  ohnePfeilAmHandy = false,
  h1InSeiteAbMd = false,
  rechts,
  aktion,
  aktionKlebtImBrowser = false,
  spalte = 'max-w-[1200px]',
  children,
}: KundeFokusShellProps): React.JSX.Element {
  return (
    <div data-design="neu" className="min-h-dvh bg-background text-foreground">
      <SprungLink />
      <header className="sticky top-0 z-40 border-b border-border bg-card print:hidden">
        {/* 56 px wie die KundeShell (Nr. 177; vorher 52) — die Ladeansichten der Fokus-Seiten haben dieselbe Höhe. */}
        <div className="flex h-14 items-center gap-1 px-1 md:h-16 md:gap-4 md:px-6 lg:px-10">
          {ohnePfeilAmHandy ? (
            <span className="w-3 shrink-0 md:hidden" />
          ) : (
            <span className="md:hidden">
              <FokusZurueck zurueck={zurueck} form="pfeil" />
            </span>
          )}
          <Link
            href="/"
            aria-label={`${MARKE} – zur Startseite`}
            className={cn('hidden min-h-11 shrink-0 items-center rounded-md md:inline-flex', FOKUS_RAHMEN)}
          >
            <Wortmarke />
          </Link>
          {/* Im Browser steht der Titel hinter einer Linie neben der Marke, 17 px fett (Board w1-bestellung-link). */}
          <div className={cn('flex min-w-0 flex-col md:border-l md:border-border md:pl-4', h1InSeiteAbMd && 'md:hidden')}>
            <h1 className="min-w-0 truncate font-heading text-[20px] leading-tight font-semibold text-foreground md:font-sans md:text-[17px] md:font-bold">
              {titel}
            </h1>
            {unterzeile && (
              <p className="min-w-0 truncate text-[13px] leading-snug text-muted-foreground md:hidden" title={unterzeile}>
                {unterzeile}
              </p>
            )}
          </div>
          <span className="flex-1" />
          {rechts && <div className="min-w-0 truncate pr-2.5 text-[13px] text-muted-foreground md:hidden">{rechts}</div>}
          <span className="hidden md:inline-flex">
            <FokusZurueck zurueck={zurueck} form="text" />
          </span>
        </div>
      </header>
      {/* Kein Netz (Register N29): die Zeile unter dem Kopf, bis das Netz zurück ist. */}
      <NetzHinweis />
      {/* Notbremse (Register N34, Nr. 189): das Band unter dem Kopf, solange neue Bestellungen angehalten sind. */}
      <NotbremseBand />

      <main id={INHALT_ID} tabIndex={-1} className={cn('outline-none', aktion && 'pb-28 md:pb-0')}>
        {children}
        {/* Nr. 200 (N39): Auch Fokus-Seiten ohne Seitenfuß tragen den Weg zum Widerruf — eine Zeile am Ende, als grüner
            Textlink mit Unterstrich wie die übrigen Links der Boards (w1-bestellung-link, Lauf 31). */}
        <p className={cn('mx-auto px-4 pt-2 pb-4 md:px-6 print:hidden', spalte)}>
          <Link
            href={WIDERRUF_PFAD}
            className={cn(
              'inline-flex min-h-11 items-center rounded-md px-1 text-[14px] text-status-fertig underline underline-offset-4',
              FOKUS_RAHMEN
            )}
          >
            {WIDERRUF_TEXT.fussLink}
          </Link>
        </p>
      </main>

      {aktion && (
        // data-unten-fest: Der Cookie-Hinweis steht über der Leiste (src/lib/cookie-hinweis.ts).
        <div
          data-unten-fest=""
          className={cn(
            'fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] print:hidden',
            aktionKlebtImBrowser
              ? // Die Linie zieht die Aktion selbst in der Breite ihrer Spalte (Board w1-bestellung-link Bild 2).
                'md:sticky md:border-0 md:bg-background md:pt-0 md:pb-5'
              : 'md:static md:border-0 md:bg-transparent md:pt-6 md:pb-10'
          )}
        >
          <div className="mx-auto max-w-[1200px]">{aktion}</div>
        </div>
      )}
    </div>
  )
}
