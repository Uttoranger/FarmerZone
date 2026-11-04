'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  CalendarCheck,
  ChevronDown,
  ChevronRight,
  Compass,
  Home,
  Inbox,
  LifeBuoy,
  Menu,
  Package,
  Plus,
  ReceiptText,
  ShieldCheck,
  SlidersHorizontal,
  Tag,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { hofInitialen } from '@/lib/hof-initialen'
import { NetzHinweis } from '@/components/ui/netz-hinweis'
import { vorschauLink } from '@/lib/hofseite-vorschau'
import {
  EINSTELLUNG_KONTO,
  HEUTE_LABEL,
  HOFSEITE_ANSEHEN,
  HOF_MEHR_SCHLIESSEN,
  HOF_MEHR_TITEL,
  HOF_NEU_ABBRECHEN,
  HOF_NEU_ANDERES_TITEL,
  KONTO_KURZ,
  KONTO_UND_HILFE_TITEL,
  datumOhneUmbruch,
  hauptPunktHref,
  postfachUnterzeile,
  HOF_LEISTE_KURZ,
  HOF_NEU_KNOPF,
  HOF_NEU_KNOPF_NAME,
  HOF_NEU_TITEL,
  VERKAUF_UND_KUNDEN_TITEL,
  ABMELDEN_LABEL,
  hofAriaAktuell,
  hofHandyAriaAktuell,
  hofMehrAktiv,
  hofNavigation,
  type HofNavId,
  type HofNavPunkt,
  type HofNeuPunkt,
} from '@/lib/bauern-navigation'
import type { TarifZeileDaten } from '@/lib/konditionen'
import { POSTFACH_TEXT } from '@/lib/postfach'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN, FOKUS_RAHMEN_INNEN } from '@/components/ui/fokus'
import { BottomNav, BottomNavLink, BottomNavMitte, bottomNavEintragKlassen, mittelknopfMitWortKlassen, mittelkreisKlassen } from '@/components/ui/bottom-nav'
import { SidebarEintrag, SidebarGruppe } from '@/components/ui/sidebar-gruppe'
import { ListGruppe, ListRow } from '@/components/ui/list-row'
import { Zaehler } from '@/components/ui/zaehler'
import { MenueZielAnbieter } from '@/components/ui/menue-ziel'
import { Sheet, SheetBlatt, SheetKopf, SheetTrigger } from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ThemeUmschalter, ThemeWahl } from '@/components/shared/theme-umschalter'
import { Wortmarke } from '@/components/shared/wortmarke'
import { Textlink } from '@/components/ui/textlink'
import { DARSTELLUNG_TEXT } from '@/lib/kunden-navigation'
import { MARKE } from '@/lib/marke'
import { INHALT_ID, SprungLink } from '@/components/shells/sprung-link'
import { useAbmelden } from '@/components/shells/admin-konto'
import { TarifZeile } from '@/components/hofbereich/tarif-zeile'

/*
 * Die Shell des Hofbereichs im neuen Design (Gate 2). Ordnung, aktive Punkte
 * und „Admin nur für Betreiber" kommen aus src/lib/bauern-navigation.ts
 * (hofNavigation) — Seitenleiste und Handy lesen dieselbe Quelle. Hier nur
 * Symbole und Zeichnung nach den Mockups system-komponente-seitenleiste-hof,
 * mobil-h3-heute-mit-teilen-karte und mobil-h5-mehr-auswertung-region-mein-hof.
 * Am Handy seit Nr. 49 (Register N3) abweichend vom Mockup: „Mein Hof" steht
 * in der Leiste (öffnet Produkte, aktiv nach hofHandyAriaAktuell), das
 * Mehr-Blatt beginnt ohne Hofkarte. Seit Nr. 61 steht oben im Mehr-Blatt die
 * Gruppe „Dein Tarif" und unten in der Seitenleiste vor der Person die
 * Tarif-Zeile (TarifZeile; Zustand und Texte als Prop vom Server).
 *
 * Seit Nr. 220 (Boards s1-/w1-mehr-neu, V13): oben in der Seitenleiste die
 * Marke, eine schlanke Hofkarte mit „Hofseite ansehen“ als Textlink, „+ Neu ▾“
 * als orange Pille mit dem Menü am Knopf; unten „Konto · <Name>“ mit
 * Sonne/Mond und „Abmelden“ darunter; das Datum der Tarif-Zeile bricht nicht
 * um. Am Handy liegen „Mehr“ und „Neu“ als Blatt bis zum unteren Rand, mit Kopf
 * (Titel und genau ein Schließen-Element), ohne Symbole in den Zeilen; „Mehr“
 * gliedert in Postfach · Dein Tarif · Verkauf und Kunden · Konto und Hilfe
 * (Person, Einstellungen, Problem melden, Admin, Darstellung Hell/Dunkel,
 * Abmelden).
 *
 * Die Shell setzt data-design="neu" und damit die Tokens des Design-Systems
 * für das ganze Dokument. Der Hofbereich unter (hof) läuft über diese Shell;
 * nur die Druckansichten und Reste unter (farmer) nutzen noch farmer-nav.tsx.
 */

