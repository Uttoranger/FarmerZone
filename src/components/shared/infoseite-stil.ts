import { cn } from '@/lib/utils'
import { FOKUS_RAHMEN } from '@/components/ui/fokus'

/*
 * Gemeinsame Formen der Infoseiten in der KundeShell (seit Nr. 54):
 * Konditionen und Impressum; Problem melden nimmt die Spalte und den Titel.
 * Kein Mockup — gebaut nach docs/ai/DESIGN_SYSTEM.md (Fraunces für
 * Überschriften, Karten auf --surface mit Rand, Links grün). Nur shadcn-Namen:
 * Die Farben stimmen, weil die Seiten im Geltungsbereich data-design="neu"
 * stehen. Eine Ladeansicht haben sie seit Nr. 117 nicht mehr: Sie sind
 * statisch, und `(public)/loading.tsx` stünde vor der 404 der Hofseite.
 */

/**
 * Die Spalte: Text höchstens 672 px, am Handy 16 px Rand. Seit Nr. 254 (Liste Lauf 32, rechtstexte Z. 850)
 * links in der 1000-px-Spalte der Shell, an der Kante des Seitenfußes, statt mittig: Der rechte Rand
 * füllt auf, was über 672 px hinausgeht (gleiche Form wie die Vorlage der Rechtsseiten).
 */
export const INFOSEITE_SPALTE = 'mx-auto w-full max-w-[1032px] pt-8 pb-12 pl-4 pr-[max(1rem,calc(min(100%,1032px)_-_688px))] md:pt-10'

/** Kleine Überschrift über dem Titel („Was es kostet"). */
export const INFOSEITE_KICKER = 'mb-2 text-[12px] font-semibold tracking-[0.14em] text-muted-foreground uppercase'

/** Der Titel der Seite (h1): 28 px in beiden Breiten (Board s3-/w3-rechtstexte, Z. 855). */
export const INFOSEITE_TITEL = 'font-heading text-[28px] leading-[1.2] font-semibold text-balance text-foreground'

/** Überschrift eines Abschnitts (h2). */
export const INFOSEITE_ABSCHNITT = 'mb-3 font-heading text-[18px] font-semibold text-foreground'

/** Fließtext der Abschnitte — leise, gut lesbar. */
export const INFOSEITE_TEXT = 'flex flex-col gap-8 text-[14.5px] leading-relaxed text-muted-foreground'

/** Ein Link im Fließtext: grün (DESIGN_SYSTEM „Einstellungen": Links im Fließtext grün, nie orange). */
export const INFOSEITE_LINK = cn('rounded-sm font-medium break-words text-brand-text underline underline-offset-4 hover:opacity-80', FOKUS_RAHMEN)

/** Fußzeile „Stand: …" unter einer Linie. */
export const INFOSEITE_STAND = 'border-t border-border pt-4 text-[12.5px] text-muted-foreground'
