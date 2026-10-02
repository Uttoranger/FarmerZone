import { z } from 'zod'
import { validatePassword, PASSWORD_SCHEMA_MESSAGE } from '@/lib/password-rules'
import { PERSONENNAME_MAX, ZU_LANG } from '@/lib/eingabegrenzen'
import { emailSchema } from '@/schemas/email'

// Passwort-Regeln der Registrierung: explizites min(8) mit eigener deutscher
// Meldung, danach die volle Checkliste (Groß-/Kleinbuchstabe, Zahl).
// Muss zu minPasswordLength: 8 in src/lib/auth.ts passen.
export const passwordSchema = z
  .string()
  .min(8, 'Mindestens 8 Zeichen')
  .refine((pw) => validatePassword(pw).valid, { message: PASSWORD_SCHEMA_MESSAGE })

export const registrationSchema = z.object({
  email: emailSchema('Ungültige E-Mail-Adresse.'),
  password: passwordSchema,
  name: z
    .string()
    .min(2, 'Name muss mindestens 2 Zeichen haben.')
    .max(PERSONENNAME_MAX, ZU_LANG.personenname),
})

/**
 * Der Name, wie die Registrierung ihn speichert: Vor- und Nachname mit einem
 * Leerzeichen dazwischen. Das Formular zählt mit derselben Funktion gegen
 * die Grenze, die registerFarmer prüft.
 */
export function vollerName(vorname: string, nachname: string): string {
  return `${vorname.trim()} ${nachname.trim()}`
}
