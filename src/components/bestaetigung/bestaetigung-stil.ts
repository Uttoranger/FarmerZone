import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'

/*
 * Die Klassen der Seiten nach dem Kauf (Bestätigung, Bestellseite, Bar-Bestätigen, Meine Bestellungen;
 * Boards s1-/w1-bestaetigung, s1-/w1-bestellung-link, Nr. 227) — eine eigene Datei ohne Abhängigkeiten,
 * damit auch die Client-Teile (Teilen, Neuigkeiten, Bar-Link) sie nehmen, ohne die Geld-Helfer der
 * Positionen in den Browser zu ziehen.
 */

/** Karte: Radius 16 px, Fläche --surface mit Rahmen --border. */
export const KARTE = 'rounded-2xl border border-border bg-card px-4 py-4 md:px-[18px]'

/** Kleine Überschrift in Großbuchstaben („ABHOLUNG“, „HOF ERREICHEN“, „DEINE BESTELLUNG“). */
export const ETIKETT = 'text-[12px] font-bold tracking-[1px] text-muted-foreground uppercase'

/** Ein Knopf über die volle Breite (Radius 14 px, 52 px; DESIGN_SYSTEM „Typografie und Form“). */
export const KNOPF_BREIT = cn(
  'inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] px-[18px] text-base font-bold transition-colors duration-[250ms]',
  FOKUS_RAHMEN
)

/** Die eine Hauptaktion — Kundschaft grün (DESIGN_SYSTEM „Farbrollen“). */
export const KNOPF_BREIT_GRUEN = cn(KNOPF_BREIT, 'bg-accent text-accent-foreground hover:opacity-90')

/** Alles neben der Hauptaktion: Rand in der Textfarbe auf der Fläche. */
export const KNOPF_BREIT_RAHMEN = cn(KNOPF_BREIT, 'border-[1.5px] border-foreground bg-card text-foreground hover:bg-muted')
