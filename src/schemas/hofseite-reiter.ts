import { z } from 'zod'

/**
 * Der Reiter der Hofseite in der Adresse (`?reiter=produkte`, Nr. 10). Die
 * Adresse ist eine Systemgrenze: Was nicht passt, fällt still auf null
 * (= Übersicht) — ein alter oder verstümmelter Link zeigt die Seite, nie
 * einen Fehler.
 *
 * Seit Nr. 128 (Register F8) gibt es nur noch Übersicht · Produkte: Die
 * Beiträge stehen als „Aktuell vom Hof“ oben in der Übersicht. Der alte Reiter
 * `beitraege` ist kein Reiter mehr, bleibt aber ein gültiges Ziel einer Adresse
 * (`HofReiterId`): Alte Links — geteilt, aus Mails, aus Mein Hof › Beiträge
 * (kundenAnsichtAdresse) — landen in der Übersicht und springen zu „Aktuell
 * vom Hof“ (springeZuAktuell in src/lib/hofseite-kunde.ts).
 */
export const HOF_REITER_VALUES = ['uebersicht', 'produkte'] as const

/** Ein Reiter, den die Hofseite anbietet. */
export type HofReiterAngebot = (typeof HOF_REITER_VALUES)[number]

/** Der frühere Reiter „Beiträge“ — nur noch als Ziel alter Links. */
export const ALTER_REITER_BEITRAEGE = 'beitraege'

/** Was eine Adresse als Reiter tragen darf: die Reiter und der alte Reiter „Beiträge“. */
export type HofReiterId = HofReiterAngebot | typeof ALTER_REITER_BEITRAEGE

export const REITER_PARAMETER = 'reiter'

export const reiterSchema = z.enum(HOF_REITER_VALUES).nullable().catch(null)

/**
 * `?beitrag=<id>` (Register F8/T5, Nr. 128): der Link eines Beitrags aus dem
 * Teilen-Fenster und der Mail an Abonnentinnen. Systemgrenze: nur
 * Kleinbuchstaben und Ziffern (Prisma-Kennungen), höchstens 40 Zeichen — was
 * nicht passt, wird still verworfen (null), wie ein unbekannter Reiter.
 */
export const BEITRAG_PARAMETER = 'beitrag'

export const beitragKennungSchema = z
  .string()
  .regex(/^[a-z0-9]{1,40}$/)
  .nullable()
  .catch(null)
