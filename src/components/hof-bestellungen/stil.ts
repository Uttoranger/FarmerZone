import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { cn } from '@/lib/utils'

/*
 * Gemeinsame Formen der Bestellungen im neuen Design (Nachtlauf Nr. 19).
 * Nur shadcn-Namen im Geltungsbereich data-design="neu" (DESIGN_SYSTEM.md),
 * Trefferflächen ≥ 44 px, Pillen für Knöpfe in Inhaltsbreite.
 */

export const KARTE = 'rounded-2xl border border-border bg-card'
export const LEISE = 'text-muted-foreground'

const PILLE =
  'inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full px-[18px] text-sm font-semibold transition-colors duration-[250ms] disabled:cursor-not-allowed disabled:opacity-60'

/** Grün = erledigt/gepackt und Kundenaktion (Farbrollen) — die eine Hauptaktion je Ansicht. */
export const KNOPF_GRUEN = cn(PILLE, 'bg-accent text-accent-foreground hover:bg-accent/90', FOKUS_RAHMEN)
/** Umriss für Nebenaktionen. */
export const KNOPF_RAHMEN = cn(PILLE, 'border border-border font-medium text-foreground hover:bg-muted', FOKUS_RAHMEN)
/** Zerstörend: Orange-Umriss, nie Grün (DESIGN_SYSTEM „Dialoge und Blätter"). */
export const KNOPF_ORANGE_RAHMEN = cn(PILLE, 'border border-primary/70 bg-primary/18 text-foreground hover:bg-primary/25', FOKUS_RAHMEN)
/** Textknöpfe ohne Fläche: „Nicht abgeholt" (grüne Schrift), „Stornieren" (orange Schrift). */
export const TEXT_GRUEN = cn(PILLE, 'px-3 text-status-fertig hover:bg-muted', FOKUS_RAHMEN)
export const TEXT_ORANGE = cn(PILLE, 'px-3 text-status-offen hover:bg-muted', FOKUS_RAHMEN)

export const FELD_LABEL = 'mb-1 block text-[12.5px] font-semibold text-muted-foreground'
export const FELD = cn(
  'w-full min-w-0 rounded-[11px] border border-border bg-background px-3.5 py-2.5 text-base text-foreground placeholder:text-muted-foreground aria-[invalid=true]:border-status-offen md:text-[14.5px]',
  FOKUS_RAHMEN
)

/** Kleine Überschrift in Großbuchstaben („Packliste", „Heute, 15–18 Uhr · 3 Bestellungen"). */
export const KICKER = 'text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase'
