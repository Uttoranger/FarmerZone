import { z } from 'zod'

/**
 * Eingabe der Action setzeTeilenMomente (/settings/teilen, Nr. 30). Strikt:
 * Mehr als der eine Wahrheitswert kommt nicht durch — die farmId nimmt die
 * Action aus der Sitzung, nie aus der Eingabe.
 */
export const teilenMomenteSchema = z.object({ an: z.boolean() }).strict()
