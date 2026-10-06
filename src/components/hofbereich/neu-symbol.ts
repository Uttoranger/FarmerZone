import { Axe, Banknote, Carrot, Megaphone, Wheat, type LucideIcon } from 'lucide-react'
import type { HofNeuId } from '@/lib/bauern-navigation'

/**
 * Das Symbol je Eintrag des Neu-Menüs — EINE Zuordnung für die HofShell
 * (Aufklappmenü, Blatt) und den Dialog „Was legst du an?" auf /products
 * (components/produkte/was-legst-du-an.tsx, Nachtlauf Nr. 18).
 */
export const NEU_SYMBOL: Record<HofNeuId, LucideIcon> = {
  lebensmittel: Carrot,
  futtermittel: Wheat,
  brennmaterial: Axe,
  'status-posten': Megaphone,
  'verkauf-eintragen': Banknote,
}
