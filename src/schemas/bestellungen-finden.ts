import { z } from 'zod'
import { emailSchema } from '@/schemas/email'
import { codeEingabeSchema } from '@/schemas/anmeldecode'

/**
 * Schemas von „Bestellungen finden" (Nr. 14) — im Formular Komfort, in den
 * Server Actions (src/server/actions/bestellungen-finden.ts) die Prüfung.
 * Die Adresse in der gespeicherten Form (emailSchema: ohne Ränder, klein):
 * An genau diese Form geht der Code, und genau diese Form ist danach bewiesen.
 */
const EMAIL_MELDUNG = 'Bitte gib eine gültige E-Mail-Adresse ein.'

export const bestellCodeAnfordernSchema = z.object({
  email: emailSchema(EMAIL_MELDUNG),
})

export const bestellCodePruefenSchema = z.object({
  email: emailSchema(EMAIL_MELDUNG),
  code: codeEingabeSchema,
})
