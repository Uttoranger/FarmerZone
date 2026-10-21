/**
 * Der Anlass eines Beitrags (Register F8, Nr. 128): Wort und Symbol an EINER
 * Stelle — „Aktuell vom Hof“ auf der Hofseite liest sie von hier.
 *
 * Die Liste der Werte steht als Zod-Quelle in src/schemas/status-post.ts
 * (Schemas laufen auch im Browser und dürfen `@prisma/client` nicht
 * einbinden; tests/status-posts.test.ts gleicht sie mit dem Enum ab). Hier
 * steht sie nur unter dem Namen, unter dem Fachregeln und Adressen (etwa
 * `?anlass=` für „Neuer Beitrag“) sie nehmen — keine zweite Liste.
 *
 * Weitere Kopien der Wörter (Assistent „Neuer Beitrag“, Mail an
 * Abonnentinnen, Teilen-Bild) stehen noch an ihren Stellen und ziehen in
 * einem späteren Lauf hierher (Bericht 128, Nacharbeit).
 */
import { CalendarDays, Leaf, MessageCircle, Tag, type LucideIcon } from 'lucide-react'
import { STATUS_POST_ANLASS_VALUES } from '@/schemas/status-post'

/** Alle Anlässe in der Reihenfolge des Assistenten — für Zod (`z.enum(BEITRAG_ANLAESSE)`) und Auswahllisten. */
export const BEITRAG_ANLAESSE = STATUS_POST_ANLASS_VALUES

export type BeitragAnlass = (typeof BEITRAG_ANLAESSE)[number]

/** Wort und Symbol je Anlass — so steht er an der Marke über dem Beitrag. */
export const BEITRAG_ANLASS: Record<BeitragAnlass, { wort: string; symbol: LucideIcon }> = {
  FRESH_PRODUCT: { wort: 'Frisches Produkt', symbol: Leaf },
  NEW_SEASON: { wort: 'Neue Saison', symbol: CalendarDays },
  PROMOTION: { wort: 'Aktion', symbol: Tag },
  ANNOUNCEMENT: { wort: 'Mitteilung', symbol: MessageCircle },
}
