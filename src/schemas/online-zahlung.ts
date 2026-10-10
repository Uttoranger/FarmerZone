import { z } from 'zod'

/**
 * „Online-Zahlung einschalten" (Register Z1, Nachbesserung Nr. 24): Die
 * Eingabe kennt nur das Einschalten. `strict`, damit kein zweites Feld — etwa
 * ein `acceptsOnline: false` — unbemerkt mitreist; ausschalten geht nicht.
 */
export const onlineZahlungEinschaltenSchema = z.object({ einschalten: z.literal(true) }).strict()
