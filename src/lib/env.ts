import { z } from 'zod'

// Env-Validierung (Härtung 2b): Pflicht-Variablen werden beim Serverstart
// geprüft, damit Fehlkonfiguration sofort auffällt statt mitten im Checkout.
// Die Fehlermeldung nennt NUR Variablennamen — niemals Werte.

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  // OPTIONAL, und zwar unbedingt: Ein fehlender (oder leerer) DSN darf
  // niemals einen Deploy verhindern — dann startet die App normal und
  // Sentry bleibt schlicht still (src/instrumentation*.ts prüfen selbst).
  // Der leere String wird zu undefined normalisiert, damit auch eine leer
  // angelegte Vercel-Variable nicht als „gesetzt" durchgeht.
  NEXT_PUBLIC_SENTRY_DSN: z.preprocess(
    (wert) => (typeof wert === 'string' && wert.trim() ? wert : undefined),
    z.string().optional()
  ),
  // OPTIONAL: Das Geheimnis, mit dem Vercel Cron die Routen unter /api/cron
  // aufruft (Authorization: Bearer …). Fehlt es, bleiben die Routen
  // fail-closed gesperrt (401) — ein Deploy scheitert daran nicht.
  CRON_SECRET: z.preprocess(
    (wert) => (typeof wert === 'string' && wert.trim() ? wert : undefined),
    z.string().optional()
  ),
  // OPTIONAL: Die NUR-LESE-Verbindung des Triage-CLI (scripts/briefkasten.ts).
  // Bewusst getrennt von DATABASE_URL: Das Skript verbindet sich AUSSCHLIESSLICH
  // hierüber und fällt nie auf die Schreibverbindung zurück — ein Agent, der
  // Tickets liest und Code schreibt, darf keine Tickets schließen.
  TRIAGE_DATABASE_URL: z.preprocess(
    (wert) => (typeof wert === 'string' && wert.trim() ? wert : undefined),
    z.string().optional()
  ),
  // OPTIONAL: Das Geheimnis der Leseroute /api/triage/export (Authorization:
  // Bearer …), über die das Triage-CLI den Briefkasten-Export holt. Fehlt es,
  // antwortet die Route IMMER 401 (fail-closed wie CRON_SECRET) — ein Deploy
  // scheitert daran nicht.
  TRIAGE_TOKEN: z.preprocess(
    (wert) => (typeof wert === 'string' && wert.trim() ? wert : undefined),
    z.string().optional()
  ),
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