const SYMBOL: Record<HofNavId, LucideIcon> = {
  heute: CalendarCheck,
  bestellungen: ReceiptText,
  // Ein Eingangsfach: Hier kommt an, was das Team schreibt (Register N12).
  postfach: Inbox,
  produkte: Package,
  'mein-hof': Home,
  kunden: Users,
  verkaeufe: Tag,
  auswertung: BarChart3,
  region: Compass,
  einstellungen: SlidersHorizontal,
  hilfe: LifeBuoy,
  admin: ShieldCheck,
}


export type HofShellProps = {
  hofName: string
  /** Für „Hofseite ansehen" — führt in die Vorschau der echten Hofseite. */
  hofSlug: string
  /** Wer angemeldet ist; leer = „Dein Konto". */
  personName: string
  /** Frisch aus der Datenbank (isAdminUser), nie aus der Sitzung. */
  isAdmin: boolean
  /** Offene Bestellungen, ungelesene Fäden im Postfach (N12) und Meldungen, die auf den Betreiber warten. */
  zahlen?: { bestellungen?: number; postfach?: number; admin?: number }
  /**
   * Die Tarif-Zeile, fertig vom Server (baueTarifZeile über ladeTarifZeile) —
   * die Shell rechnet nichts mit der Zeit. null oder weggelassen: keine Zeile
   * (Hofladen; die Vorschau unter /intern).
   */
  tarifZeile?: TarifZeileDaten | null
  /**
   * Nur für die Vorschau unter /intern: ersetzt das echte Abmelden, damit der
   * Admin vor der Vorschau angemeldet bleibt. Echte Routen lassen es weg.
   */
  onAbmelden?: () => void
  children: ReactNode
}

function zahlFuer(punkt: HofNavPunkt, zahlen: HofShellProps['zahlen']): number | undefined {
  if (punkt.zahl === 'bestellungen') return zahlen?.bestellungen
  if (punkt.zahl === 'postfach') return zahlen?.postfach
  if (punkt.zahl === 'admin') return zahlen?.admin
  return undefined
}

function zahlWofuer(punkt: HofNavPunkt): string {
  if (punkt.zahl === 'postfach') return POSTFACH_TEXT.zaehler
  return punkt.zahl === 'admin' ? 'Meldungen zu entscheiden' : 'offene Bestellungen'
}

/**
 * Initialen auf einer runden Plakette — für Hof und Person, keine Fotos
 * (hof-initialen.ts). Grün getönt wie in den Boards w1-mehr-neu und
 * s1-mehr-neu (Paar „läuft“, ≥ 4,5:1 in beiden Modi).
 */
function Plakette({ name, gross = false }: { name: string; gross?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-zustand-laeuft-grund font-semibold text-zustand-laeuft',
        gross ? 'size-9 text-[13px]' : 'size-[34px] text-[12px]'
      )}
    >
      {hofInitialen(name)}
    </span>
  )
}

