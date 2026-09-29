import { z } from 'zod'

/**
 * Die Kanäle, die ein Hof beim manuellen Verkauf wählen kann — PLATFORM
 * vergibt nur die Plattform selbst. Dasselbe Schema prüft die Server Action
 * und den gemerkten Kanal im localStorage (src/lib/verkaufskanal-speicher.ts):
 * Der ist Fremddaten (CODING_STANDARDS §3), ein alter oder kaputter Stand
 * fällt still auf den Standard zurück.
 */
export const verkaufskanalSchema = z.enum(['WHATSAPP', 'HOFLADEN', 'MARKT', 'BUSINESS', 'OTHER'], {
  error: 'Bitte wähl aus, wo du verkauft hast.',
})

export type Verkaufskanal = z.infer<typeof verkaufskanalSchema>
