import { z } from 'zod'
import { passwordSchema } from '@/schemas/register'

// Dieselben Passwort-Regeln wie bei der Registrierung (min(8) + Checkliste) —
// ein zurückgesetztes Passwort darf nicht schwächer sein als ein neues.
export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    passwordConfirm: z.string(),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: 'Passwörter stimmen nicht überein.',
    path: ['passwordConfirm'],
  })

export type ResetPasswordData = z.infer<typeof resetPasswordSchema>
