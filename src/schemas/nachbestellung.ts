import { z } from 'zod'

/**
 * Der Nachbestell-Link der Hofseite (`/[farmSlug]?reorder=<Token>`), den die
 * Bestätigungs-Mail trägt. Die URL ist eine Systemgrenze (CODING_STANDARDS §3):
 * Was nicht passt — fehlt, leer, mehrfach, überlang —, wird verworfen, nie ein
 * Fehler; die Seite lädt dann einfach ohne vorbefüllten Korb. Ob das Token
 * echt ist, prüft danach `verifyReorderToken` (src/lib/reorder-token.ts) mit
 * seiner Signatur.
 */
export const nachbestellParameterSchema = z.string().min(1).max(512)

/** Das Token aus den Suchparametern — oder null, wenn keins taugt. */
export function nachbestellToken(wert: string | string[] | undefined): string | null {
  const gelesen = nachbestellParameterSchema.safeParse(wert)
  return gelesen.success ? gelesen.data : null
}
