import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { RUNDUNG } from '@/components/ui/rundung'
import { cn } from '@/lib/utils'

/*
 * Gemeinsame Formen der Bestellungen im neuen Design (Nachtlauf Nr. 19).
 * Nur shadcn-Namen im Geltungsbereich data-design="neu" (DESIGN_SYSTEM.md),
 * Trefferflächen ≥ 44 px, Pillen für Knöpfe in Inhaltsbreite.
 */

export const KARTE = 'rounded-[12px] border border-border bg-card'
export const LEISE = 'text-muted-foreground'

const PILLE =
  'inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full px-[18px] text-sm font-semibold transition-colors duration-[250ms] disabled:cursor-not-allowed disabled:opacity-60'

/** Grün = erledigt/gepackt und Kundenaktion (Farbrollen) — die eine Hauptaktion je Ansicht. */
export const KNOPF_GRUEN = cn(PILLE, 'bg-accent text-accent-foreground hover:bg-accent/90', FOKUS_RAHMEN)
/** Orange gefüllt = Hof-Aktion (erstellen, eintragen; Farbrollen) — höchstens einmal je Ansicht (Nr. 22b). */
export const KNOPF_ORANGE = cn(PILLE, 'border border-primary-foreground/25 bg-primary text-primary-foreground hover:bg-primary/90', FOKUS_RAHMEN)
/**
 * Umriss für Nebenaktionen — nach Board (Nr. 269, Abnahme Lauf 32 heute „Teilen“, produkte, whatsapp-plakat,
 * hofdaten-zahlung, beitraege: „niedrig, dünn, blass“): 52 px hoch, 15 px fett, Rand 1,5 px in Textfarbe wie
 * „So geht’s“ auf Heute (Board s1-/w1-heute). Gilt überall, wo die Konstante steht, auch im Admin.
 */
export const KNOPF_RAHMEN = cn(PILLE, 'min-h-[52px] border-[1.5px] border-foreground text-[15px] font-bold text-foreground hover:bg-muted', FOKUS_RAHMEN)
/** Zerstörend: Orange-Umriss, nie Grün (DESIGN_SYSTEM „Dialoge und Blätter"). */
export const KNOPF_ORANGE_RAHMEN = cn(PILLE, 'border border-primary/70 bg-primary/18 text-foreground hover:bg-primary/25', FOKUS_RAHMEN)
/** Textknöpfe ohne Fläche: „Nicht abgeholt" (grüne Schrift), „Stornieren" (orange Schrift). */
export const TEXT_GRUEN = cn(PILLE, 'px-3 text-status-fertig hover:bg-muted', FOKUS_RAHMEN)
export const TEXT_ORANGE = cn(PILLE, 'px-3 text-status-offen hover:bg-muted', FOKUS_RAHMEN)

/**
 * Beschriftung eines Felds nach Board (Nr. 269; Boards s2-/w2-hofdaten-zahlung, -beitraege: 15 px halbfett in
 * Textfarbe, 6 px über dem Feld) — vorher 12,5 px leise.
 */
export const FELD_LABEL = 'mb-1.5 block text-[15px] font-semibold text-foreground'
/**
 * Eingabefeld nach Board (Nr. 269): 48 px, Rand im Feldrand-Token (`border-input`, ≥ 3:1, Nr. 173) statt des
 * Kartenrands, Fläche der Karte, Rundung `RUNDUNG.feld` (10 px, G8), Schrift 16 px auch im Web.
 */
export const FELD = cn(
  'min-h-12 w-full min-w-0 border border-input bg-card px-3.5 py-2.5 text-base text-foreground placeholder:text-muted-foreground aria-[invalid=true]:border-status-offen',
  RUNDUNG.feld,
  FOKUS_RAHMEN
)

/**
 * Kleine Überschrift in Großbuchstaben („Kundin", „Heute, 15–18 Uhr · 3"): 13 px fett wie die
 * Köpfe von Heute (Boards s1-/w1-bestellungen, Lauf 31) — Schrift nie unter 12 px (Nr. 237).
 */
export const KICKER = 'text-[13px] font-bold tracking-[0.04em] text-muted-foreground uppercase'
