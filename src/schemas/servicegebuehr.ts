import { z } from 'zod'
import { centsAlsEuro, formatEuro } from '@/lib/format'

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

/** Kein lesbares Formular (kein Objekt, unbekannter Fehler) — ohne Feld, mit Ausweg. */
export const EINSTELLUNG_UNGUELTIG =
  'Wir konnten die Einstellung nicht lesen. Lade die Seite neu und versuch es noch einmal.'

/** Höchste Mindestgebühr in Cent (€ 1.000,00) — darüber lehnt das Schema ab. */
export const MINDESTGEBUEHR_MAX_CENTS = 100_000

/*
 * Die Sätze zur Mindestgebühr (Nr. 47): Die Action gibt sie unverändert an
 * den Dialog weiter — vorher standen dort Halbsätze wie „Mindestgebühr zu
 * hoch" ohne Punkt und ohne Hinweis, was stattdessen gilt. Den ersten Satz
 * zeigt auch der Dialog selbst, wenn er den getippten Betrag nicht lesen kann
 * (MINDESTGEBUEHR_UNGUELTIG in src/lib/admin-hoefe.ts) — eine Quelle.
 */
export const MINDESTGEBUEHR_KEINE_ZAHL = 'Gib die Mindestgebühr als Betrag in Euro ein, zum Beispiel 0,50.'
export const MINDESTGEBUEHR_GANZE_CENT =
  'Gib die Mindestgebühr mit höchstens zwei Nachkommastellen ein, zum Beispiel 0,50.'
export const MINDESTGEBUEHR_NEGATIV =
  `Die Mindestgebühr kann nicht unter ${formatEuro(0)} liegen. Lass das Feld leer, wenn keine gelten soll.`
export const MINDESTGEBUEHR_ZU_HOCH = `Die Mindestgebühr darf höchstens ${formatEuro(centsAlsEuro(MINDESTGEBUEHR_MAX_CENTS))} betragen. Gib einen kleineren Betrag ein.`

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
    .number({ message: MINDESTGEBUEHR_KEINE_ZAHL })
    .int(MINDESTGEBUEHR_GANZE_CENT)
    .min(0, MINDESTGEBUEHR_NEGATIV)
    .max(MINDESTGEBUEHR_MAX_CENTS, MINDESTGEBUEHR_ZU_HOCH),
  activeFrom: z.preprocess(
    (v) => (v === undefined || v === null || (typeof v === 'string' && v.trim() === '') ? null : v),
    z.string({ message: GILT_AB_UNGUELTIG }).regex(/^\d{4}-\d{2}-\d{2}$/, GILT_AB_UNGUELTIG).nullable()
  ),
})

export type ServicegebuehrEinstellungEingabe = z.input<typeof servicegebuehrEinstellungSchema>
