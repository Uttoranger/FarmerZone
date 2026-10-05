'use server'

import * as Sentry from '@sentry/nextjs'
import { cookies, headers } from 'next/headers'
import { createRateLimiter, getClientIp } from '@/lib/rate-limit'
import { ANMELDECODE_RATE_LIMIT } from '@/lib/anmeldecode'
import { erzeugeAnforderungsSperre } from '@/lib/anmeldecode-sperre'
import {
  BESTELLUNGEN_ANSICHT_SEKUNDEN,
  BESTELLUNGEN_COOKIE,
  BESTELLUNGEN_PFAD,
  bestellCodeFehlerText,
} from '@/lib/bestellungen-finden'
import { bestellZugangsToken } from '@/lib/bestellungen-zugang'
import { nachDerAntwort } from '@/lib/nach-der-antwort'
import { bestellCodeAnfordernSchema, bestellCodePruefenSchema } from '@/schemas/bestellungen-finden'
import { legeBestellCodeAn, pruefeBestellCode } from '@/server/bestellungen-finden'

/*
 * „Bestellungen finden" (Nr. 14, E7/E8): Code anfordern, Code prüfen, Ansicht
 * beenden. Öffentlich — die Berechtigung IST der Code: Wer ihn aus der Mail
 * hat, hat bewiesen, dass ihm die Adresse gehört. Danach steht nur diese
 * Adresse im signierten Cookie, kein Konto, keine Better-Auth-Sitzung.
 *
 * Bremsen wie bei der Anmeldung (src/lib/anmeldecode.ts): je IP 3 in der
 * Minute (Anfordern und Prüfen getrennt), je Adresse 5 Codes in 15 Minuten.
 * Wie alle Speicher-Grenzen nur in Produktion und je Instanz; die Grenze über
 * alle Instanzen sind die 5 Versuche je Code in der Datenbank (S4).
 */

const anfordernJeIp = createRateLimiter({ max: ANMELDECODE_RATE_LIMIT.max, windowMs: ANMELDECODE_RATE_LIMIT.window * 1000 })
const pruefenJeIp = createRateLimiter({ max: ANMELDECODE_RATE_LIMIT.max, windowMs: ANMELDECODE_RATE_LIMIT.window * 1000 })
const anfordernJeAdresse = erzeugeAnforderungsSperre()

async function bremst(limiter: ReturnType<typeof createRateLimiter>): Promise<boolean> {
  if (process.env.NODE_ENV !== 'production') return false
  return !limiter.check(getClientIp(await headers()))
}

type Antwort = { ok: true } | { error: string; code: 'EINGABE' | 'ZU_VIELE' }

/**
 * Meldet einen gescheiterten Versand an Sentry — fester Text, nur die Art des
 * Fehlers, nie Adresse oder Code (wie meldeCodeVersandFehler in auth.ts).
 */
function meldeVersandFehler(grund: 'resend_fehler' | 'nachlauf_fehler', err?: unknown): void {
  const kontext = { tags: { aufgabe: 'bestellcode', grund } }
  if (err === undefined) {
    Sentry.captureMessage('Bestellcode-Mail nicht verschickt', { level: 'error', ...kontext })
    return
  }
  const meldung = new Error('Bestellcode-Mail nicht verschickt')
  meldung.name = err instanceof Error ? err.name : 'Unbekannt'
  Sentry.captureException(meldung, kontext)
}

/**
 * Schickt einen Code an die Adresse. Die Antwort ist für JEDE gültige Adresse
 * dieselbe — mit oder ohne Bestellungen, Kundin oder Hof: Niemand erfährt
 * hier, ob unter einer Adresse bestellt wurde. Die Mail geht erst nach der
 * Antwort raus, damit auch die Antwortzeit nichts verrät.
 */
export async function fordereBestellCodeAn(input: unknown): Promise<Antwort> {
  const geprueft = bestellCodeAnfordernSchema.safeParse(input)
  if (!geprueft.success) {
    return { error: geprueft.error.issues[0]?.message ?? 'Bitte gib eine gültige E-Mail-Adresse ein.', code: 'EINGABE' }
  }
  const { email } = geprueft.data

  if (await bremst(anfordernJeIp)) return { error: bestellCodeFehlerText('ZU_VIELE'), code: 'ZU_VIELE' }
  if (process.env.NODE_ENV === 'production' && !anfordernJeAdresse.erlaubt(email)) {
    return { error: bestellCodeFehlerText('ZU_VIELE'), code: 'ZU_VIELE' }
  }

  const code = await legeBestellCodeAn(email)

  nachDerAntwort(async () => {
    try {
      const { sendBestellCodeEmail } = await import('@/lib/email')
      const ergebnis = await sendBestellCodeEmail(email, code)
      if (ergebnis.error) meldeVersandFehler('resend_fehler')
      // Ohne Versand (lokal ohne RESEND_API_KEY) steht der Code im Terminal —
      // nie in Produktion, auch nicht bei einem Resend-Fehler.
      if (!ergebnis.id && process.env.NODE_ENV !== 'production') {
        console.log(`[DEV] Bestellcode für ${email}: ${code}`)
      }
    } catch (err) {
      console.error('[Bestellcode] E-Mail-Fehler:', err instanceof Error ? err.name : 'unbekannt')
      meldeVersandFehler('nachlauf_fehler', err)
    }
  })

  return { ok: true }
}

type PruefAntwort = { ok: true } | { error: string; code: 'EINGABE' | 'ZU_VIELE' | 'INVALID_OTP' | 'OTP_EXPIRED' | 'TOO_MANY_ATTEMPTS' }

/**
 * Prüft den Code und setzt bei Erfolg den Cookie mit der bewiesenen Adresse:
 * httpOnly (kein Skript liest ihn), SameSite=Lax, in Produktion Secure, nur
 * für den Pfad der Seite, 30 Minuten. Das ist alles, was entsteht.
 */
export async function zeigeBestellungen(input: unknown): Promise<PruefAntwort> {
  const geprueft = bestellCodePruefenSchema.safeParse(input)
  if (!geprueft.success) {
    return { error: geprueft.error.issues[0]?.message ?? bestellCodeFehlerText('INVALID_OTP'), code: 'EINGABE' }
  }
  const { email, code } = geprueft.data

  if (await bremst(pruefenJeIp)) return { error: bestellCodeFehlerText('ZU_VIELE'), code: 'ZU_VIELE' }

  const jetzt = new Date()
  const ergebnis = await pruefeBestellCode(email, code, jetzt)
  if (!ergebnis.ok) return { error: bestellCodeFehlerText(ergebnis.fehler), code: ergebnis.fehler }

  const jar = await cookies()
  jar.set({
    name: BESTELLUNGEN_COOKIE,
    value: bestellZugangsToken(email, jetzt),
    maxAge: BESTELLUNGEN_ANSICHT_SEKUNDEN,
    path: BESTELLUNGEN_PFAD,
    sameSite: 'lax',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  })
  return { ok: true }
}

/** „Abmelden": Der Cookie fällt weg, die Liste ist zu. Als Formular-Aktion nutzbar (ohne Skript). */
export async function beendeBestellAnsicht(): Promise<void> {
  const jar = await cookies()
  jar.set({
    name: BESTELLUNGEN_COOKIE,
    value: '',
    maxAge: 0,
    path: BESTELLUNGEN_PFAD,
    sameSite: 'lax',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  })
}
