import { z } from 'zod'
import { adminGrundSchema } from '@/schemas/admin-aktion'
import { einmalTokenSchema } from '@/lib/geraete'
import { HOFNAME_MAX } from '@/lib/eingabegrenzen'
import { emailSchema } from '@/schemas/email'

/*
 * Eingaben der Konto-Anfragen (Register N36, Nachtlauf Nr. 190). Der Grund
 * geht durch dieselbe Wache wie das Protokoll (adminGrundSchema). Adressen
 * werden klein und ohne Ränder verglichen (normalisiereAdresse).
 */

const farmId = z.string().trim().min(1).max(64)
const adresse = emailSchema()

export const emailAendernSchema = z.object({ farmId, neueAdresse: adresse, grund: adminGrundSchema })

export const emailBestaetigenSchema = z.object({ token: einmalTokenSchema, adresse })

export const auskunftHofSchema = z.object({ farmId, grund: adminGrundSchema })

export const auskunftKundinSchema = z.object({ adresse, grund: adminGrundSchema })

export const kontoSchliessenSchema = z.object({ farmId, grund: adminGrundSchema, hofname: z.string().max(HOFNAME_MAX * 2) })

export const kontoWiederOeffnenSchema = z.object({ farmId, grund: adminGrundSchema })
