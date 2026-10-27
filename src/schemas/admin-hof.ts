import { z } from 'zod'
import { adminGrundSchema } from '@/schemas/admin-aktion'

/*
 * Eingaben der Admin-Sperre eines Hofs (Register N34, Nr. 187). Der Grund geht
 * durch dieselbe Wache wie das Protokoll (adminGrundSchema: kurz, ohne
 * E-Mail-Adresse und Telefonnummer) — er steht im Postfach des Hofs und in der
 * Akte. Der Satz für die Kundschaft ist fest (HOF_GESPERRT_SATZ) und kommt
 * nicht aus dem Browser.
 */

export const hofSperrenSchema = z.object({
  farmId: z.string().trim().min(1).max(64),
  grund: adminGrundSchema,
})

export const hofSperreAufhebenSchema = z.object({
  farmId: z.string().trim().min(1).max(64),
})
