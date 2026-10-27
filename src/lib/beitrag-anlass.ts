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
 * Die Wörter stehen nur hier (Nr. 134): Assistent „Neuer Beitrag“, Mail an
 * Abonnentinnen, Teilen-Bild und das Bild der Route /api/status-image lesen sie
 * von hier; tests/anlass-woerter-wache.test.ts hält das fest.
 */
import { CalendarDays, Leaf, MessageCircle, Tag, type LucideIcon } from 'lucide-react'

/**
 * Alle Anlässe in der Reihenfolge des Assistenten — für Zod (`z.enum(BEITRAG_ANLAESSE)`) und Auswahllisten.
 * Wie im Enum `StatusPostAnlass` ausgeschrieben, weil die Liste auch im Browser läuft (kein Import aus
 * `@prisma/client`); tests/status-posts.test.ts gleicht beide ab. Hier statt in src/schemas/status-post.ts,
 * damit die Startseite sie ohne Zod lädt (Nr. 196); das Schema nimmt dieselbe Liste.
 */
export const BEITRAG_ANLAESSE = ['FRESH_PRODUCT', 'NEW_SEASON', 'PROMOTION', 'ANNOUNCEMENT'] as const

export type BeitragAnlass = (typeof BEITRAG_ANLAESSE)[number]

/** Wort und Symbol je Anlass — so steht er an der Marke über dem Beitrag. */
export const BEITRAG_ANLASS: Record<BeitragAnlass, { wort: string; symbol: LucideIcon }> = {
  FRESH_PRODUCT: { wort: 'Frisches Produkt', symbol: Leaf },
  NEW_SEASON: { wort: 'Neue Saison', symbol: CalendarDays },
  PROMOTION: { wort: 'Aktion', symbol: Tag },
  ANNOUNCEMENT: { wort: 'Mitteilung', symbol: MessageCircle },
}
