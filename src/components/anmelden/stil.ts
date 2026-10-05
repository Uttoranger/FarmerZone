import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'

/*
 * Gemeinsame Klassen der Anmeldeseite (Nr. 08), abgenommen von
 * docs/mockups/web-k0-anmelden-kunde-code-hof-passwort.html und
 * mobil-k0-anmelden-mit-code.html. Nur Tokens — die Farben stimmen, weil die
 * Seite in der KundeShell (data-design="neu") steht.
 */

/** Beschriftung über einem Feld (12,5 px, leise). */
export const FELD_LABEL = 'text-[12.5px] font-semibold text-muted-foreground'

/** Eingabefeld: 46 px hoch, Radius 11 px, Grund etwas tiefer als die Karte. */
export const FELD = cn(
  'h-[46px] w-full min-w-0 rounded-[11px] border border-border bg-background px-3.5 text-base text-foreground placeholder:text-muted-foreground aria-[invalid=true]:border-destructive md:text-[14.5px]',
  FOKUS_RAHMEN
)

const KNOPF =
  'inline-flex h-12 w-full items-center justify-center gap-2 rounded-full px-[18px] text-sm font-semibold transition-opacity duration-[250ms] hover:opacity-90 disabled:opacity-60 lg:h-12'

/** Kundenaktion: grün (DESIGN_SYSTEM, „Farbrollen"). */
export const KNOPF_GRUEN = cn(KNOPF, 'h-[50px] bg-accent text-accent-foreground', FOKUS_RAHMEN)

/** Hof-Aktion: orange, mit feinem dunklem Rand wie im Mockup. */
export const KNOPF_ORANGE = cn(KNOPF, 'border border-primary-foreground/30 bg-primary text-primary-foreground', FOKUS_RAHMEN)

/** Textknopf bzw. -link in grüner Schrift; Trefferfläche 44 px. */
export const TEXTKNOPF = cn(
  'inline-flex min-h-11 items-center rounded-full px-2 text-sm font-semibold text-status-fertig hover:underline hover:underline-offset-2 disabled:text-muted-foreground disabled:no-underline',
  FOKUS_RAHMEN
)

/** Fehler inline am Feld (DESIGN_SYSTEM, „Zustände"). */
export const FEHLER_TEXT = 'text-[13.5px] leading-normal text-destructive'

/** Leiser Hinweis, nie dunkler als --fz-text-muted. */
export const HINWEIS_TEXT = 'text-[13.5px] leading-normal text-muted-foreground'
