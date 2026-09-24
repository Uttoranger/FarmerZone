/**
 * Die Umgebungswerte der Integrationsschicht — an EINER Stelle, weil zwei
 * Prozesse sie brauchen: die Vitest-Worker (`vitest.integration.config.ts`) und
 * die Kindprozesse des globalSetup (`prisma migrate deploy`, Seed).
 *
 * UNBEDINGTE PLATZHALTER für Stripe und Resend. Sie überschreiben, was in
 * `.env.test` steht — auch wenn dort echte Schlüssel liegen. Zweite Sicherung:
 * Vergisst ein künftiger Test sein `vi.mock('@/lib/stripe')`, läuft der Aufruf
 * in einen ungültigen Schlüssel statt in echtes Geld.
 *
 * `DATABASE_URL` steht hier NICHT: Sie kommt aus `TEST_DATABASE_URL` und nur
 * durch die Sicherheitssperre hindurch (`sicherheitssperre.ts`).
 */
export const INTEGRATIONS_ENV = {
  BETTER_AUTH_SECRET: 'vitest-secret-nicht-fuer-produktion',
  STRIPE_SECRET_KEY: 'sk_test_integration_dummy',
  STRIPE_WEBHOOK_SECRET: 'whsec_integration_dummy',
  RESEND_API_KEY: 're_integration_dummy',
  // Better Auth leitet seine baseURL daraus ab (src/lib/umgebung-server.ts).
  // Ohne Adresse bliebe sie leer und die echte Anmeldung im Storno-Test
  // scheiterte an einer fehlenden Herkunft.
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
} as const
