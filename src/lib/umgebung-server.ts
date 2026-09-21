import * as Sentry from '@sentry/nextjs'
import { env } from '@/lib/env'
import { bestimmeUmgebung, type Umgebung } from '@/lib/umgebung'

/**
 * Die Umgebung, einmal je Prozess berechnet — der Serverzweig zu umgebung.ts.
 *
 * Hier und nur hier treffen die Rohwerte aus env auf die reine Entscheidung.
 * Alles, was die Adresse der App braucht (Auth, E-Mail-Links, Stripe-Rücksprung,
 * Kalender), liest APP_URL von hier statt NEXT_PUBLIC_APP_URL selbst — sonst
 * fällt jede Stelle in Previews wieder einzeln auf localhost zurück.
 *
 * Kein `server-only`-Import, obwohl es ein Servermodul ist: Der Seed lädt
 * auth.ts über tsx, und die E-Mail-Tests laden email.ts in Vitest — beides
 * außerhalb von Next, dort würfe `server-only` beim Laden.
 */

// NODE_ENV ist die eine Variable, die laut TECH_STACK direkt gelesen werden darf.
export const UMGEBUNG: Umgebung = bestimmeUmgebung({
  NODE_ENV: process.env.NODE_ENV,
  VERCEL_ENV: env.VERCEL_ENV,
  VERCEL_URL: env.VERCEL_URL,
  VERCEL_BRANCH_URL: env.VERCEL_BRANCH_URL,
  VERCEL_GIT_COMMIT_REF: env.VERCEL_GIT_COMMIT_REF,
  NEXT_PUBLIC_APP_URL: env.NEXT_PUBLIC_APP_URL,
  DATABASE_URL: env.DATABASE_URL,
  STRIPE_SECRET_KEY: env.STRIPE_SECRET_KEY,
})

/**
 * Die Adresse für Links, die die App verlassen (E-Mails, Stripe, ICS).
 * Fällt auf localhost zurück, wie die Aufrufer es bisher einzeln taten — für
 * die vertrauten Herkünfte von Better Auth gilt das NICHT, dort bleibt eine
 * fehlende Adresse leer (siehe umgebung.ts).
 */
export const APP_URL: string = UMGEBUNG.appUrl ?? 'http://localhost:3000'

/** Ob das Banner überhaupt gezeigt wird: nur, wenn die Testumgebung eindeutig erkannt ist. */
export const ZEIGE_UMGEBUNGSBANNER = UMGEBUNG.art !== 'produktion'

// Einmal je Kaltstart — mehr wäre bei jedem Seitenaufruf dieselbe Meldung.
// Serverlos heißt: je Instanz einmal; das ist gewollt, nicht zu viel.
let warnungenGemeldet = false

/**
 * Widersprüche in Produktion (Dev-Datenbank, Stripe test) gehen nicht ins
 * Banner — Kundinnen sehen nie eines — sondern als Warnung an Sentry.
 * Ohne DSN ist Sentry nicht initialisiert und der Aufruf ein No-op; schlägt
 * er dennoch fehl, bleibt es folgenlos.
 */
export function meldeUmgebungsWarnungen(): void {
  if (UMGEBUNG.art !== 'produktion' || UMGEBUNG.warnungen.length === 0) return
  if (warnungenGemeldet) return
  warnungenGemeldet = true
  try {
    Sentry.captureMessage(`Umgebung widersprüchlich: ${UMGEBUNG.warnungen.join(' ')}`, 'warning')
  } catch {
    // Telemetrie scheitert leise.
  }
}
