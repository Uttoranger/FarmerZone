import { z } from 'zod'

/**
 * Die Zeilen des Hofseiten-Editors (src/lib/hofseite-fortschritt.ts) — hier
 * als Zod-Aufzählung, weil dieselben Kennungen über eine Systemgrenze gehen:
 * Der Editor schickt die geöffnete Zeile per postMessage an die Vorschau im
 * iframe, und die Hofseite liest sie als Fremddaten (CODING_STANDARDS §3).
 */
export const hofseiteZeileIdSchema = z.enum([
  'titelbild',
  'logo',
  'name',
  'ueber-uns',
  'fotos',
  'adresse',
  'abholzeiten',
  'zahlung',
  'kontakt',
  'bestellungen',
  'abschnitte',
])

export type HofseiteZeileId = z.infer<typeof hofseiteZeileIdSchema>

/** Der `typ` jeder Markierungs-Nachricht — ein Präfix, damit fremde Nachrichten nie passen. */
export const MARKIERUNG_TYP = 'farmerzone:markiere-abschnitt'

/** Was der Editor an die Vorschau schickt: nur die Kennung der offenen Zeile, sonst nichts. */
export const markierungSchema = z.object({
  typ: z.literal(MARKIERUNG_TYP),
  abschnitt: hofseiteZeileIdSchema.nullable(),
})

export type MarkierungNachricht = z.infer<typeof markierungSchema>

/**
 * Der `typ` der Bereit-Meldung: Die Hofseite im Rahmen sagt dem Editor, dass
 * ihr Empfänger steht — erst dann schickt er die Markierung. Das `load`-
 * Ereignis des iframes reicht nicht: Es kann vor der Hydration feuern, und
 * die Nachricht verhallte.
 */
export const BEREIT_TYP = 'farmerzone:vorschau-bereit'

export const bereitSchema = z.object({ typ: z.literal(BEREIT_TYP) })

/** Der URL-Parameter `?vorschau=` — nur genau „1" zählt (CODING_STANDARDS §3: URL-Parameter durch Zod). */
export const vorschauParameterSchema = z.literal('1')
