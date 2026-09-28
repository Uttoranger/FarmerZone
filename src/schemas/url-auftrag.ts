import { z } from 'zod'

/**
 * Ein Auftrag in der Adresse einer Bauern-Seite: ?neu=1 öffnet den
 * Anlegen-Dialog, ?edit=<id> den Bearbeiten-Dialog (src/lib/url-auftrag.ts).
 * URL-Parameter sind Fremddaten: Was nicht passt, ist kein Auftrag.
 */
export const urlAuftragSchema = z
  .object({
    neu: z.literal('1').nullable().catch(null),
    edit: z
      .string()
      .regex(/^[A-Za-z0-9_-]{1,64}$/)
      .nullable()
      .catch(null),
  })
