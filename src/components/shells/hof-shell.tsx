'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarCheck, ChevronRight, Home, Menu, Plus, ReceiptText, type LucideIcon } from 'lucide-react'
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
import {
  BOTTOM_NAV_ZAEHLER,
  BottomNav,
  BottomNavLink,
  BottomNavMitte,
  bottomNavEintragKlassen,
  bottomNavSymbolKlassen,
  mittelflaecheKlassen,
  mittelknopfFlachKlassen,
} from '@/components/ui/bottom-nav'
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
 * Seit Nr. 233 (Nacharbeit 220, Boards w1-/s1-mehr-neu und s1-heute): die
 * Seitenleiste ohne Symbole, der aktive Eintrag grün getönt, Zeilen 44 px ohne
 * Abstand — so passt sie ohne Admin ganz in 900 px Höhe und beginnt nie
 * angeschnitten; in der Unterleiste eine getönte Pille am aktiven Eintrag und
 * „Neu“ als flache orange Fläche; im Mehr-Blatt Zeilen 56 px, fett.
 *
 * Die Shell setzt data-design="neu" und damit die Tokens des Design-Systems
 * für das ganze Dokument. Der Hofbereich unter (hof) läuft über diese Shell;
 * nur die Druckansichten und Reste unter (farmer) nutzen noch farmer-nav.tsx.
 */

