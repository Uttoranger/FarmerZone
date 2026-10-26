import { z } from 'zod'
import { BEREIT_TYP, HOFSEITE_ZEILE_IDS, MARKIERUNG_TYP } from '@/lib/hofseite-vorschau'

export { BEREIT_TYP, MARKIERUNG_TYP }

/**
 * Die Zeilen des Hofseiten-Editors als Zod-Aufzählung — die Liste selbst steht
 * zod-frei in src/lib/hofseite-vorschau.ts, weil die Hofseite sie im Browser
 * liest (Nr. 196). Dort prüft `leseMarkierung` die Nachricht ohne Zod; dieses
 * Schema beschreibt dieselbe Form für Server und Tests.
 */
export const hofseiteZeileIdSchema = z.enum(HOFSEITE_ZEILE_IDS)

export type HofseiteZeileId = z.infer<typeof hofseiteZeileIdSchema>

/** Was der Editor an die Vorschau schickt: nur die Kennung der offenen Zeile, sonst nichts. */
export const markierungSchema = z.object({
  typ: z.literal(MARKIERUNG_TYP),
  abschnitt: hofseiteZeileIdSchema.nullable(),
})

export type MarkierungNachricht = z.infer<typeof markierungSchema>

export const bereitSchema = z.object({ typ: z.literal(BEREIT_TYP) })

/** Der URL-Parameter `?vorschau=` — nur genau „1" zählt (CODING_STANDARDS §3: URL-Parameter durch Zod). */
export const vorschauParameterSchema = z.literal('1')
