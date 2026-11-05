import type { ReactNode } from 'react'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { Zaehler } from '@/components/ui/zaehler'

/**
 * BottomNav: die Unterleiste am Handy (unter 768 px) mit dem Knopf in der
 * Mitte — Kunde: Warenkorb (grün, erhoben), Hof: „Neu" (orange, seit Nr. 233
 * flach in der Leiste wie im Board s1-heute) (docs/ai/DESIGN_SYSTEM.md,
 * „Navigation"). Die Leiste ordnet nichts selbst: Welche Einträge in welcher
 * Reihenfolge stehen, kommt aus der Navigations-Quelle der Welt
 * (bauern-navigation.ts, kunden-navigation.ts), die Shell setzt die Teile
 * zusammen.
 *
 * Teile:
 *  - `BottomNav`: die feste Leiste, `<nav>`, mit Abstand für den
 *    Home-Indicator (safe-area-inset-bottom); `ton` ist die Farbe des
 *    aktiven Eintrags (grün: Kundschaft und Admin, orange: Hofbereich).
 *  - `BottomNavLink`: ein Ziel mit Symbol und kurzem Namen.
 *  - `BottomNavMitte`: der Platz in der Mitte; darin ein Link oder Knopf mit
 *    `mittelknopfKlassen(ton)` (ein Knopf kann so auch ein SheetTrigger sein).
 *  - `bottomNavEintragKlassen` + `bottomNavSymbolKlassen`: dieselbe Gestalt
 *    wie ein Link, für Knöpfe (z. B. „Mehr", das ein Blatt öffnet).
 *  - `mittelknopfMitWortKlassen` + `mittelkreisKlassen`: der erhobene
 *    Mittelknopf mit einem Wort unter dem Kreis (Kunde: „Warenkorb").
 *  - `mittelknopfFlachKlassen` + `mittelflaecheKlassen`: der flache
 *    Mittelknopf mit Wort (Hof: „Neu", freigabe.md §12 Nr. 45, Board s1-heute).
 */
export function BottomNav({
  beschriftung = 'Hauptnavigation',
  ueberSchleier = false,
  engUnter360 = false,
  ton = 'gruen',
  children,
  className,
}: {
  beschriftung?: string
  /** Solange ein Blatt der Leiste offen ist, liegt sie über dessen Schleier (Ebene 60), sonst auf 50. */
  ueberSchleier?: boolean
  /** Hofbereich (Entscheidung 6, Nr. 195): unter 360 px Breite 11 statt 12 px Schrift, damit „Bestellungen" nicht abgeschnitten wird. */
  engUnter360?: boolean
  /**
   * Farbe des aktiven Eintrags (Nr. 233, Boards s1-heute, s1-hoefe, s3-admin-shell):
   * eine getönte Pille hinter dem Symbol und die Schrift im selben Ton —
   * grün (Paar „läuft“) für Kundschaft und Admin, orange (Paar „tun“) für den Hofbereich.
   */
  ton?: 'gruen' | 'orange'
  children: ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <nav
      aria-label={beschriftung}
      data-slot="bottom-nav"
      // Feste Leiste unten: Der Cookie-Hinweis steht darüber, nie darauf (src/lib/cookie-hinweis.ts).
      data-unten-fest=""
      data-eng={engUnter360 ? '' : undefined}
      data-ton={ton}
      className={cn(
        'fixed inset-x-0 bottom-0 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden print:hidden',
        ueberSchleier ? 'z-[60]' : 'z-50',
        'group/leiste',
        className
      )}
    >
      {/* Ohne Seitenrand wie im Board: Fünf Spalten bei 390 px sind 78 px breit, „Bestellungen“ passt ganz hinein. */}
      <div className="flex h-[68px] items-stretch">{children}</div>
    </nav>
  )
}

