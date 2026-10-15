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
