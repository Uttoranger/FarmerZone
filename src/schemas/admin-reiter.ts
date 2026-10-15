import { z } from 'zod'
import { HOEFE_REITER_IDS, type HoefeReiterId } from '@/lib/admin-hoefe-seite'
import { FINANZEN_REITER_IDS, FINANZEN_REITER_STANDARD, type FinanzenReiterId } from '@/lib/admin-finanzen-seite'

/**
 * Der Reiter einer Admin-Seite in der Adresse (`/admin?reiter=alle`,
 * `/admin/finanzen?reiter=kosten`; Register N15, Nr. 94). Die Adresse ist
 * Fremddaten: Ein unbekannter oder fehlender Wert ist kein Fehler, sondern
 * der Standard — ein alter Link zeigt die Seite, nie eine Fehlerseite.
 */
export const ADMIN_REITER_PARAMETER = 'reiter'

/** Höfe: null = nichts gewählt (oder Unsinn) — den Standard bestimmt die Seite, er hängt von den wartenden Höfen ab. */
export const hoefeReiterSchema = z.enum(HOEFE_REITER_IDS).nullable().catch(null)

export function hoefeReiterAus(parameter: { get(name: string): string | null }): HoefeReiterId | null {
  return hoefeReiterSchema.parse(parameter.get(ADMIN_REITER_PARAMETER))
}

/** Finanzen: ohne gültigen Wert der Monat. */
export const finanzenReiterSchema = z.enum(FINANZEN_REITER_IDS).catch(FINANZEN_REITER_STANDARD)

export function finanzenReiterAus(wert: string | undefined): FinanzenReiterId {
  return finanzenReiterSchema.parse(wert)
}

/**
 * Admin › Finanzen: Monat oder Jahr (Register N15, Ergänzung Nr. 100). In der
 * Adresse `?zeitraum=jahr&jahr=2026`. Auch das ist Fremdtext: Ohne `zeitraum`
 * oder mit Unsinn bleibt es der Monat wie bisher, ein ungültiges Jahr ist das
 * laufende. Die UNTERE Grenze (nicht vor dem Jahr der ersten Bestellung bzw. des
 * ersten Kostenpostens) kennt nur die Datenbank — sie zieht `getFinanzenJahr`
 * nach (`jahrImBereich`, src/lib/finanzen.ts).
 */
export const FINANZEN_ZEITRAEUME = ['monat', 'jahr'] as const
export type FinanzenZeitraum = (typeof FINANZEN_ZEITRAEUME)[number]

export const finanzenZeitraumSchema = z.enum(FINANZEN_ZEITRAEUME).catch('monat')

export function finanzenZeitraumAus(wert: string | undefined): FinanzenZeitraum {
  return finanzenZeitraumSchema.parse(wert)
}

/** Vierstellig, ganze Zahl, nicht nach dem laufenden Jahr; sonst das laufende Jahr. */
export function finanzenJahrAus(wert: string | undefined, laufendesJahr: number): number {
  return z
    .string()
    .regex(/^\d{4}$/)
    .transform(Number)
    .pipe(z.number().int().max(laufendesJahr))
    .catch(laufendesJahr)
    .parse(wert)
}
