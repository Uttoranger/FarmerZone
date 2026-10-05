import { createRateLimiter } from '@/lib/rate-limit'
import { CODE_ANFORDERUNGEN_JE_ADRESSE } from '@/lib/anmeldecode'

/**
 * Die Bremse je Adresse für das Anfordern von Anmeldecodes
 * (CODE_ANFORDERUNGEN_JE_ADRESSE) als Instanz — auth.ts hält eine davon,
 * Tests bauen sich je Fall eine frische.
 *
 * Eigene Datei, weil src/lib/rate-limit.ts `next/server` lädt: anmeldecode.ts
 * läuft auch im Browser (Formular, Schemas) und bleibt deshalb frei davon.
 * Je Instanz im Speicher wie alle Speicher-Grenzen (SERVERLESS-KAVEAT in
 * rate-limit.ts); die Adresse steht nur im Speicher, nie im Log.
 */
export function erzeugeAnforderungsSperre(): { erlaubt(email: string, jetztMs?: number): boolean } {
  const limiter = createRateLimiter({
    max: CODE_ANFORDERUNGEN_JE_ADRESSE.max,
    windowMs: CODE_ANFORDERUNGEN_JE_ADRESSE.fensterMs,
  })
  return {
    erlaubt(email, jetztMs = Date.now()) {
      return limiter.check(email.trim().toLowerCase(), jetztMs)
    },
  }
}
