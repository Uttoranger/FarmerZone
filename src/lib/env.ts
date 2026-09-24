import { z } from 'zod'

// Env-Validierung (Härtung 2b): Pflicht-Variablen werden beim Serverstart
// geprüft, damit Fehlkonfiguration sofort auffällt statt mitten im Checkout.
// Die Fehlermeldung nennt NUR Variablennamen — niemals Werte.

// Optionale Variable: Der leere String wird zu undefined normalisiert, damit
// auch eine leer angelegte Vercel-Variable nicht als „gesetzt" durchgeht.
const optional = () =>
  z.preprocess(
    (wert) => (typeof wert === 'string' && wert.trim() ? wert : undefined),
    z.string().optional()
  )

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  // OPTIONAL, und zwar unbedingt: Ein fehlender (oder leerer) DSN darf
  // niemals einen Deploy verhindern — dann startet die App normal und
  // Sentry bleibt schlicht still (src/instrumentation*.ts prüfen selbst).
  NEXT_PUBLIC_SENTRY_DSN: optional(),
  // OPTIONAL: Das Geheimnis, mit dem Vercel Cron die Routen unter /api/cron
  // aufruft (Authorization: Bearer …). Fehlt es, bleiben die Routen
  // fail-closed gesperrt (401) — ein Deploy scheitert daran nicht.
  CRON_SECRET: optional(),
  // OPTIONAL: Die NUR-LESE-Verbindung des Triage-CLI (scripts/briefkasten.ts).
  // Bewusst getrennt von DATABASE_URL: Das Skript verbindet sich AUSSCHLIESSLICH
  // hierüber und fällt nie auf die Schreibverbindung zurück — ein Agent, der
  // Tickets liest und Code schreibt, darf keine Tickets schließen.
  TRIAGE_DATABASE_URL: optional(),
  // OPTIONAL: Das Geheimnis der Leseroute /api/triage/export (Authorization:
  // Bearer …), über die das Triage-CLI den Briefkasten-Export holt. Fehlt es,
  // antwortet die Route IMMER 401 (fail-closed wie CRON_SECRET) — ein Deploy
  // scheitert daran nicht.
  TRIAGE_TOKEN: optional(),
  // OPTIONAL: Die zwei Tokens der Schreibroute /api/triage/status (Sprint
  // Briefkasten-Rückkopplung). WRITE liegt auf dem Rechner des Entwicklers
  // (CLI: geplant, vermutlich-wunsch), MERGE nur in GitHub Actions (ERLEDIGT,
  // Wiederöffnen). Fehlt einer, gilt er nie (fail-closed); sind zwei der drei
  // Triage-Tokens gleich, lehnt die Route alles ab.
  TRIAGE_WRITE_TOKEN: optional(),
  TRIAGE_MERGE_TOKEN: optional(),
  // OPTIONAL: Die öffentliche Adresse der App — nur in Produktion gesetzt.
  // Previews und lokal leiten ihre Adresse aus den Vercel-Systemvariablen
  // darunter bzw. aus localhost ab (src/lib/umgebung.ts). Fehlt sie in
  // Produktion, gibt es bewusst KEINEN Ersatz.
  NEXT_PUBLIC_APP_URL: optional(),
  // OPTIONAL, von Vercel selbst gesetzt („Automatically expose System
  // Environment Variables"): Umgebung, Deploy-Adresse, Branch-Adresse, Branch.
  // Lokal fehlen sie alle — dann gilt die Umgebung als lokal oder Produktion,
  // nie als Preview.
  VERCEL_ENV: optional(),
  VERCEL_URL: optional(),
  VERCEL_BRANCH_URL: optional(),
  VERCEL_GIT_COMMIT_REF: optional(),
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
