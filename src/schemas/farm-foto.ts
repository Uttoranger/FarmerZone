import { z } from 'zod'
import { BILDUNTERSCHRIFT_MAX, BILD_URL_MAX } from '@/lib/eingabegrenzen'

/**
 * Ein Galeriefoto hinzufügen (`addFarmPhotoAction`). Das Schema prüft nur
 * Form und Länge; ob die Adresse aus unserem Speicher und dem Ordner des
 * Hofes stammt, entscheidet danach `bildUrlErlaubt` (src/server/bild-url.ts).
 */
export const farmFotoHinzufuegenSchema = z.object({
  url: z.string().min(1).max(BILD_URL_MAX),
  caption: z.string().max(BILDUNTERSCHRIFT_MAX).optional(),
})
