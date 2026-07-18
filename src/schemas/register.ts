import { z } from 'zod'
import { validatePassword, PASSWORD_SCHEMA_MESSAGE } from '@/lib/password-rules'

// Passwort-Regeln der Registrierung: explizites min(8) mit eigener deutscher
// Meldung, danach die volle Checkliste (Groß-/Kleinbuchstabe, Zahl).
// Muss zu minPasswordLength: 8 in src/lib/auth.ts passen.
export const passwordSchema = z
  .string()
  .min(8, 'Mindestens 8 Zeichen')
  .refine((pw) => validatePassword(pw).valid, { message: PASSWORD_SCHEMA_MESSAGE })

export const registrationSchema = z.object({
  email: z.string().email('Ungültige E-Mail-Adresse.'),
  password: passwordSchema,
  name: z.string().min(2, 'Name muss mindestens 2 Zeichen haben.'),
})