/**
 * Gestalt eines Eintrags — aktiv heißt fett und in der Farbe der Leiste, sonst
 * die leise Farbe (halbfett wie im Board). Schrift 12 px (Nr. 177, vorher 10,5):
 * gelesen wird draußen, oft mit Handschuhen und in der Sonne. Die Leiste bleibt
 * 68 px hoch, nur die Schrift wächst. Nur im Hofbereich (`engUnter360` an der
 * Leiste) und nur unter 360 px Breite 11 px (Entscheidung 6, Nr. 195): fünf
 * Einträge ohne abgeschnittene Wörter.
 */
export function bottomNavEintragKlassen(aktiv: boolean): string {
  return cn(
    // min-w-max: Ein Eintrag wird nie schmaler als sein Wort — „Bestellungen“ nimmt sich die zwei Pixel, die ihm bei
    // fünf gleichen Spalten fehlen, von den kurzen Nachbarn, statt abgeschnitten zu werden (Abnahme Lauf 31, heute Bild 1).
    'relative flex min-w-max flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[12px] leading-none group-data-[eng]/leiste:max-[359px]:text-[11px] transition-colors duration-[250ms]',
    aktiv
      ? 'font-bold text-zustand-laeuft group-data-[ton=orange]/leiste:text-zustand-tun'
      : 'font-semibold text-muted-foreground hover:text-foreground',
    FOKUS_RAHMEN
  )
}

/**
 * Der Platz des Symbols in einem Eintrag (52 × 30 px wie im Board): aktiv eine
 * getönte Pille im Ton der Leiste (Nr. 233, Nacharbeit 220 „aktive Pille“).
 * Relativ, damit ein Zähler oben rechts daran hängen kann.
 */
export function bottomNavSymbolKlassen(aktiv: boolean): string {
  return cn(
    'relative grid h-[30px] w-[52px] shrink-0 place-items-center rounded-full transition-colors duration-[250ms]',
    aktiv && 'bg-zustand-laeuft-grund group-data-[ton=orange]/leiste:bg-zustand-tun-grund'
  )
}

/** Der Zähler am Symbol eines Eintrags — 12 px Ziffer (nie kleiner), oben rechts an der Pille. */
export const BOTTOM_NAV_ZAEHLER = 'absolute -top-1 right-0.5'

export function BottomNavLink({
  href,
  label,
  symbol: Symbol,
  aktuell,
  zahl,
  zahlWofuer = '',
  onNavigate,
  labelKurz,
}: {
  href: string
  label: string
  symbol: LucideIcon
  /** aria-current aus der Navigations-Quelle; hebt den Eintrag hervor. */
  aktuell?: 'page' | 'true'
  zahl?: number
  zahlWofuer?: string
  onNavigate?: () => void
  /**
   * Kürzere Beschriftung nur unter 360 px Breite (Nr. 205: „Bestellungen“ passte bei 320 px nicht in den Platz).
   * Sie muss im vollen Namen stecken. Kein aria-label: Die jeweils versteckte Fassung ist per display:none aus dem Baum, der Name entsteht aus dem sichtbaren Text plus Zählertext.
   */
  labelKurz?: string
}): React.JSX.Element {
  const aktiv = aktuell !== undefined
  return (
    <Link href={href} onClick={onNavigate} aria-current={aktuell} className={bottomNavEintragKlassen(aktiv)}>
      <span className={bottomNavSymbolKlassen(aktiv)}>
        <Symbol className="size-[22px]" strokeWidth={1.8} aria-hidden="true" />
        <Zaehler anzahl={zahl} wofuer={zahlWofuer} klein className={BOTTOM_NAV_ZAEHLER} />
      </span>
      {labelKurz ? (
        <>
          <span className="max-w-full truncate px-0.5 max-[359px]:hidden">{label}</span>
          <span className="hidden max-w-full truncate px-0.5 max-[359px]:inline">{labelKurz}</span>
        </>
      ) : (
        <span className="max-w-full truncate px-0.5">{label}</span>
      )}
    </Link>
  )
}

/**
 * Der Platz des Mittelknopfs — gleich breit wie ein Eintrag. Erhoben (Kunde)
 * ragt der Knopf nach oben heraus; `flach` (Hof, Nr. 233) füllt er die Spalte
 * wie ein Eintrag.
 */
