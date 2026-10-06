import { z } from 'zod'

/**
 * Ein Abo an- oder abschalten (`/account`, `updateSubscription`). Die
 * Hof-Kennung kommt aus dem Browser: nur Länge und Zeichen einer Prisma-cuid
 * (wie `kennung` in hof-bestellungen.ts) — ob es den Hof gibt, entscheidet
 * die Datenbank, wem das Abo gehört, die bewiesene Adresse.
 */
export const aboAenderungSchema = z.object({
  farmId: z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/),
  optInEmail: z.boolean(),
  optInWhatsApp: z.boolean(),
})

export type AboAenderung = z.infer<typeof aboAenderungSchema>
