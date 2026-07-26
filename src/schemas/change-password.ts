import { z } from 'zod'
import { passwordSchema } from '@/schemas/register'

// Dieselben Regeln wie bei Registrierung und Reset (min(8) + Checkliste) —
// ein selbst gesetztes Passwort darf nicht schwächer sein als ein neues.
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Bitte aktuelles Passwort eingeben.'),
    password: passwordSchema,
    passwordConfirm: z.string(),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: 'Passwörter stimmen nicht überein.',
    path: ['passwordConfirm'],
  })

export type ChangePasswordData = z.infer<typeof changePasswordSchema>
