/**
 * Der Reiter von „Mein Hof" in der Adresse (`/farm-page?reiter=beitraege`,
 * E12, Nachtlauf Nr. 16). Die Adresse ist eine Systemgrenze: Was nicht passt,
 * fällt still auf „hofseite" — ein alter oder verstümmelter Link zeigt die
 * Hofseite, nie einen Fehler.
 *
 * Ohne Zod (Nr. 196): Die Navigation, die diese Datei liest, lädt jede
 * Kundenseite im Browser mit (tests/leistung-196.test.ts).
 */
export const MEIN_HOF_REITER_VALUES = ['hofseite', 'beitraege'] as const

export type MeinHofReiterWert = (typeof MEIN_HOF_REITER_VALUES)[number]

export const MEIN_HOF_REITER_PARAMETER = 'reiter'

/** Der Reiter aus einem beliebigen Wert; alles Unbekannte ist „hofseite" (wie vorher `z.enum(…).catch`). */
export function leseMeinHofReiter(roh: unknown): MeinHofReiterWert {
  return MEIN_HOF_REITER_VALUES.find((wert) => wert === roh) ?? 'hofseite'
}
