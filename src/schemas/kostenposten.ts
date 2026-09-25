import { z } from 'zod'
import { KOSTEN_KATEGORIEN, KOSTEN_RHYTHMEN } from '@/lib/finanzen'
import { istMonatsschluessel } from '@/lib/servicegebuehr'

/**
 * Die Admin-Eingabe eines Kostenpostens (Sprint Admin-Finanzen).
 *
 * Der Betrag kommt in EURO aus dem DezimalFeld — so wie abgebucht wird, keine
 * Fremdwährung. Höchstens zwei Nachkommastellen, weil die Spalte
 * `Decimal(10, 2)` ist; die Umrechnung nach Cent macht die Servergrenze über
 * die Decimal-Methode, nicht dieses Schema.
 *
 * `ab` und `bis` sind MONATE (`2026-09`), keine Tage und keine Zeitpunkte. Die
 * Umrechnung in das DATE der Spalte macht die Server-Action.
 */

const monat = z
  .string({ message: 'Bitte wähle einen Monat.' })
  .refine(istMonatsschluessel, 'Bitte wähle einen Monat.')

const betrag = z
  .number({ message: 'Bitte gib einen Betrag ein.' })
  .positive('Der Betrag muss größer als 0 sein.')
  .max(999_999.99, 'Der Betrag ist zu hoch.')
  // Zwei Nachkommastellen: mehr kann die Spalte nicht halten, und was sie nicht
  // hält, würde beim Speichern still gerundet.
  .refine(
    (v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6,
    'Höchstens zwei Nachkommastellen.'
  )

/**
 * Die ID kommt nie aus einem Formularfeld, sondern aus der Liste. Fehlt sie
 * oder ist sie keine Zeichenkette, ist das kein Eingabefehler des Menschen —
 * deshalb derselbe Satz wie bei einem Posten, den es nicht mehr gibt, und
 * keine englische Zod-Vorgabe.
 */
const id = z.string({ message: 'Posten nicht gefunden.' }).min(1, 'Posten nicht gefunden.')

/** Leere Notiz ist `null`, nie `undefined` (CODING_STANDARDS §8). */
const notiz = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? null : (v ?? null)),
  z.string().trim().max(200, 'Die Notiz ist zu lang.').nullable()
)

export const kostenpostenSchema = z.object({
  name: z
    .string({ message: 'Bitte gib dem Posten einen Namen.' })
    .trim()
    .min(1, 'Bitte gib dem Posten einen Namen.')
    .max(60, 'Der Name ist zu lang.'),
  kategorie: z.enum(KOSTEN_KATEGORIEN, { message: 'Bitte wähle eine Kategorie.' }),
  betrag,
  rhythmus: z.enum(KOSTEN_RHYTHMEN, { message: 'Bitte wähle einen Rhythmus.' }),
  ab: monat,
  notiz,
})

export const kostenpostenAendernSchema = kostenpostenSchema.extend({ id })

/**
 * Beenden statt Löschen ist der Normalfall: `monat` ist der LETZTE Monat, in
 * dem der Posten zählt — die Vergangenheit bleibt damit richtig.
 */
export const kostenpostenBeendenSchema = z.object({ id, monat })

export const kostenpostenLoeschenSchema = z.object({ id })

export type KostenpostenEingabe = z.input<typeof kostenpostenSchema>
