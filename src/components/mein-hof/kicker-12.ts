import { KICKER } from '@/components/hof-bestellungen/stil'
import { cn } from '@/lib/utils'

/** Kicker der Hof-Werkzeug-Seiten: nie unter 12 px (Lauf 31). Die eine Quelle dafür, auch wenn `KICKER` später selbst größer wird. */
export const KICKER_12 = cn(KICKER, 'text-xs')
