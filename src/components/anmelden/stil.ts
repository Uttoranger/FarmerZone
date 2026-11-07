import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { FELD_FEHLER_RAHMEN } from '@/components/ui/feld-fehler'

/*
 * Gemeinsame Klassen der Anmeldeseite (Nr. 08), seit Nr. 239 (Lauf 31) nach
 * den Boards s2-/w2-anmelden, -kundenkonto und -passwort: Beschriftung in
 * Textfarbe über dem Feld, Feld auf der Fläche mit dem Feldrand, Knöpfe über
 * die volle Breite als Rechteck mit 14 px Rundung (DESIGN_SYSTEM „Typografie
 * und Form“: Pillen nur in Inhaltsbreite). Nur Tokens — die Farben stimmen,
 * weil die Seiten in der KundeShell (data-design="neu") stehen.
 */

/** Beschriftung über einem Feld: 14 px halbfett in Textfarbe (Boards: „E-Mail“, „Passwort“). */
export const FELD_LABEL = 'text-[14px] font-semibold text-foreground'

/**
 * Eingabefeld: 48 px hoch, Radius 12 px, auf der Fläche mit dem Feldrand (≥ 3:1, Nr. 173).
 * Ein Fehler zeichnet den orangen Rand von 2 px (V17, FELD_FEHLER_RAHMEN) — nie Rot.
 */
export const FELD = cn(
  'h-12 w-full min-w-0 rounded-[12px] border border-input bg-card px-3.5 text-base text-foreground placeholder:text-muted-foreground md:text-[15px]',
  FELD_FEHLER_RAHMEN,
  FOKUS_RAHMEN
)

// 52 px hoch, 16 px fett wie in den Boards (Liste Lauf 32, anmelden „Passkey-Knopf … Schrift nach Board“).
const KNOPF =
  'inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[14px] px-[18px] text-[16px] font-bold transition-opacity duration-[250ms] hover:opacity-90 disabled:opacity-60'

/** Kundenaktion: grün (DESIGN_SYSTEM, „Farbrollen"). */
export const KNOPF_GRUEN = cn(KNOPF, 'bg-accent text-accent-foreground', FOKUS_RAHMEN)

/** Hof-Aktion: orange, ohne Rand (Board s2-passwort). */
export const KNOPF_ORANGE = cn(KNOPF, 'bg-primary text-primary-foreground', FOKUS_RAHMEN)

/** Zweiter Weg über die volle Breite: Umriss in Textfarbe auf der Fläche (Board s2-anmelden „Mit Passkey anmelden“). */
export const KNOPF_UMRISS = cn(
  KNOPF,
  'border-[1.5px] border-foreground bg-card text-foreground hover:bg-muted hover:opacity-100',
  FOKUS_RAHMEN
)

/** Textknopf in grüner Schrift; Trefferfläche 44 px. */
export const TEXTKNOPF = cn(
  'inline-flex min-h-11 items-center rounded-full px-2 text-sm font-semibold text-status-fertig hover:underline hover:underline-offset-2 disabled:text-muted-foreground disabled:no-underline',
  FOKUS_RAHMEN
)

/** Link als eigene Zeile, unterstrichen und grün (Boards: „Passwort vergessen?“, „Noch kein Hof? Registrieren“); 44 px hoch. */
export const TEXTLINK = cn(
  'inline-flex min-h-11 items-center self-start rounded-sm text-[14px] font-semibold text-status-fertig underline underline-offset-2',
  FOKUS_RAHMEN
)

/** Fehler inline am Feld: orange und halbfett (V17; Board s2-passwort, Bild 4). */
export const FEHLER_TEXT = 'text-[14px] leading-snug font-semibold text-status-offen'

/** Leiser Hinweis, nie dunkler als --fz-text-muted. */
export const HINWEIS_TEXT = 'text-[14px] leading-normal text-muted-foreground'
