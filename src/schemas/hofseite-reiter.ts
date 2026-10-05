import { z } from 'zod'

/**
 * Der Reiter der Hofseite in der Adresse (`?reiter=produkte`, Nr. 10). Die
 * Adresse ist eine Systemgrenze: Was nicht passt, fällt still auf null
 * (= Übersicht) — ein alter oder verstümmelter Link zeigt die Seite, nie
 * einen Fehler. Ob es den Reiter beim Hof gibt (Beiträge), entscheidet
 * aktiverReiter in src/lib/hofseite-kunde.ts.
 */
export const HOF_REITER_VALUES = ['uebersicht', 'produkte', 'beitraege'] as const
export type HofReiterId = (typeof HOF_REITER_VALUES)[number]

export const REITER_PARAMETER = 'reiter'

export const reiterSchema = z.enum(HOF_REITER_VALUES).nullable().catch(null)
