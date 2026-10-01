import {
  Building2,
  Ellipsis,
  MessageCircle,
  Monitor,
  ShoppingBasket,
  Store,
  type LucideIcon,
} from 'lucide-react'
import type { Verkaufskanal } from '@/schemas/verkaufskanal'
import { cn } from '@/lib/utils'

/**
 * Das Symbol eines Verkaufswegs — EINE Zuordnung für den Dialog „Verkauf
 * eintragen" und die Listen der Verkäufe. Vorher zeigten die Listen Emojis
 * (CHANNEL_ICONS im Schema), der Dialog diese Symbole. PLATFORM vergibt nur
 * die Plattform selbst (verkaufskanal.ts), deshalb steht er nicht im Schema.
 */
export const KANAL_SYMBOL: Record<Verkaufskanal | 'PLATFORM', LucideIcon> = {
  HOFLADEN: Store,
  MARKT: ShoppingBasket,
  WHATSAPP: MessageCircle,
  BUSINESS: Building2,
  OTHER: Ellipsis,
  PLATFORM: Monitor,
}

function istBekannt(kanal: string): kanal is keyof typeof KANAL_SYMBOL {
  return Object.hasOwn(KANAL_SYMBOL, kanal)
}

/** Das Symbol zu einem gespeicherten Kanal; Unbekanntes zeigt die drei Punkte von „Sonstiges". */
export function KanalSymbol({ kanal, className }: { kanal: string; className?: string }): React.JSX.Element {
  const Symbol = istBekannt(kanal) ? KANAL_SYMBOL[kanal] : Ellipsis
  return <Symbol className={cn('size-4 shrink-0', className)} strokeWidth={1.7} aria-hidden="true" />
}
