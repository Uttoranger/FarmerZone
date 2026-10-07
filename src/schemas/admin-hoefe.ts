import { z } from 'zod'
import { HOF_FILTER_WERTE, type HofFilter } from '@/lib/admin-hoefe'
import { HOFNAME_MAX } from '@/lib/eingabegrenzen'

/**
 * Filter und Suche der Admin-Hofliste in der Adresse (`/admin?filter=pausiert&suche=lind`,
 * Nachtlauf Nr. 22f). Die Adresse ist Fremddaten: Unbekanntes fällt still auf
 * den Standard, eine Suche länger als ein Hofname auf leer — ein alter Link
 * zeigt die Liste, nie einen Fehler.
 */
export const hoefeAnsichtSchema = z.object({
  // Der alte Filter „Ohne Zahlung" heißt seit Register Z1 „Stripe fehlt" — ein
  // gemerkter Link zeigt weiter dieselben Höfe. „nur-bar" gibt es nicht mehr.
  filter: z
    .preprocess((wert) => (wert === 'ohne-zahlung' ? 'stripe-fehlt' : wert), z.enum(HOF_FILTER_WERTE))
    .catch('alle'),
  suche: z.string().trim().max(HOFNAME_MAX).catch(''),
})

export type HoefeAnsicht = { filter: HofFilter; suche: string }

export function hoefeAnsichtAus(parameter: { get(name: string): string | null }): HoefeAnsicht {
  return hoefeAnsichtSchema.parse({
    filter: parameter.get('filter') ?? undefined,
    suche: parameter.get('suche') ?? '',
  })
}
