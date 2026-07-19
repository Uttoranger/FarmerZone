import { z } from 'zod'

// Env-Validierung (Härtung 2b): Pflicht-Variablen werden beim Serverstart
// geprüft, damit Fehlkonfiguration sofort auffällt statt mitten im Checkout.
// Die Fehlermeldung nennt NUR Variablennamen — niemals Werte.

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
})

export type ServerEnv = z.infer<typeof serverEnvSchema>

export function validateEnv(source: Record<string, string | undefined> = process.env): ServerEnv {
  const parsed = serverEnvSchema.safeParse(source)
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((i) => i.path.join('.')))]
    throw new Error(
      `Fehlende oder ungültige Umgebungsvariablen: ${names.join(', ')} — siehe .env.example.`
    )
  }
  return parsed.data
}

// Im Test-Modus (Vitest setzt NODE_ENV=test) nicht validieren — die Suiten
// mocken Prisma/Stripe und brauchen keine echten Werte.
export const env: ServerEnv =
  process.env.NODE_ENV === 'test'
    ? (process.env as unknown as ServerEnv)
    : validateEnv()
