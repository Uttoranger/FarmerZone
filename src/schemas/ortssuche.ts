import { z } from 'zod'
import { ORTSSUCHE_MAX_ZEICHEN } from '@/lib/eingabegrenzen'

/** Was länger ist als ein österreichischer Ortsname, ist keine Ortssuche — die Zahl steht zod-frei in eingabegrenzen.ts (Nr. 196). */
export { ORTSSUCHE_MAX_ZEICHEN }

/**
 * Eingetippte Postleitzahl oder Ortsname für die Umkreissuche auf /hoefe
 * (`loeseOrtAuf`): ohne Ränder, gekappt statt abgelehnt (ein langer Text soll
 * die Suche nicht laut scheitern lassen), mindestens zwei Zeichen.
 */
export const ortssucheSchema = z
  .string()
  .transform((text) => text.trim().slice(0, ORTSSUCHE_MAX_ZEICHEN))
  .pipe(z.string().min(2))
