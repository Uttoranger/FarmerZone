import { z } from 'zod'
import {
  GRUENDUNGSJAHR_FEHLER,
  GRUENDUNGSJAHR_MAX,
  GRUENDUNGSJAHR_MIN,
  LEITSPRUCH_MAX,
  UEBER_UNS_MAX,
  WERTE_MAX,
  WERTE_ZU_VIELE,
  WERT_UNTERTITEL_MAX,
  ZU_LANG,
} from '@/lib/eingabegrenzen'

/**
 * Der Auftritt der Hofseite, wie saveAppearanceAction
 * (src/server/actions/appearance.ts) ihn verlangt. Hier statt in der Aktion,
 * weil die Abschnitte von Mein Hof (components/mein-hof/abschnitt-formulare.tsx,
 * seit Nr. 50 unter lg im Blatt, ab lg im Editor) ihre Felder mit `.pick()`
 * bzw. mit den Grenzen daraus prüfen — eine Regel, nicht zwei Abschriften.
 *
 * Jedes Feld ist freiwillig, und keins hat einen Standard (Register N4,
 * Ergänzung Lauf 10): Die Aktion schreibt nur, was mitkommt. Ein Standard
 * (etwa [] für die Abschnitte) schriebe ein Feld, das der Abschnitt gar nicht
 * geschickt hat, und setzte den Stand eines anderen Tabs zurück.
 */

/** Grenzen und Sätze der Werte und des Gründungsjahrs — zod-frei in src/lib/eingabegrenzen.ts (Nr. 196). */
export { GRUENDUNGSJAHR_FEHLER, GRUENDUNGSJAHR_MAX, GRUENDUNGSJAHR_MIN, WERTE_MAX, WERTE_ZU_VIELE }

const farmValueSchema = z.object({
  icon: z.string().max(10),
  title: z.string().min(1).max(50),
  subtitle: z.string().max(WERT_UNTERTITEL_MAX, ZU_LANG.wertUntertitel).nullable().optional(),
  sortOrder: z.number().int(),
})

const sectionConfigSchema = z.object({
  key: z.string(),
  visible: z.boolean(),
  order: z.number().int(),
})

export const appearanceSchema = z.object({
  tagline: z.string().max(LEITSPRUCH_MAX, ZU_LANG.leitspruch).nullable().optional(),
  foundedYear: z
    .number()
    .int(GRUENDUNGSJAHR_FEHLER)
    .min(GRUENDUNGSJAHR_MIN, GRUENDUNGSJAHR_FEHLER)
    .max(GRUENDUNGSJAHR_MAX, GRUENDUNGSJAHR_FEHLER)
    .nullable()
    .optional(),
  aboutText: z.string().max(UEBER_UNS_MAX, ZU_LANG.ueberUns).nullable().optional(),
  bannerType: z.enum(['GRADIENT', 'PHOTO']).optional(),
  bannerValue: z.string().nullable().optional(),
  bannerUrl: z.string().url().nullable().optional(),
  logoUrl: z.string().url().nullable().optional(),
  sectionsConfig: z.array(sectionConfigSchema).optional(),
  farmValues: z.array(farmValueSchema).max(WERTE_MAX, WERTE_ZU_VIELE).optional(),
})

export type AppearanceSaveInput = z.infer<typeof appearanceSchema>

/**
 * Das Gründungsjahr aus dem Textfeld: „1987" → 1987, leer → null (Feld
 * geleert), alles andere ist kein Jahr → undefined. Das Feld ist Text, nicht
 * `type="number"`: So bleibt „leer" leer (CODING_STANDARDS §8), und der
 * Server prüft die Zahl ohnehin noch einmal (appearanceSchema).
 */
export function gruendungsjahrAus(text: string): number | null | undefined {
  const getrimmt = text.trim()
  if (getrimmt === '') return null
  if (!/^\d{4}$/.test(getrimmt)) return undefined
  const jahr = Number(getrimmt)
  return jahr >= GRUENDUNGSJAHR_MIN && jahr <= GRUENDUNGSJAHR_MAX ? jahr : undefined
}

/** Das Formular „Leitspruch und Gründungsjahr" — Felder als Text, Grenzen aus dem Schema der Aktion. */
export const leitspruchFormularSchema = z.object({
  tagline: z.string().max(LEITSPRUCH_MAX, ZU_LANG.leitspruch),
  gruendungsjahr: z.string().refine((text) => gruendungsjahrAus(text) !== undefined, GRUENDUNGSJAHR_FEHLER),
})

export type LeitspruchFormular = z.infer<typeof leitspruchFormularSchema>