export function BottomNavMitte({ children, flach = false }: { children: ReactNode; flach?: boolean }): React.JSX.Element {
  return <div className={cn('flex min-w-0 flex-1 justify-center', flach ? 'items-stretch' : 'items-start')}>{children}</div>
}

/**
 * Der erhobene, runde Mittelknopf: 54 px, 20 px über die Leiste gehoben, mit
 * einem Kragen in der Leistenfarbe. Grün = Kundenaktion, Orange = Hofaktion.
 * Ein Symbol allein braucht ein aria-label am Element.
 */
export function mittelknopfKlassen(ton: 'gruen' | 'orange'): string {
  return cn(
    'relative -mt-5 flex size-[54px] shrink-0 items-center justify-center rounded-full shadow-lg ring-4 ring-card transition-colors duration-[250ms]',
    ton === 'gruen' ? 'bg-accent text-accent-foreground hover:bg-accent-hover' : 'bg-primary text-primary-foreground hover:bg-primary/90',
    FOKUS_RAHMEN
  )
}

/**
 * Der Mittelknopf mit Wort (Hof: „Neu" unter dem Plus, freigabe.md §12
 * Nr. 45): Die Fläche ist der ganze Knopf — Kreis UND Wort —, also größer als
 * der Kreis allein, nie kleiner. Der Kreis bleibt 54 px und 20 px gehoben
 * (`mittelkreisKlassen` als Span im Knopf), das Wort steht auf der Höhe der
 * übrigen Beschriftungen der Leiste (Kreis 54 − 20 + 7 Abstand = 41 px, wie
 * die Wörter der Einträge). Den Fokusrahmen trägt der Knopf, nicht der Kreis.
 */
export function mittelknopfMitWortKlassen(): string {
  return cn(
    'group relative -mt-5 flex shrink-0 flex-col items-center gap-[7px] rounded-2xl text-[12px] leading-none group-data-[eng]/leiste:max-[359px]:text-[11px] text-muted-foreground transition-colors duration-[250ms] hover:text-foreground',
    FOKUS_RAHMEN
  )
}

/** Der Kreis im Mittelknopf mit Wort — Gestalt wie `mittelknopfKlassen`, Hover über den ganzen Knopf. */
export function mittelkreisKlassen(ton: 'gruen' | 'orange'): string {
  return cn(
    'flex size-[54px] shrink-0 items-center justify-center rounded-full shadow-lg ring-4 ring-card transition-colors duration-[250ms]',
    ton === 'gruen' ? 'bg-accent text-accent-foreground group-hover:bg-accent-hover' : 'bg-primary text-primary-foreground group-hover:bg-primary/90'
  )
}

/**
 * Der flache Mittelknopf mit Wort (Hof: „Neu“, Board s1-heute, Nacharbeit 220
 * „flaches Neu“): eine orange Fläche von 52 × 34 px in der Leiste, das Wort
 * fett darunter in der Textfarbe. Der Knopf füllt die ganze Spalte (68 px hoch,
 * ein Fünftel breit) — die Trefferfläche ist größer als die Fläche, nie kleiner.
 * Den Fokusrahmen trägt der Knopf, nicht die Fläche.
 */
export function mittelknopfFlachKlassen(): string {
  return cn(
    'group relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[12px] leading-none font-bold text-foreground group-data-[eng]/leiste:max-[359px]:text-[11px] transition-colors duration-[250ms]',
    FOKUS_RAHMEN
  )
}

/** Die Fläche im flachen Mittelknopf — Orange ist die Hofaktion (N42 a), Hover über den ganzen Knopf. */
export function mittelflaecheKlassen(ton: 'gruen' | 'orange'): string {
  return cn(
    'grid h-[34px] w-[52px] shrink-0 place-items-center rounded-[12px] transition-colors duration-[250ms]',
    ton === 'gruen' ? 'bg-accent text-accent-foreground group-hover:bg-accent-hover' : 'bg-primary text-primary-foreground group-hover:bg-primary/90'
  )
}
