import { z } from 'zod'
import { emailSchema } from '@/schemas/email'
import { ANMELDECODE_LAENGE, ZIEL_MAX } from '@/lib/anmeldecode'

/**
 * Schemas der Kunden-Anmeldung mit Code (Nr. 08). Im Browser Komfort — die
 * verbindliche Prüfung machen die Endpunkte von Better Auth selbst (eigene
 * Zod-Schemas, Adresse klein geschrieben).
 */

export const codeAnfordernSchema = z.object({
  email: emailSchema('Bitte gib eine gültige E-Mail-Adresse ein.'),
})

export const codeEingabeSchema = z
  .string()
  .regex(new RegExp(`^\\d{${ANMELDECODE_LAENGE}}$`), `Der Code hat ${ANMELDECODE_LAENGE} Ziffern.`)

/**
 * `?ziel=` der Anmeldeseite: Text oder nichts. Ob das Ziel sicher ist,
 * entscheidet danach zielNachAnmeldung (src/lib/anmeldecode.ts).
 */
export const zielParameterSchema = z.string().max(ZIEL_MAX).optional().catch(undefined)
