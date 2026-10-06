'use server'

import * as Sentry from '@sentry/nextjs'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { createRateLimiter, getClientIp } from '@/lib/rate-limit'
import {
  BESTAETIGEN_ABGELAUFEN_TEXT,
  BESTAETIGEN_UNGUELTIG_TEXT,
  ERNEUT_KEINE_PFLICHT_TEXT,
  ERNEUT_VERSAND_FEHLER_TEXT,
  erneutWarteText,
  fehlerCodeVon,
} from '@/lib/email-bestaetigung'
import { emailBestaetigenSchema } from '@/schemas/email-bestaetigung'
import { ladeBestaetigungsStand, reserviereBestaetigungsVersand } from '@/server/email-bestaetigung'

/*
 * E-Mail-Bestätigung (S3, Nachtlauf Nr. 17b): „Erneut senden" und
 * „Bestätigen". Better Auth erzeugt und prüft den signierten Token; seine
 * HTTP-Wege dafür sind zu (BESTAETIGUNG_GESPERRTE_AUTH_PFADE), diese Actions
 * rufen sie auf dem Server auf.
 */

// Bestätigen je IP — nur gegen Schleifen; raten lässt sich ein signierter
// Token nicht. Wie alle Speicher-Grenzen nur in Produktion und je Instanz.
const bestaetigenJeIp = createRateLimiter({ max: 10, windowMs: 60_000 })

export type ErneutAntwort = { ok: true; schonBestaetigt?: true } | { error: string; warteSekunden?: number }

/**
 * Schickt den Bestätigungs-Link noch einmal — nur an das angemeldete Konto,
 * nur wenn es bestätigen muss und noch nicht bestätigt hat (frisch aus der
 * Datenbank), und nur so oft, wie die Bremse lässt (ERNEUT_SENDEN, je Konto
 * über alle Instanzen). Die Mail selbst geht über den Versand-Callback in
 * src/lib/auth.ts nach der Antwort raus.
 */
export async function sendeBestaetigungErneut(): Promise<ErneutAntwort> {
  const anfrage = await headers()
  const sitzung = await auth.api.getSession({ headers: anfrage })
  if (!sitzung?.user) return { error: 'Bitte melde dich an, dann schicken wir dir den Link noch einmal.' }

  const stand = await ladeBestaetigungsStand(sitzung.user.id)
  if (!stand) return { error: 'Bitte melde dich an, dann schicken wir dir den Link noch einmal.' }
  if (stand.emailVerified) return { ok: true, schonBestaetigt: true }
  if (!stand.pflichtig) return { error: ERNEUT_KEINE_PFLICHT_TEXT }

  const platz = await reserviereBestaetigungsVersand(sitzung.user.id)
  if (!platz.ok) return { error: erneutWarteText(platz.warteSekunden), warteSekunden: platz.warteSekunden }

  try {
    // Mit der Sitzung der Anfrage: Better Auth schickt dann nur an das
    // angemeldete Konto (Adresse muss passen). Die Adresse aus der Datenbank,
    // nicht aus dem Cookie.
    await auth.api.sendVerificationEmail({ body: { email: stand.email }, headers: anfrage })
  } catch (err) {
    // Nur die Art des Fehlers — sein Text kann die Adresse tragen.
    const meldung = new Error('Bestätigungs-Mail nicht angestoßen')
    meldung.name = err instanceof Error ? err.name : 'Unbekannt'
    Sentry.captureException(meldung, { tags: { aufgabe: 'email-bestaetigung', grund: 'anstossen' } })
    return { error: ERNEUT_VERSAND_FEHLER_TEXT }
  }
  return { ok: true }
}

export type BestaetigenAntwort = { ok: true } | { error: string; code: 'ABGELAUFEN' | 'UNGUELTIG' | 'ZU_VIELE' }

/**
 * Bestätigt die Adresse mit dem Token aus der Mail — per Knopf (POST), nie
 * beim Öffnen des Links (ARCHITECTURE §5). Ohne Sitzung: Der Token beweist
 * das Postfach, eine Anmeldung entsteht dabei nicht
 * (`autoSignInAfterVerification` ist aus).
 */
export async function bestaetigeEmail(input: unknown): Promise<BestaetigenAntwort> {
  const geprueft = emailBestaetigenSchema.safeParse(input)
  if (!geprueft.success) return { error: BESTAETIGEN_UNGUELTIG_TEXT, code: 'UNGUELTIG' }

  if (process.env.NODE_ENV === 'production' && !bestaetigenJeIp.check(getClientIp(await headers()))) {
    return { error: 'Das waren gerade zu viele Versuche. Warte eine Minute und probier es dann noch einmal.', code: 'ZU_VIELE' }
  }

  try {
    await auth.api.verifyEmail({ query: { token: geprueft.data.token } })
  } catch (err) {
    return fehlerCodeVon(err) === 'TOKEN_EXPIRED'
      ? { error: BESTAETIGEN_ABGELAUFEN_TEXT, code: 'ABGELAUFEN' }
      : { error: BESTAETIGEN_UNGUELTIG_TEXT, code: 'UNGUELTIG' }
  }

  revalidatePath('/onboarding')
  revalidatePath('/verify')
  revalidatePath('/admin')
  return { ok: true }
}
