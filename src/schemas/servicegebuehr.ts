import { z } from 'zod'

/**
 * Die Admin-Eingabe für die Servicegebühr eines Hofes (Sprint servicegebuehr).
 *
 * Prozent 0–100 mit höchstens zwei Nachkommastellen (Schema: Decimal(5,2), als Zahl, nie als Text),
 * Mindestgebühr in ganzen Cent (als Zahl, nie als Text), „gilt ab" als Kalendertag JJJJ-MM-TT oder
 * leer (= gebührenfrei). Die Umrechnung des Tages in einen Zeitpunkt
 * (Wiener Mitternacht) macht die Server-Action, nicht das Schema.
 */
/**
 * Die Sätze an der Oberfläche, wenn Prozentsatz oder „gilt ab" nicht passen
 * (Nr. 35). Die Action gibt für diese Felder nur sie zurück, nie eine
 * Zod-Meldung — für Text statt Datum stand dort vorher Zods englischer
 * Standardsatz.
 */
export const PROZENT_UNGUELTIG =
  'Gib den Prozentsatz als Zahl von 0 bis 100 ein, mit höchstens zwei Nachkommastellen, zum Beispiel 4,9.'
export const GILT_AB_UNGUELTIG =
  'Wähle den Tag, ab dem die Gebühr gilt, oder lass das Feld leer, dann bleibt der Hof gebührenfrei.'

export const servicegebuehrEinstellungSchema = z.object({
  // Ohne coerce (Nr. 35, wie minCents seit Nr. 32): Der Dialog schickt die
  // Zahl (prozentsatzEingabe). Text las z.coerce still — „" als 0 %, „1e1"
  // als 10 % —, deshalb lehnt der Server ihn jetzt ab. z.number lässt NaN
  // und Unendlich nicht durch.
  percent: z
    .number({ message: PROZENT_UNGUELTIG })
    .min(0, PROZENT_UNGUELTIG)
    .max(100, PROZENT_UNGUELTIG)
    .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, PROZENT_UNGUELTIG),
  // Ohne coerce (Nr. 32, Runde 1): Der Dialog schickt die ganze Cent-Zahl
  // (mindestgebuehrCent). Text las z.coerce still als Cent — „1e2" als 100
  // Cent, „" als 0 —, deshalb lehnt der Server ihn jetzt ab.
  minCents: z
    .number({ message: 'Mindestgebühr muss eine Zahl sein' })
    .int('Mindestgebühr in ganzen Cent')
    .min(0, 'Mindestgebühr darf nicht negativ sein')
    .max(100_000, 'Mindestgebühr zu hoch'),
  activeFrom: z.preprocess(
    (v) => (v === undefined || v === null || (typeof v === 'string' && v.trim() === '') ? null : v),
    z.string({ message: GILT_AB_UNGUELTIG }).regex(/^\d{4}-\d{2}-\d{2}$/, GILT_AB_UNGUELTIG).nullable()
  ),
})

export type ServicegebuehrEinstellungEingabe = z.input<typeof servicegebuehrEinstellungSchema>
