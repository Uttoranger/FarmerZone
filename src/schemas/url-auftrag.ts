import { z } from 'zod'

/**
 * Die Bereiche des Neu-Menüs „Was legst du an?" (Nachtlauf Nr. 18). Die Wahl
 * bestimmt das Formular: Lebensmittel öffnet den Produktdialog, Futtermittel
 * startet die Kategorie bei den Futtermitteln, Brennmaterial setzt Brennholz.
 */
export const NEU_BEREICH_WERTE = ['lebensmittel', 'futter', 'brennmaterial'] as const

export type NeuBereich = (typeof NEU_BEREICH_WERTE)[number]

/**
 * Ein Auftrag in der Adresse einer Bauern-Seite: ?neu=1 öffnet den
 * Anlegen-Dialog (mit ?bereich= in einem Bereich), ?edit=<id> den
 * Bearbeiten-Dialog (src/lib/url-auftrag.ts). URL-Parameter sind Fremddaten:
 * Was nicht passt, ist kein Auftrag; ein unbekannter Bereich ist keiner.
 */
export const urlAuftragSchema = z
  .object({
    neu: z.literal('1').nullable().catch(null),
    bereich: z.enum(NEU_BEREICH_WERTE).nullable().catch(null),
    edit: z
      .string()
      .regex(/^[A-Za-z0-9_-]{1,64}$/)
      .nullable()
      .catch(null),
  })