/** Symbole nur für die Unterleiste — die Seitenleiste zeigt seit Nr. 233 reine Texteinträge (Board w1-mehr-neu). */
const SYMBOL: Partial<Record<HofNavId, LucideIcon>> = {
  heute: CalendarCheck,
  bestellungen: ReceiptText,
  'mein-hof': Home,
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
function Plakette({ name, eckig = false }: { name: string; eckig?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center bg-zustand-laeuft-grund text-[13px] font-bold text-zustand-laeuft',
        // Der Hof trägt in der Seitenleiste ein Kästchen (32 px, Board w1-mehr-neu), die Person einen Kreis (36 px).
        eckig ? 'size-8 rounded-[9px]' : 'size-9 rounded-full'
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
    <div className="flex min-h-12 items-center gap-2.5 rounded-[12px] border border-border px-2.5 py-0.5">
      <Plakette name={hofName} eckig />
      <span className="min-w-0">
        <span className="block truncate text-[14px] font-bold text-foreground" title={hofName}>
          {hofName}
        </span>
        <Textlink href={vorschauLink(hofSlug)} form="im-satz" className="text-[13px] font-medium">
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
      className={cn('flex min-h-[60px] w-full items-center gap-2.5 px-3 py-2 text-left transition-colors duration-[250ms] hover:bg-muted', FOKUS_RAHMEN_INNEN)}
    >
      <Plakette name={anzeige} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold text-foreground" title={anzeige}>
          {anzeige}
        </span>
        <span className="block truncate text-[13px] text-muted-foreground">{konto.label}</span>
      </span>
      {/* Pfeil wie die Zeilen im Blatt (Board s1-mehr-neu): 18 px, Strich 2, in der Schriftfarbe. */}
      <ChevronRight className="size-[18px] shrink-0 text-foreground" strokeWidth={2} aria-hidden="true" />
    </Link>
  )
}

/**
 * Die Konto-Zeile unten in der Seitenleiste (V13, Board w1-mehr-neu):
 * „Konto · <Name>“ als Link auf „Konto und Sicherheit“, rechts daneben der
 * Mond als runder Knopf (44 px, in beiden Themes wie im Board); „Abmelden“
 * steht darunter.
 */
function KontoZeile({ name }: { name: string }) {
  const anzeige = name.trim() || 'Dein Konto'
  return (
    <div className="flex items-center gap-1">
      <Link
        href={EINSTELLUNG_KONTO.href}
        className={cn('flex min-h-11 min-w-0 flex-1 items-center rounded-[10px] px-3 text-[15px] font-medium text-foreground transition-colors duration-[250ms] hover:bg-muted', FOKUS_RAHMEN)}
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
    <p aria-hidden="true" className="px-1 pt-1 text-[13px] font-bold tracking-[0.52px] text-muted-foreground uppercase">
      {children}
    </p>
  )
}

/** Ein Eintrag im Neu-Menü: Titel und ein Satz — ohne Symbol wie in den Boards s1-/w1-mehr-neu; im Blatt eine Stufe größer. */
function NeuInhalt({ punkt, blatt = false }: { punkt: HofNeuPunkt; blatt?: boolean }) {
  return (
    <span className="min-w-0">
      <span className={cn('block font-bold text-foreground', blatt ? 'text-[16px]' : 'text-[15px]')}>{punkt.label}</span>
      <span className={cn('block text-muted-foreground', blatt ? 'text-[14px]' : 'text-[13px]')}>{punkt.satz}</span>
    </span>
  )
}

/**
 * Ein Eintrag im Menü „Neu“ am Computer: 64 px hoch und 2 px Abstand — im Board w1-mehr-neu (Bild 3) stehen die
 * Einträge 66 px auseinander (UI-Runde 3; vorher 52 px ohne Abstand).
 */
// Dazu an jedem Eintrag FOKUS_RAHMEN_INNEN (Liste Lauf 32, mehr-neu Bild 3): per Tastatur geöffnet trägt der erste
// Eintrag die Hervorhebung UND einen sichtbaren Fokusrahmen (innen, das Menü schneidet ab) — die Tönung kommt nur dazu.
const NEU_MENUE_EINTRAG = 'min-h-16 px-3.5 py-1.5'

/** Die Gruppen des Menüs „Neu“ mit dem Abstand des Boards (2 px) zwischen den Einträgen. */
const NEU_MENUE_GRUPPE = 'flex flex-col gap-0.5'

/**
 * Ab 48rem (md, bei 16 px Grundschrift 768 px) gilt die Seitenleiste, darunter die Unterleiste. In `rem`,
 * genau wie Tailwinds `md:` – mit `px` fiele die Grenze bei größerer Browserschrift anders als die Klassen
 * (Knopf sichtbar, Menü in der noch verborgenen Seitenleiste).
 * null, wo es kein Fenster zum Fragen gibt (Server, Test): dann bleibt jeder Knopf bei seiner eigenen Form.
 */
/** Fokus-Seiten ohne Unterleiste am Handy: das Bestelldetail /orders/<id> (nicht die Liste /orders). */
const HOF_FOKUS_SEITE = /^\/orders\/[^/]+\/?$/

/** Dieselbe Grenze wie Tailwinds `md:` (48rem). */
const MD_ABFRAGE = '(min-width: 48rem)'

function fensterBreit(): boolean | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null
  return window.matchMedia(MD_ABFRAGE).matches
}

/** Die Blätter am Handy lassen oben den Kopf der Seite sichtbar (Board s1-mehr-neu: höchstens 86 % der Höhe). */
const BLATT_HOEHE = 'max-h-[86dvh] gap-2.5 px-4'

