import { z } from 'zod'

/**
 * Die Ansicht von „Mein Hof" unter lg in der Adresse (`?ansicht=kundin`,
 * Nachtlauf Nr. 49, Register N4): „Bearbeiten" (ohne Parameter) oder „So
 * sieht’s die Kundin". Wie `?ansicht=karte` auf /hoefe: Die Adresse ist eine
 * Systemgrenze — was nicht passt, fällt still auf „bearbeiten".
 */
export const MEIN_HOF_ANSICHT_WERTE = ['bearbeiten', 'kundin'] as const

export type MeinHofAnsichtId = (typeof MEIN_HOF_ANSICHT_WERTE)[number]

export const MEIN_HOF_ANSICHT_PARAMETER = 'ansicht'

export const meinHofAnsichtSchema = z.enum(MEIN_HOF_ANSICHT_WERTE).catch('bearbeiten')
