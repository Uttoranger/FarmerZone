import { z } from 'zod'
import { ADMIN_RECHTE } from '@/lib/admin-rechte'
import { emailSchema } from '@/schemas/email'

/*
 * Eingaben von Einstellungen › Team (Register N35, Nachtlauf Nr. 190). Rechte
 * nur aus ADMIN_RECHTE — „team“ und „notfallzugang“ lassen sich nie vergeben,
 * sie hängen allein an `adminInhaber`.
 */

const userId = z.string().trim().min(1).max(64)

export const teamEinladenSchema = z.object({ adresse: emailSchema() })

export const teamRechteSchema = z.object({ userId, rechte: z.array(z.enum(ADMIN_RECHTE)).max(ADMIN_RECHTE.length) })

export const teamInhaberSchema = z.object({ userId, inhaber: z.boolean() })

export const teamEntfernenSchema = z.object({ userId })