/**
 * Die Hofkarte am Kopf der Seitenleiste (Board w1-mehr-neu): Plakette, Hofname
 * und „Hofseite ansehen“ als Textlink mit 44-px-Fläche (V16). Bis Nr. 49 stand
 * sie auch oben im Mehr-Blatt — seit Register N3 nur noch in der Seitenleiste.
 */
function Hofkarte({ hofName, hofSlug }: { hofName: string; hofSlug: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[14px] border border-border bg-background px-3 py-2.5">
      <Plakette name={hofName} gross />
      <span className="min-w-0">
        <span className="block truncate text-[13.5px] font-semibold text-foreground" title={hofName}>
          {hofName}
        </span>
        <Textlink href={vorschauLink(hofSlug)} form="im-satz" className="text-[12.5px] font-medium">
          {HOFSEITE_ANSEHEN}
        </Textlink>
      </span>
    </div>
  )
}

/**
 * Die Person im Mehr-Blatt (Board s1-mehr-neu, „Konto und Hilfe“): Plakette,
 * Name und darunter das Ziel „Konto und Sicherheit“ — die ganze Zeile ist der
 * Link (seit Nr. 44), Pfeil rechts. Steht als erste Zeile der Gruppe.
 */
export function PersonZeile({
  name,
  konto,
  onNavigate,
}: {
  name: string
  konto: { label: string; href: string }
  onNavigate?: () => void
}): React.JSX.Element {
  const anzeige = name.trim() || 'Dein Konto'
  return (
    <Link
      href={konto.href}
      onClick={onNavigate}
      className={cn('flex min-h-[60px] w-full items-center gap-3 px-3.5 py-2 text-left transition-colors duration-[250ms] hover:bg-muted', FOKUS_RAHMEN_INNEN)}
    >
      <Plakette name={anzeige} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14.5px] font-semibold text-foreground" title={anzeige}>
          {anzeige}
        </span>
        <span className="mt-0.5 block truncate text-[12.5px] text-muted-foreground">{konto.label}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.7} aria-hidden="true" />
    </Link>
  )
}

/**
 * Die Konto-Zeile unten in der Seitenleiste (V13, Board w1-mehr-neu):
 * „Konto · <Name>“ als Link auf „Konto und Sicherheit“, rechts daneben Sonne
 * bzw. Mond als runder Knopf (44 px); „Abmelden“ steht darunter.
 */
function KontoZeile({ name }: { name: string }) {
  const anzeige = name.trim() || 'Dein Konto'
  return (
    <div className="flex items-center gap-1">
      <Link
        href={EINSTELLUNG_KONTO.href}
        className={cn('flex min-h-11 min-w-0 flex-1 items-center rounded-xl px-3 text-[14px] font-medium text-foreground transition-colors duration-[250ms] hover:bg-muted', FOKUS_RAHMEN)}
      >
        <span className="truncate" title={anzeige}>
          {KONTO_KURZ} · {anzeige}
        </span>
        {/* Wohin der Link führt — sichtbar steht nur „Konto“. */}
        <span className="sr-only">{`, ${EINSTELLUNG_KONTO.label}`}</span>
      </Link>
      <ThemeUmschalter className="rounded-full border border-input text-foreground hover:bg-muted" />
    </div>
  )
}

/** Überschrift einer Gruppe im Mehr-Blatt — leise, Großbuchstaben (die Liste darunter trägt den Namen für den Screenreader). */
function BlattUeberschrift({ children }: { children: ReactNode }) {
  return (
    <p aria-hidden="true" className="px-0.5 pt-1.5 text-[11.5px] font-semibold tracking-[1.1px] text-muted-foreground uppercase">
      {children}
    </p>
  )
}

/** Ein Eintrag im Neu-Menü: Titel und ein Satz — ohne Symbol wie in den Boards s1-/w1-mehr-neu. */
function NeuInhalt({ punkt }: { punkt: HofNeuPunkt }) {
  return (
    <span className="min-w-0">
      <span className="block text-[14.5px] font-semibold text-foreground">{punkt.label}</span>
      <span className="block text-[12.5px] text-muted-foreground">{punkt.satz}</span>
    </span>
  )
}

