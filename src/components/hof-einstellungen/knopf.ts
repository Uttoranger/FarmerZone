import { FOKUS_RAHMEN } from '@/components/ui/fokus'
import { cn } from '@/lib/utils'

/**
 * Der helle Knopf der Einstellungen über die volle Spalte (Boards s1-einstellungen „Problem melden“,
 * s2-konto-hof „Passwort ändern“, „Support schreiben“, „Zu den Bestellungen“): Umriss in Textfarbe auf der
 * Kartenfläche, 52 px, 14 px rund — volle Breite, deshalb keine Pille. Nie deaktiviert (G6).
 */
export const HELLER_KNOPF = cn(
  'flex min-h-[52px] w-full items-center justify-center rounded-[14px] border-[1.5px] border-foreground bg-card px-4 text-center text-[16px] font-bold text-foreground transition-colors duration-[250ms] hover:bg-muted aria-busy:opacity-60',
  FOKUS_RAHMEN
)
