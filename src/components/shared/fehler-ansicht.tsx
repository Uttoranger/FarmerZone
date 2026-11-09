'use client'

import { useSyncExternalStore } from 'react'
import { Compass, TriangleAlert } from 'lucide-react'
import {
  FEHLER_KNOPF_TON,
  FEHLER_KREIS_TON,
  FEHLER_TEXT,
  FEHLER_TITEL,
  NOCHMAL_VERSUCHEN,
  PROBLEM_MELDEN,
  ZUR_STARTSEITE,
  fehlerKicker,
  meldungLinkMitKennung,
  type FehlerWelt,
  type FehlerZeichen,
} from '@/lib/fehlerseite'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { MARKE } from '@/lib/marke'
import { TITEL_VORSATZ_ATTRIBUT, vorsatzAusAttribut } from '@/lib/titel-vorsatz'
import { cn } from '@/lib/utils'

/*
 * Der gemeinsame Aufbau aller Fehlerseiten (Lauf 30, Nr. 231; Boards
 * s3/w3-fehlerseiten): Kreis mit Zeichen, Kicker, h1, Satz, darunter die Wege
 * übereinander — ein Hauptknopf und ein Umriss, gleich breit (höchstens
 * 340 px), 48 px hoch, Ecken 12 px (Knöpfe über die volle Breite, DESIGN_SYSTEM
 * „Typografie und Form“). Was je Fall verschieden ist, kommt aus
 * src/lib/fehlerseite.ts. Die 404 (NichtGefundenAnsicht) und die 500
 * (FehlerAnsicht) zeichnen beide hierüber.
 */

const KREIS: Record<'gruen' | 'orange', string> = {
  gruen: 'bg-zustand-laeuft-grund text-status-fertig',
  orange: 'bg-zustand-tun-grund text-status-offen',
}

// 52 px, Ecken 14 px, 16 px fett wie die Knöpfe des Boards s3-/w3-fehlerseiten (Nr. 254).
const WEG = cn('inline-flex min-h-[52px] w-full items-center justify-center rounded-[14px] px-5 text-[16px] font-bold transition-opacity duration-[250ms]', FOKUS_RAHMEN)

/** Der Hauptknopf je Ton — grün in der Kundenwelt, orange im Hofbereich. */
export const FEHLER_HAUPT: Record<'gruen' | 'orange', string> = {
  gruen: cn(WEG, 'bg-accent text-accent-foreground hover:opacity-90'),
  orange: cn(WEG, 'bg-primary text-primary-foreground hover:opacity-90'),
}

/** Der zweite Weg als Umriss auf der Fläche. */
// Rand in Textfarbe, leicht zurückgenommen (Liste Lauf 32, fehlerseiten „Zweitknopf mit schwachem Rand“): Der zweite
// Weg ist ein Knopf, kein Kasten — mit `border-border` las er sich als Fläche.
export const FEHLER_UMRISS = cn(WEG, 'border-[1.5px] border-foreground/60 bg-card text-foreground hover:bg-muted')

export function FehlerseiteAufbau({
  zeichen,
  kicker,
  titel,
  text,
  children,
}: {
  zeichen: FehlerZeichen
  kicker: string
  titel: string
  text: string
  /** Die Wege zurück, in ihrer Reihenfolge. */
  children: React.ReactNode
}): React.JSX.Element {
  const Zeichen = zeichen === 'weg' ? Compass : TriangleAlert
  return (
    // 544 px wie die Spalte des Boards (560 px mit Rand): Die längste Überschrift („Dieses Produkt gibt es hier
    // nicht (mehr)“) steht im Web auf einer Zeile, am Handy bricht sie ausgewogen (Liste Lauf 32, fehlerseiten).
    <div className="flex w-full max-w-[544px] flex-col items-center gap-2.5 text-center">
      <span className={cn('flex size-[72px] items-center justify-center rounded-full', KREIS[FEHLER_KREIS_TON[zeichen]])} aria-hidden="true">
        <Zeichen className="size-8" strokeWidth={1.5} aria-hidden="true" />
      </span>
      {/* Bei der 500 trägt der Kicker die Fehlernummer — zum Vorlesen und
          Abtippen da, nicht zum Verstehen. Kein Fehlertext, kein Stapel, kein
          Dateiname: Das wäre für den Menschen ohne Wert und für uns eine
          offene Flanke. */}
      <p className="text-[12.5px] font-bold tracking-[1.6px] text-muted-foreground uppercase">{kicker}</p>
      {/* Ohne `text-balance`: Das Board bricht gierig („Diesen Hof gibt es hier / nicht (mehr)“), ausgewogen stand am
          Handy „… gibt es / hier nicht (mehr)“ (Abnahme Lauf 32, fehlerseiten Bild 1–3, Nr. 279). */}
      <h1 className="font-heading text-[26px] leading-[1.2] font-semibold break-words text-foreground">{titel}</h1>
      <p className="max-w-[440px] text-[15px] leading-normal text-muted-foreground">{text}</p>
      <div className="flex w-full max-w-[340px] flex-col gap-2">{children}</div>
    </div>
  )
}

/**
 * Der Seitentitel der 500 (Nr. 266, axe „document-title“): Die Fehlergrenzen sind Client-Komponenten ohne `metadata`,
 * deshalb trägt die Ansicht ihn selbst — React 19 hebt ein `<title>` aus dem Baum in den Kopf des Dokuments.
 */
export const FEHLER_SEITENTITEL = `Fehler — ${MARKE}`

/** Der Attributwert ändert sich nach dem Laden nie — nichts zu abonnieren. */
const nieAendern = (): (() => void) => () => {}