export function HofShell({
  hofName,
  hofSlug,
  personName,
  isAdmin,
  zahlen,
  tarifZeile,
  onAbmelden,
  children,
}: HofShellProps): React.JSX.Element {
  const pathname = usePathname()
  const nav = hofNavigation({ isAdmin })
  const neuAnlegen = nav.neu.filter((p) => p.gruppe === 'anlegen')
  const neuAnderes = nav.neu.filter((p) => p.gruppe === 'anderes')

  // Höchstens ein Blatt offen: „Neu" oder „Mehr" (Muster aus farmer-nav.tsx).
  const [offen, setOffen] = useState<'neu' | 'mehr' | null>(null)
  const schliessen = () => setOffen(null)
  const wechsle = (welches: 'neu' | 'mehr') => (auf: boolean) =>
    setOffen((jetzt) => (auf ? welches : jetzt === welches ? null : jetzt))

  // Seitenwechsel schließt jedes Blatt.
  const [letzterPfad, setLetzterPfad] = useState(pathname)
  if (pathname !== letzterPfad) {
    setLetzterPfad(pathname)
    setOffen(null)
  }

  // Ab 768 px gibt es Blätter und Leiste nicht — ein offenes Blatt ließe den Schleier allein stehen.
  useEffect(() => {
    const breit = window.matchMedia('(min-width: 768px)')
    const beiWechsel = () => {
      if (breit.matches) setOffen(null)
    }
    breit.addEventListener('change', beiWechsel)
    return () => breit.removeEventListener('change', beiWechsel)
  }, [])

  // Derselbe Hook wie in der AdminShell (Nr. 132), nur mit dem Ziel des Hofbereichs.
  const abmelden = useAbmelden('/login', onAbmelden)
  // Hierhin hängt das Menü „Neu" (Nr. 132): in die Seitenleiste statt frei in den <body>.
  const menueZiel = useRef<HTMLDivElement>(null)

  // Das Datum der Tarif-Zeile bricht nie um (V13): „31. Jänner 2028“ bleibt beisammen.
  const tarif = tarifZeile ? { ...tarifZeile, zeile: datumOhneUmbruch(tarifZeile.zeile), zeileHandy: datumOhneUmbruch(tarifZeile.zeileHandy) } : null

  // Hauptpunkte ohne Platz in der Leiste stehen ganz oben im Blatt — seit Nr. 87 das Postfach (Register N12).
  const hauptImMehr = nav.mehr.filter((p) => nav.haupt.some((h) => h.id === p.id))
  // „Mehr" trägt den Zähler des Postfachs mit, solange dort Ungelesenes liegt (Mockup system-h0-navigation-postfach).
  const postfachImMehr = hauptImMehr.find((p) => p.zahl === 'postfach')
  const vukImMehr = nav.mehr.filter((p) => nav.verkaufUndKunden.some((v) => v.id === p.id))
  const untenImMehr = nav.mehr.filter((p) => nav.unten.some((u) => u.id === p.id))

  // Eine Zeile im Mehr-Blatt ohne Ziel (Darstellung, Abmelden) — Maße wie ListRow.
  const blattZeile = 'flex min-h-[54px] w-full items-center gap-3 px-3.5 py-1.5 text-left text-[14.5px] font-medium text-foreground'

  return (
    // data-scroll-rand: Der Fokus scrollt nie unter Unterleiste und Unterseiten-Kopf (WCAG 2.4.11, scroll-padding in globals.css, Nr. 177).
    <div data-design="neu" data-scroll-rand="hof" className="min-h-dvh bg-background text-foreground">
      <SprungLink />

      {/* ===== Browser: Seitenleiste ===== */}
      {/* Der Anbieter nur um die Seitenleiste, nicht um <main>: Ihr Ziel liegt in der Leiste, die unter md versteckt ist —
          ein Menü im Inhalt hinge sonst unsichtbar dort (Nr. 140). */}
      <MenueZielAnbieter ziel={menueZiel}>
        <aside
          aria-label="Hofbereich"
          className="hidden border-r border-border bg-card md:fixed md:inset-y-0 md:left-0 md:z-40 md:flex md:w-[264px] md:flex-col print:hidden"
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-3.5">
            {/* Die Marke oben (Board w1-mehr-neu) führt nach Heute, die Startseite des Hofbereichs. */}
            <Link href={hauptPunktHref('heute')} aria-label={`${MARKE} – ${HEUTE_LABEL}`} className={cn('mb-3 inline-flex min-h-11 items-center self-start rounded-md px-1', FOKUS_RAHMEN)}>
              <Wortmarke priority={false} />
            </Link>
            <Hofkarte hofName={hofName} hofSlug={hofSlug} />

            {/* „+ Neu ▾“ als orange Pille (N42 a); das Menü öffnet direkt am Knopf (N41 d). */}
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  'group mt-3 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full bg-primary px-4 text-[14.5px] font-semibold text-primary-foreground transition-colors duration-[250ms] hover:bg-primary/90',
                  FOKUS_RAHMEN
                )}
              >
                <Plus className="size-4 shrink-0" strokeWidth={2.4} aria-hidden="true" />
                <span>{HOF_NEU_KNOPF}</span>
                <ChevronDown
                  className="size-3.5 shrink-0 transition-transform group-data-[popup-open]:rotate-180"
                  strokeWidth={2.4}
                  aria-hidden="true"
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-72" container={menueZiel}>
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="px-2.5 pt-2 pb-1 font-heading text-[16px] font-semibold text-foreground">{HOF_NEU_TITEL}</DropdownMenuLabel>
                  {neuAnlegen.map((punkt) => (
                    <DropdownMenuLinkItem key={punkt.id} render={<Link href={punkt.href} />}>
                      <NeuInhalt punkt={punkt} />
                    </DropdownMenuLinkItem>
                  ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  {/* Im Web trennt nur die Linie (Board w1-mehr-neu, Bild 3); der Name der Gruppe bleibt für den Screenreader. */}
                  <DropdownMenuLabel className="sr-only">{HOF_NEU_ANDERES_TITEL}</DropdownMenuLabel>
                  {neuAnderes.map((punkt) => (
                    <DropdownMenuLinkItem key={punkt.id} render={<Link href={punkt.href} />}>
                      <NeuInhalt punkt={punkt} />
                    </DropdownMenuLinkItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <nav aria-label="Hauptnavigation" className="mt-3 flex flex-1 flex-col">
              <SidebarGruppe>
                {nav.haupt.map((punkt) => (
                  <SidebarEintrag
                    key={punkt.id}
                    href={punkt.href}
                    label={punkt.label}
                    symbol={SYMBOL[punkt.id]}
                    aktuell={hofAriaAktuell(pathname, punkt)}
                    zahl={zahlFuer(punkt, zahlen)}
                    zahlWofuer={zahlWofuer(punkt)}
                  />
                ))}
              </SidebarGruppe>
              <SidebarGruppe titel={VERKAUF_UND_KUNDEN_TITEL}>
                {nav.verkaufUndKunden.map((punkt) => (
                  <SidebarEintrag
                    key={punkt.id}
                    href={punkt.href}
                    label={punkt.label}
                    symbol={SYMBOL[punkt.id]}
                    aktuell={hofAriaAktuell(pathname, punkt)}
                  />
                ))}
              </SidebarGruppe>

              {tarif && (
                <div className="pt-4">
                  <TarifZeile daten={tarif} ziel={nav.tarif.ziel} ort="seitenleiste" />
                </div>
              )}
              <div className="mt-auto flex flex-col gap-1 border-t border-border pt-3">
                <SidebarGruppe>
                  {nav.unten.map((punkt) => (
                    <SidebarEintrag
                      key={punkt.id}
                      href={punkt.href}
                      label={punkt.label}
                      symbol={SYMBOL[punkt.id]}
                      aktuell={hofAriaAktuell(pathname, punkt)}
                      zahl={zahlFuer(punkt, zahlen)}
                      zahlWofuer={zahlWofuer(punkt)}
                      klein
                    />
                  ))}
                </SidebarGruppe>
                {/* V13: Konto mit Sonne/Mond, „Abmelden“ darunter. */}
                <KontoZeile name={personName} />
                <button
                  type="button"
                  onClick={abmelden}
                  className={cn('flex min-h-11 w-full items-center rounded-xl px-3 text-left text-[14px] font-medium text-foreground transition-colors duration-[250ms] hover:bg-muted', FOKUS_RAHMEN)}
                >
                  {ABMELDEN_LABEL}
                </button>
              </div>
            </nav>
          </div>
          {/* Ziel des Menüs „Neu": in der Landmarke, aber außerhalb des scrollenden Kastens darüber —
              dessen overflow schnitte das 288 px breite Menü an der 264 px breiten Leiste ab. */}
          <div ref={menueZiel} data-menue-ziel="" />
        </aside>
      </MenueZielAnbieter>

      <main id={INHALT_ID} tabIndex={-1} className="min-w-0 pb-28 outline-none md:pb-0 md:pl-[264px] print:pb-0 print:pl-0">
        {/* Kein Netz (Register N29): Die HofShell hat keinen eigenen Kopf, die Zeile steht über dem Inhalt — bis das Netz zurück ist. */}
        <NetzHinweis />
        {children}
      </main>

      {/* ===== Handy: Unterleiste ===== */}
      {/* Die Blätter „Neu“ und „Mehr“ liegen seit Nr. 220 über der Leiste bis zum unteren Rand (Board s1-mehr-neu);
          geschlossen wird oben im Kopf des Blatts, die Leiste bleibt unter dem Schleier. */}
      <BottomNav engUnter360>
        {nav.handyLeiste.map((platz) => {
          if (platz.art === 'punkt') {
            const { punkt } = platz
            return (
              <BottomNavLink
                key={punkt.id}
                href={punkt.href}
                label={punkt.label}
                labelKurz={HOF_LEISTE_KURZ[punkt.id]}
                symbol={SYMBOL[punkt.id]}
                aktuell={offen ? undefined : hofHandyAriaAktuell(pathname, punkt)}
                zahl={zahlFuer(punkt, zahlen)}
                zahlWofuer={zahlWofuer(punkt)}
                onNavigate={schliessen}
              />
            )
          }

          if (platz.art === 'neu') {
            return (
              <BottomNavMitte key="neu">
                <Sheet open={offen === 'neu'} onOpenChange={wechsle('neu')}>
                  {/* Wort unter dem Plus (freigabe.md §12 Nr. 45): Kreis und Wort sind EIN Knopf. */}
                  <SheetTrigger aria-label={HOF_NEU_KNOPF_NAME} className={mittelknopfMitWortKlassen()}>
                    <span className={mittelkreisKlassen('orange')}>
                      <Plus className="size-6" strokeWidth={2.2} aria-hidden="true" />
                    </span>
                    <span>{HOF_NEU_KNOPF}</span>
                  </SheetTrigger>
                  <SheetBlatt>
                    <SheetKopf titel={HOF_NEU_TITEL} schliessen={HOF_NEU_ABBRECHEN} />
                    {[neuAnlegen, neuAnderes].map((gruppe, i) => (
                      <div key={i} className="flex flex-col gap-2">
                        {i > 0 && <BlattUeberschrift>{HOF_NEU_ANDERES_TITEL}</BlattUeberschrift>}
                        <ul aria-label={i === 0 ? HOF_NEU_TITEL : HOF_NEU_ANDERES_TITEL} className="flex flex-col gap-2.5">
                          {gruppe.map((punkt) => (
                            <li key={punkt.id}>
                              <Link
                                href={punkt.href}
                                onClick={schliessen}
                                className={cn(
                                  'flex min-h-[64px] items-center rounded-[14px] border border-border bg-card px-3.5 py-2.5 transition-colors duration-[250ms] hover:bg-muted',
                                  FOKUS_RAHMEN
                                )}
                              >
                                <NeuInhalt punkt={punkt} />
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </SheetBlatt>
                </Sheet>
              </BottomNavMitte>
            )
          }

          const mehrAktiv = offen === 'mehr' || (!offen && hofMehrAktiv(pathname))
          return (
            <Sheet key="mehr" open={offen === 'mehr'} onOpenChange={wechsle('mehr')}>
              <SheetTrigger aria-current={!offen && hofMehrAktiv(pathname) ? 'true' : undefined} className={bottomNavEintragKlassen(mehrAktiv)}>
                <span className="relative">
                  <Menu className="size-[22px]" strokeWidth={1.7} aria-hidden="true" />
                  {postfachImMehr && (
                    <Zaehler
                      anzahl={zahlFuer(postfachImMehr, zahlen)}
                      wofuer={zahlWofuer(postfachImMehr)}
                      className="absolute -top-1.5 -right-2.5 h-4 min-w-4 px-1 text-[9.5px]"
                    />
                  )}
                </span>
                <span>{HOF_MEHR_TITEL}</span>
              </SheetTrigger>
              <SheetBlatt>
                <SheetKopf titel={HOF_MEHR_TITEL} schliessen={HOF_MEHR_SCHLIESSEN} />
                {hauptImMehr.length > 0 && (
                  <ListGruppe>
                    {hauptImMehr.map((punkt) => {
                      const zahl = zahlFuer(punkt, zahlen)
                      return (
                        <ListRow
                          key={punkt.id}
                          titel={punkt.label}
                          // Sichtbar „1 neue Nachricht“; der Screenreader hört die Zahl über den Zähler (kein doppelter Satz).
                          untertitel={punkt.zahl === 'postfach' && zahl ? <span aria-hidden="true">{postfachUnterzeile(zahl)}</span> : undefined}
                          href={punkt.href}
                          aktuell={hofHandyAriaAktuell(pathname, punkt)}
                          ende={<Zaehler anzahl={zahl} wofuer={zahlWofuer(punkt)} />}
                          onNavigate={schliessen}
                        />
                      )
                    })}
                  </ListGruppe>
                )}
                {tarif && (
                  <div role="group" aria-label={nav.tarif.titel} className="flex flex-col gap-2">
                    <BlattUeberschrift>{nav.tarif.titel}</BlattUeberschrift>
                    <TarifZeile daten={tarif} ziel={nav.tarif.ziel} ort="blatt" onNavigate={schliessen} />
                  </div>
                )}
                <BlattUeberschrift>{VERKAUF_UND_KUNDEN_TITEL}</BlattUeberschrift>
                <ListGruppe beschriftung={VERKAUF_UND_KUNDEN_TITEL}>
                  {vukImMehr.map((punkt) => (
                    <ListRow
                      key={punkt.id}
                      titel={punkt.label}
                      href={punkt.href}
                      aktuell={hofHandyAriaAktuell(pathname, punkt)}
                      onNavigate={schliessen}
                    />
                  ))}
                </ListGruppe>
                <BlattUeberschrift>{KONTO_UND_HILFE_TITEL}</BlattUeberschrift>
                <ListGruppe beschriftung={KONTO_UND_HILFE_TITEL}>
                  <li>
                    <PersonZeile name={personName} konto={EINSTELLUNG_KONTO} onNavigate={schliessen} />
                  </li>
                  {untenImMehr.map((punkt) => (
                    <ListRow
                      key={punkt.id}
                      titel={punkt.label}
                      href={punkt.href}
                      aktuell={hofHandyAriaAktuell(pathname, punkt)}
                      ende={<Zaehler anzahl={zahlFuer(punkt, zahlen)} wofuer={zahlWofuer(punkt)} />}
                      onNavigate={schliessen}
                    />
                  ))}
                  <li className={blattZeile}>
                    <span aria-hidden="true" className="flex-1">
                      {DARSTELLUNG_TEXT.titel}
                    </span>
                    <ThemeWahl />
                  </li>
                  <li>
                    <button type="button" onClick={abmelden} className={cn(blattZeile, 'transition-colors duration-[250ms] hover:bg-muted', FOKUS_RAHMEN_INNEN)}>
                      {ABMELDEN_LABEL}
                    </button>
                  </li>
                </ListGruppe>
              </SheetBlatt>
            </Sheet>
          )
        })}
      </BottomNav>
    </div>
  )
}