/** Karten im Mehr-Blatt: 16 px Rundung wie im Board (rounded-2xl wäre im neuen Design 29 px). */
const BLATT_GRUPPE = 'rounded-[16px]'

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
  // Das Bestelldetail ist am Handy eine Fokus-Seite wie die Kasse (Liste Lauf 32, bestellung 390): ohne Unterleiste,
  // nur die Aktionsleiste unten — sonst stünden zwei feste Leisten übereinander. Zurück führt der Werkzeug-Kopf.
  const fokusSeite = HOF_FOKUS_SEITE.test(pathname)
  const nav = hofNavigation({ isAdmin })
  const neuAnlegen = nav.neu.filter((p) => p.gruppe === 'anlegen')
  const neuAnderes = nav.neu.filter((p) => p.gruppe === 'anderes')

  // Höchstens ein Blatt offen: „Neu" oder „Mehr" (Muster aus farmer-nav.tsx).
  const [offen, setOffen] = useState<'neu' | 'mehr' | null>(null)
  // Das Menü „Neu“ in der Seitenleiste — gesteuert, damit der Knopf der Unterleiste es öffnen kann (unten).
  const [menueOffen, setMenueOffen] = useState(false)
  const schliessen = () => setOffen(null)
  const wechsle = (welches: 'neu' | 'mehr') => (auf: boolean) => {
    // Ab 768 px ist „Neu“ das Menü am Knopf der Seitenleiste (Board w1-mehr-neu, Bild 3), nie das Blatt über die ganze
    // Breite. Der Knopf der Unterleiste ist dort versteckt, ein Skript oder Vorleser erreicht ihn aber noch (die
    // Aufnahme von UI-Runde 2 klickte ihn) — er öffnet dann das Menü der Seitenleiste.
    if (auf && welches === 'neu' && fensterBreit() === true) {
      setMenueOffen(true)
      return
    }
    setOffen((jetzt) => (auf ? welches : jetzt === welches ? null : jetzt))
  }
  // Umgekehrt unter 768 px: Der Knopf der Seitenleiste ist versteckt, „Neu“ ist dort das Blatt.
  const wechsleMenue = (auf: boolean) => {
    if (auf && fensterBreit() === false) {
      setOffen('neu')
      return
    }
    setMenueOffen(auf)
  }

  // Seitenwechsel schließt jedes Blatt.
  const [letzterPfad, setLetzterPfad] = useState(pathname)
  if (pathname !== letzterPfad) {
    setLetzterPfad(pathname)
    setOffen(null)
    setMenueOffen(false)
  }

  // Ab 768 px gibt es Blätter und Leiste nicht — ein offenes Blatt ließe den Schleier allein stehen.
  useEffect(() => {
    const breit = window.matchMedia(MD_ABFRAGE)
    const beiWechsel = () => {
      if (breit.matches) setOffen(null)
      else setMenueOffen(false)
    }
    breit.addEventListener('change', beiWechsel)
    return () => breit.removeEventListener('change', beiWechsel)
  }, [])

  // Derselbe Hook wie in der AdminShell (Nr. 132), nur mit dem Ziel des Hofbereichs.
  const abmelden = useAbmelden('/login', onAbmelden)
  // Hierhin hängt das Menü „Neu" (Nr. 132): in die Seitenleiste statt frei in den <body>.
  const menueZiel = useRef<HTMLDivElement>(null)

  // Das Datum der Tarif-Zeile bricht nie um (V13): „31. Jänner 2028“ bleibt beisammen.
  const tarif = tarifZeile
    ? {
        ...tarifZeile,
        zeile: datumOhneUmbruch(tarifZeile.zeile),
        zeileHandy: datumOhneUmbruch(tarifZeile.zeileHandy),
        restzeit: tarifZeile.restzeit === undefined ? undefined : datumOhneUmbruch(tarifZeile.restzeit),
      }
    : null

  // Hauptpunkte ohne Platz in der Leiste stehen ganz oben im Blatt — seit Nr. 87 das Postfach (Register N12).
  const hauptImMehr = nav.mehr.filter((p) => nav.haupt.some((h) => h.id === p.id))
  // „Mehr" trägt den Zähler des Postfachs mit, solange dort Ungelesenes liegt (Mockup system-h0-navigation-postfach).
  const postfachImMehr = hauptImMehr.find((p) => p.zahl === 'postfach')
  const vukImMehr = nav.mehr.filter((p) => nav.verkaufUndKunden.some((v) => v.id === p.id))
  const untenImMehr = nav.mehr.filter((p) => nav.unten.some((u) => u.id === p.id))

  // Eine Zeile im Mehr-Blatt ohne Ziel (Darstellung, Abmelden) — Maße wie ListRow.
  const blattZeile = 'flex min-h-14 w-full items-center gap-2.5 px-3 py-1.5 text-left text-[15px] font-bold text-foreground'

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
          {/* Maße wie im Board (Zeilen 44 px ohne Abstand): Ohne Admin passt die Leiste in 900 px Höhe, sie scrollt nur mit
              „Admin“ und auf kleineren Fenstern — und beginnt dann oben mit der Marke, nie angeschnitten. */}
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pt-1.5 pb-2">
            {/* Die Marke oben (Board w1-mehr-neu) führt nach Heute, die Startseite des Hofbereichs. */}
            {/* Sichtbar 32 px hoch mit 4 px darunter wie im Board (die Hofkarte beginnt 42 px unter dem Rand); die
                Tippfläche bleibt 44 px über ::before. */}
            <Link
              href={hauptPunktHref('heute')}
              aria-label={`${MARKE} – ${HEUTE_LABEL}`}
              className={cn(
                "relative mb-1 inline-flex min-h-8 shrink-0 items-center self-start rounded-md px-1 before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-['']",
                FOKUS_RAHMEN
              )}
            >
              <Wortmarke priority={false} />
            </Link>
            <Hofkarte hofName={hofName} hofSlug={hofSlug} />

            {/* „+ Neu ▾“ als orange Pille (N42 a) mit den Zeichen des Boards; das Menü öffnet direkt am Knopf (N41 d). */}
            <DropdownMenu open={menueOffen} onOpenChange={wechsleMenue}>
              <DropdownMenuTrigger
                className={cn(
                  'mt-1.5 mb-1 flex min-h-11 w-full shrink-0 items-center justify-center gap-1 rounded-full bg-primary px-4 text-[15px] font-bold text-primary-foreground transition-colors duration-[250ms] hover:bg-primary/90',
                  FOKUS_RAHMEN
                )}
              >
                {/* Zeichen statt Symbole wie im Board w1-mehr-neu; der Name bleibt „Neu“. Auch offen „▾“ wie im Board
                    (Bild 3) — der Zustand steht in aria-expanded. */}
                <span aria-hidden="true">+</span>
                <span>{HOF_NEU_KNOPF}</span>
                <span aria-hidden="true">▾</span>
              </DropdownMenuTrigger>
              {/* Das Menü deckt die getönte Zeile „Heute“ ganz ab (Board Bild 3): 2 px unter dem Knopf, also 2 px über der
                  Zeile (mb-1 = 4 px), 1 px links von ihr und mit der Rundung des Boards (14 px) — so schaut weder oben ein
                  Streifen noch an der runden Ecke ein Stück der Zeile (Rundung 10 px) hervor. */}
              {/* 334 px breit: Das Board zeichnet 320 px Inhalt plus 6 px Polster und 1 px Rand je Seite (UI-Runde 4). */}
              <DropdownMenuContent className={cn('w-[334px] rounded-[14px]', NEU_MENUE_GRUPPE)} sideOffset={2} alignOffset={-1} container={menueZiel}>
                <DropdownMenuGroup className={NEU_MENUE_GRUPPE}>
                  <DropdownMenuLabel className="px-3.5 pt-1.5 pb-0.5 font-heading text-[17px] font-semibold text-foreground">{HOF_NEU_TITEL}</DropdownMenuLabel>
                  {neuAnlegen.map((punkt) => (
                    <DropdownMenuLinkItem key={punkt.id} className={cn(NEU_MENUE_EINTRAG, FOKUS_RAHMEN_INNEN)} render={<Link href={punkt.href} />}>
                      <NeuInhalt punkt={punkt} />
                    </DropdownMenuLinkItem>
                  ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator className="mx-2 my-1" />
                <DropdownMenuGroup className={NEU_MENUE_GRUPPE}>
                  {/* Im Web trennt nur die Linie (Board w1-mehr-neu, Bild 3); der Name der Gruppe bleibt für den Screenreader. */}
                  <DropdownMenuLabel className="sr-only">{HOF_NEU_ANDERES_TITEL}</DropdownMenuLabel>
                  {neuAnderes.map((punkt) => (
                    <DropdownMenuLinkItem key={punkt.id} className={cn(NEU_MENUE_EINTRAG, FOKUS_RAHMEN_INNEN)} render={<Link href={punkt.href} />}>
                      <NeuInhalt punkt={punkt} />
                    </DropdownMenuLinkItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <nav aria-label="Hauptnavigation" className="flex flex-1 flex-col">
              <SidebarGruppe>
                {nav.haupt.map((punkt) => (
                  <SidebarEintrag
                    key={punkt.id}
                    href={punkt.href}
                    label={punkt.label}
                    aktuell={hofAriaAktuell(pathname, punkt)}
                    zahl={zahlFuer(punkt, zahlen)}
                    zahlWofuer={zahlWofuer(punkt)}
                  />
                ))}
              </SidebarGruppe>
              <SidebarGruppe titel={VERKAUF_UND_KUNDEN_TITEL}>
                {nav.verkaufUndKunden.map((punkt) => (
                  <SidebarEintrag key={punkt.id} href={punkt.href} label={punkt.label} aktuell={hofAriaAktuell(pathname, punkt)} />
                ))}
              </SidebarGruppe>

              {tarif && (
                <div className="pt-1 pb-3">
                  <TarifZeile daten={tarif} ziel={nav.tarif.ziel} ort="seitenleiste" />
                </div>
              )}
              <div className="mt-auto flex flex-col border-t border-border pt-0.5">
                <SidebarGruppe>
                  {nav.unten.map((punkt) => (
                    <SidebarEintrag
                      key={punkt.id}
                      href={punkt.href}
                      label={punkt.label}
                      aktuell={hofAriaAktuell(pathname, punkt)}
                      zahl={zahlFuer(punkt, zahlen)}
                      zahlWofuer={zahlWofuer(punkt)}
                    />
                  ))}
                </SidebarGruppe>
                {/* V13: Konto mit Sonne/Mond, „Abmelden“ darunter. */}
                <KontoZeile name={personName} />
                <button
                  type="button"
                  onClick={abmelden}
                  className={cn('flex min-h-11 w-full items-center rounded-[10px] px-3 text-left text-[15px] font-medium text-foreground transition-colors duration-[250ms] hover:bg-muted', FOKUS_RAHMEN)}
                >
                  {ABMELDEN_LABEL}
                </button>
              </div>
            </nav>
          </div>
          {/* Ziel des Menüs „Neu": in der Landmarke, aber außerhalb des scrollenden Kastens darüber —
              dessen overflow schnitte das 334 px breite Menü an der 264 px breiten Leiste ab. */}
          <div ref={menueZiel} data-menue-ziel="" />
        </aside>
      </MenueZielAnbieter>

      <main id={INHALT_ID} tabIndex={-1} className={cn('min-w-0 pb-28 outline-none md:pb-0 md:pl-[264px] print:pb-0 print:pl-0', fokusSeite && 'max-md:pb-0')}>
        {/* Kein Netz (Register N29): Die HofShell hat keinen eigenen Kopf, die Zeile steht über dem Inhalt — bis das Netz zurück ist. */}
        <NetzHinweis />
        {children}
      </main>

      {/* ===== Handy: Unterleiste ===== */}
      {/* Die Blätter „Neu“ und „Mehr“ liegen seit Nr. 220 über der Leiste bis zum unteren Rand (Board s1-mehr-neu);
          geschlossen wird oben im Kopf des Blatts, die Leiste bleibt unter dem Schleier. */}
      <BottomNav engUnter360 ton="orange" className={cn(fokusSeite && 'hidden')}>
        {nav.handyLeiste.map((platz) => {
          if (platz.art === 'punkt') {
            const { punkt } = platz
            return (
              <BottomNavLink
                key={punkt.id}
                href={punkt.href}
                label={punkt.label}
                labelKurz={HOF_LEISTE_KURZ[punkt.id]}
                // Die Leiste führt nur Punkte mit Symbol (Heute, Bestellungen, Mein Hof); der Ersatz greift nie.
                symbol={SYMBOL[punkt.id] ?? Menu}
                aktuell={offen ? undefined : hofHandyAriaAktuell(pathname, punkt)}
                zahl={zahlFuer(punkt, zahlen)}
                zahlWofuer={zahlWofuer(punkt)}
                onNavigate={schliessen}
              />
            )
          }

          if (platz.art === 'neu') {
            return (
              <BottomNavMitte key="neu" flach>
                <Sheet open={offen === 'neu'} onOpenChange={wechsle('neu')}>
                  {/* Wort unter dem Plus (freigabe.md §12 Nr. 45): Fläche und Wort sind EIN Knopf; flach in der Leiste seit Nr. 233 (Board s1-heute). */}
                  <SheetTrigger aria-label={HOF_NEU_KNOPF_NAME} className={mittelknopfFlachKlassen()}>
                    <span className={mittelflaecheKlassen('orange')}>
                      <Plus className="size-[22px]" strokeWidth={2.4} aria-hidden="true" />
                    </span>
                    <span className="max-w-full truncate px-0.5">{HOF_NEU_KNOPF}</span>
                  </SheetTrigger>
                  <SheetBlatt className={BLATT_HOEHE} schleier="abgedunkelt" kopf={<SheetKopf titel={HOF_NEU_TITEL} schliessen={HOF_NEU_ABBRECHEN} />}>
                    {[neuAnlegen, neuAnderes].map((gruppe, i) => (
                      <div key={i} className="flex flex-col gap-2">
                        {i > 0 && <BlattUeberschrift>{HOF_NEU_ANDERES_TITEL}</BlattUeberschrift>}
                        <ul aria-label={i === 0 ? HOF_NEU_TITEL : HOF_NEU_ANDERES_TITEL} className="flex flex-col gap-2.5">
                          {gruppe.map((punkt) => (
                            <li key={punkt.id}>
                              <Link
                                href={punkt.href}
                                onClick={schliessen}
                                // 74 px wie im Board s1-mehr-neu (Bild 3, UI-Runde 4; vorher 60 px).
                                className={cn(
                                  'flex min-h-[74px] items-center rounded-[14px] border border-input bg-card px-3.5 py-1.5 transition-colors duration-[250ms] hover:bg-muted',
                                  FOKUS_RAHMEN
                                )}
                              >
                                <NeuInhalt punkt={punkt} blatt />
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
                <span className={bottomNavSymbolKlassen(mehrAktiv)}>
                  <Menu className="size-[22px]" strokeWidth={1.8} aria-hidden="true" />
                  {postfachImMehr && (
                    <Zaehler anzahl={zahlFuer(postfachImMehr, zahlen)} wofuer={zahlWofuer(postfachImMehr)} klein className={BOTTOM_NAV_ZAEHLER} />
                  )}
                </span>
                <span>{HOF_MEHR_TITEL}</span>
              </SheetTrigger>
              {/* Griff und Kopf stehen fest, nur die Gruppen scrollen darunter (Board s1-mehr-neu, Bild 2). */}
              <SheetBlatt className={BLATT_HOEHE} schleier="abgedunkelt" kopf={<SheetKopf titel={HOF_MEHR_TITEL} schliessen={HOF_MEHR_SCHLIESSEN} />}>
                {hauptImMehr.length > 0 && (
                  <ListGruppe className={BLATT_GRUPPE}>
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
                          gross
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
                <ListGruppe beschriftung={VERKAUF_UND_KUNDEN_TITEL} className={BLATT_GRUPPE}>
                  {vukImMehr.map((punkt) => (
                    <ListRow
                      key={punkt.id}
                      titel={punkt.label}
                      href={punkt.href}
                      aktuell={hofHandyAriaAktuell(pathname, punkt)}
                      onNavigate={schliessen}
                      gross
                    />
                  ))}
                </ListGruppe>
                <BlattUeberschrift>{KONTO_UND_HILFE_TITEL}</BlattUeberschrift>
                <ListGruppe beschriftung={KONTO_UND_HILFE_TITEL} className={BLATT_GRUPPE}>
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
                      gross
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
