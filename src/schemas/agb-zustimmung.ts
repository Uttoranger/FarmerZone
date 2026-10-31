import { z } from 'zod'

/*
 * „Ich stimme den AGB zu“ (Nr. 207): Der Browser schickt die Fassung, die der
 * Hof gesehen hat. Die Action speichert nur, wenn sie der aktuellen gleicht —
 * so stimmt niemand einer Fassung zu, die er nie gelesen hat.
 */
export const agbZustimmungSchema = z.object({
  fassung: z.string().trim().min(1).max(20),
})
