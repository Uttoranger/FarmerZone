import { z } from 'zod'

/**
 * Die URL-Parameter der Bestätigungsseite (/{hof}/confirm/{id}) —
 * CODING_STANDARDS §3: URL-Parameter durch Zod. Alles, was nicht passt
 * (doppelt angegeben, falsches Format, fremder Wert), gilt als fehlend: Ohne
 * `sig` zeigt die Seite nur „eingegangen", ohne `redirect_status` keinen
 * Hinweis. Ein kaputter Parameter wird so nie zum Fehler und nie zum Zugang.
 */
export const bestaetigungsParameterSchema = z.object({
  /** HMAC-SHA256 in Hex (src/lib/bestell-link.ts). Ob sie gilt, prüft bestellLinkGilt. */
  sig: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .optional()
    .catch(undefined),
  /** Stripes Rückmeldung an der return_url — nur ein Hinweis, nie der Zahlungsstand. */
  redirect_status: z.enum(['succeeded', 'processing', 'failed']).optional().catch(undefined),
})

export type BestaetigungsParameter = z.infer<typeof bestaetigungsParameterSchema>
