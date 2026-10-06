import { z } from 'zod'
import { VORRAT_MAX } from '@/lib/eingabegrenzen'

/** Die Grenze der Int-Spalte `Product.stock` — mehr kann ein gelesener Vorrat nicht sein. */
const SPALTE_MAX = 2_147_483_647

/**
 * Vorrat direkt ändern (Produkttabelle, Nachtlauf Nr. 18): Der Browser schickt
 * den Vorrat, den er gesehen hat (`vorher`), und den neuen (`neu`). Die Aktion
 * setzt nur, wenn die Datenbank noch `vorher` hält (setzeVorrat in
 * src/server/actions/products.ts) — sonst hätte eine Bestellung dazwischen
 * gebucht, und das Setzen würde sie überschreiben.
 *
 * Strikt: Ein unbekanntes Feld (etwa eine `farmId`) ist ungültig, der Hof
 * kommt immer aus der Sitzung. Eine nachträgliche Obergrenze sperrt keinen
 * Bestand (CODING_STANDARDS §8): Über VORRAT_MAX darf ein Altwert sinken.
 */
export const vorratSetzenSchema = z
  .object({
    productId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
    vorher: z.number().int().min(0).max(SPALTE_MAX),
    neu: z
      .number()
      .int('Bitte eine ganze Zahl eintippen.')
      .min(0, 'Der Vorrat kann nicht unter 0 liegen.')
      .max(SPALTE_MAX),
  })
  .strict()
  .refine((v) => v.neu <= VORRAT_MAX || v.neu <= v.vorher, {
    message: `Höchstens ${VORRAT_MAX.toLocaleString('de-AT')} – bitte prüf die Zahl.`,
    path: ['neu'],
  })

export type VorratSetzen = z.infer<typeof vorratSetzenSchema>

/** Der erwartete Vorrat beim Speichern des Bearbeiten-Dialogs (updateProduct). */
export const bestandVorherSchema = z.number().int().min(0).max(SPALTE_MAX)
