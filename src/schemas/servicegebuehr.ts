import { z } from 'zod'

/**
 * Die Admin-Eingabe für die Servicegebühr eines Hofes (Sprint servicegebuehr).
 *
 * Prozent 0–100 mit höchstens zwei Nachkommastellen (Schema: Decimal(5,2)),
 * Mindestgebühr in ganzen Cent, „gilt ab" als Kalendertag JJJJ-MM-TT oder
 * leer (= gebührenfrei). Die Umrechnung des Tages in einen Zeitpunkt
 * (Wiener Mitternacht) macht die Server-Action, nicht das Schema.
 */
export const servicegebuehrEinstellungSchema = z.object({
  percent: z.coerce
    .number({ message: 'Prozentsatz muss eine Zahl sein' })
    .min(0, 'Prozentsatz darf nicht negativ sein')
    .max(100, 'Prozentsatz darf höchstens 100 sein')
    .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, 'Höchstens zwei Nachkommastellen'),
  minCents: z.coerce
    .number({ message: 'Mindestgebühr muss eine Zahl sein' })
    .int('Mindestgebühr in ganzen Cent')
    .min(0, 'Mindestgebühr darf nicht negativ sein')
    .max(100_000, 'Mindestgebühr zu hoch'),
  activeFrom: z.preprocess(
    (v) => (v === undefined || v === null || (typeof v === 'string' && v.trim() === '') ? null : v),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum als JJJJ-MM-TT').nullable()
  ),
})

export type ServicegebuehrEinstellungEingabe = z.input<typeof servicegebuehrEinstellungSchema>
