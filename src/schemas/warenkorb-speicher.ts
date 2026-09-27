import { z } from 'zod'

/**
 * Der Warenkorb im localStorage des Browsers. Er ist Fremddaten
 * (CODING_STANDARDS §3): Jeder kann ihn im Browser ändern, und alte Stände
 * liegen noch auf den Geräten. Gelesen wird er deshalb nur über
 * leseWarenkorb (src/lib/warenkorb-speicher.ts), nie mit einem nackten
 * JSON.parse. Wahrheit über Preis und Bestand ist er nie — das prüft der
 * Server beim Reservieren und im Checkout.
 */
export const warenkorbPositionSchema = z.object({
  productId: z.string().min(1),
  name: z.string(),
  price: z.number().nonnegative(),
  unit: z.string(),
  unitSize: z.number().nullable(),
  quantity: z.number().int().positive(),
  imageUrl: z.string().nullable(),
})

export type WarenkorbPosition = z.infer<typeof warenkorbPositionSchema>

/**
 * Die Hülle. Die Positionen prüft leseWarenkorb einzeln: Eine kaputte
 * Position kostet nur sich selbst, nicht den ganzen Korb.
 *
 * `farmSlug` gibt es seit der Kopfzeile der Kundenseiten (2026-09-27): Mit ihm
 * führt das Warenkorb-Symbol auf jeder Seite zum richtigen Hof. Ältere
 * Einträge haben ihn nicht und bleiben trotzdem lesbar — nur ein Symbol
 * zeigen sie erst, wenn der Korb das nächste Mal geschrieben wird.
 */
export const warenkorbSpeicherSchema = z.object({
  farmId: z.string().min(1),
  farmSlug: z
    .string()
    .max(100)
    .regex(/^[a-z0-9-]+$/)
    .optional()
    .catch(undefined),
  items: z.array(z.unknown()),
})