/**
 * Der Testvorsatz (TEST_VORSATZ) für den Titel der 500 (Antwort der Projektleitung, 9.11.2026, Punkt 4; Nr. 279): Das
 * Wurzel-Layout legt ihn an <html> ab (src/lib/titel-vorsatz.ts, eine Quelle mit der Titel-Vorlage aller Seiten).
 * `useSyncExternalStore` mit leerem Server-Wert, damit Server-HTML und erstes Bild im Browser gleich sind; danach
 * steht der Vorsatz. global-error hat kein Wurzel-Layout und damit keinen Vorsatz.
 */
function useTitelVorsatz(): string {
  return useSyncExternalStore(
    nieAendern,
    () => vorsatzAusAttribut(document.documentElement.getAttribute(TITEL_VORSATZ_ATTRIBUT)),
    () => ''
  )
}

/**
 * Die 500 — einmal gebaut, von allen Fehlergrenzen benutzt.
 *
 * `src/app/error.tsx` fängt einen Fehler innerhalb des Root-Layouts,
 * `src/app/global-error.tsx` einen im Root-Layout selbst,
 * `src/app/(hof)/error.tsx` einen im Hofbereich unter dessen Layout. Mehrere
 * Dateien mit demselben Aufbau laufen auseinander, sobald jemand einen Satz
 * ändert; deshalb steht er hier einmal.
 *
 * ZWEI BEWUSSTE ENTSCHEIDUNGEN:
 *
 * 1. Keine Kundenkopfzeile. Diese Ansicht erscheint, WEIL etwas gescheitert
 *    ist — war die Kopfzeile selbst die Ursache, risse sie die Fehlerseite mit
 *    und der Mensch sähe gar nichts mehr. Der Weg nach Hause steht als Knopf.
 *    (Das Board w3-fehlerseiten zeigt die 500 der Kundschaft in der Shell;
 *    die Entscheidung bleibt, Bericht 231.)
 * 2. Gewöhnliche `<a>` statt `<Link>`. Ein Vollaufbau ist hier das Richtige:
 *    Er lässt den zerbrochenen Baum zurück, statt ihn mitzunehmen — und in
 *    global-error gibt es den Router-Kontext ohnehin nicht verlässlich.
 */
export function FehlerAnsicht({
  fehlernummer,
  nochmal,
  ziel = { href: '/', text: ZUR_STARTSEITE },
  text = FEHLER_TEXT,
  meldenPfad = '/problem-melden',
  imLayout = false,
  welt = 'kunde',
}: {
  /** `error.digest` — die einzige technische Angabe, die der Mensch sieht. */
  fehlernummer?: string
  /** Nextens `reset()`: baut die Grenze neu auf, ohne die Seite neu zu laden. */
  nochmal: () => void
  /** Der Weg zurück — ohne Angabe die Startseite. */
  ziel?: { href: string; text: string }
  /** Der Satz unter der Überschrift (aus src/lib/fehlerseite.ts). */
  text?: string
  /** Wohin „Problem melden" führt — im Hofbereich dessen eigener Briefkasten. */
  meldenPfad?: '/problem-melden' | '/fehler-melden'
  /** Unter einem Layout mit Unterleiste: nicht die volle Bildschirmhöhe. */
  imLayout?: boolean
  /** Die Welt: im Hofbereich ist der Hauptknopf orange (V51). */
  welt?: FehlerWelt
}) {
  const vorsatz = useTitelVorsatz()
  return (
    <div
      data-design="neu"
      className={cn(
        'flex justify-center bg-background text-foreground',
        // In der Shell oben wie das Board (s3-/w3-fehlerseiten Bild 4/5: 36 bzw. 40 px unter dem Kopf), nicht mitten in
        // 70 % der Fensterhöhe — sonst stand der Block im Web rund 70 px zu tief und am Handy weit über dem Fuß
        // (Abnahme Lauf 32, fehlerseiten „Lage und Größen“, Nr. 279). Ohne Shell (global-error) bleibt er mittig.
        imLayout ? 'w-full px-[22px] pt-9 pb-12 md:pt-10' : 'min-h-dvh items-center px-6 py-16',
        // Im Hofbereich in der Inhaltsspalte (Board w3-fehlerseiten Bild 5: 760 px plus 40 px Rand), nicht mittig in
        // der ganzen Fläche neben der Seitenleiste.
        imLayout && welt === 'hof' && 'md:max-w-[840px] md:px-10'
      )}
    >
      <title>{`${vorsatz}${FEHLER_SEITENTITEL}`}</title>
      <FehlerseiteAufbau zeichen="warnung" kicker={fehlerKicker(fehlernummer)} titel={FEHLER_TITEL} text={text}>
        <button type="button" onClick={nochmal} className={FEHLER_HAUPT[FEHLER_KNOPF_TON[welt]]}>
          {NOCHMAL_VERSUCHEN}
        </button>
        {/* Absichtlich ein <a>, kein <Link>: Hier ist der
            Vollaufbau das Ziel, nicht der Umweg: <Link> navigiert im selben,
            gerade zerbrochenen Baum weiter, und in global-error gibt es den
            Router-Kontext ohnehin nicht verlässlich. */}
        <a href={ziel.href} className={FEHLER_UMRISS}>
          {ziel.text}
        </a>
        <a
          href={meldungLinkMitKennung(fehlernummer, meldenPfad)}
          // 16 px wie die Knöpfe darüber, unterstrichen (Board s3-/w3-fehlerseiten; Abnahme Lauf 32: „Problem melden“ kleiner als im Board).
          className={cn('inline-flex min-h-11 w-full items-center justify-center rounded-sm px-4 text-[16px] font-semibold text-foreground underline underline-offset-4 hover:opacity-80', FOKUS_RAHMEN)}
        >
          {PROBLEM_MELDEN}
        </a>
      </FehlerseiteAufbau>
    </div>
  )
}
