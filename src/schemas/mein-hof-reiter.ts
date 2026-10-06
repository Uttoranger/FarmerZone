import { z } from 'zod'

/**
 * Der Reiter von „Mein Hof" in der Adresse (`/farm-page?reiter=beitraege`,
 * E12, Nachtlauf Nr. 16). Die Adresse ist eine Systemgrenze: Was nicht passt,
 * fällt still auf „hofseite" — ein alter oder verstümmelter Link zeigt die
 * Hofseite, nie einen Fehler.
 */
export const MEIN_HOF_REITER_VALUES = ['hofseite', 'beitraege'] as const

export const MEIN_HOF_REITER_PARAMETER = 'reiter'

export const meinHofReiterSchema = z.enum(MEIN_HOF_REITER_VALUES).catch('hofseite')
