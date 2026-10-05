import 'server-only'
import { createHmac, randomInt, timingSafeEqual } from 'crypto'
import { env } from '@/lib/env'
import { ANMELDECODE_LAENGE } from '@/lib/anmeldecode'
import { BESTELLUNGEN_ANSICHT_SEKUNDEN } from '@/lib/bestellungen-finden'
import { emailSchema } from '@/schemas/email'

/*
 * Die Geheimnisse von „Bestellungen finden" (Nr. 14): Hash des Codes und der
 * signierte Cookie mit der bewiesenen Adresse. Dasselbe HMAC-Muster wie
 * src/lib/bestell-link.ts (Geheimnis aus dem validierten env-Modul,
 * Hex-Signatur, Vergleich in konstanter Zeit), je Zweck ein eigenes Präfix —
 * eine Signatur für die Bestellseite gilt nie als Cookie und umgekehrt.
 */
const SECRET = env.BETTER_AUTH_SECRET
const ZWECK_CODE = 'bestellungen-finden-code'
const ZWECK_COOKIE = 'bestellungen-finden-cookie'

function hmac(text: string): string {
  return createHmac('sha256', SECRET).update(text).digest('hex')
}

function gleich(a: string, b: string): boolean {
  const pa = Buffer.from(a, 'utf8')
  const pb = Buffer.from(b, 'utf8')
  if (pa.length !== pb.length) return false
  return timingSafeEqual(pa, pb)
}

/** 6 Ziffern aus dem Zufallsgenerator des Betriebssystems, mit führenden Nullen. */
export function erzeugeBestellCode(): string {
  return String(randomInt(0, 10 ** ANMELDECODE_LAENGE)).padStart(ANMELDECODE_LAENGE, '0')
}

/**
 * Der Code, wie er in der Datenbank steht: HMAC mit dem Geheimnis und der
 * Adresse. Anders als der ungesalzene Hash des Anmelde-Plugins lässt er sich
 * aus einer gelesenen Tabelle nicht zurückrechnen (10^6 Codes wären sonst in
 * Sekunden durchprobiert), und ein Code gilt nur für seine Adresse.
 */
export function hashBestellCode(email: string, code: string): string {
  return hmac(`${ZWECK_CODE}:${email}:${code}`)
}

export function bestellCodePasst(email: string, code: string, gespeicherterHash: string): boolean {
  return gleich(hashBestellCode(email, code), gespeicherterHash)
}

/**
 * Der Cookie-Wert: „<adresse base64url>.<ablauf in s>.<signatur>". Die Adresse
 * steht base64url-kodiert, weil sie selbst Punkte trägt. Signiert sind Adresse
 * UND Ablauf — wer den Ablauf verlängert oder die Adresse tauscht, bricht die
 * Signatur. Die Adresse ist im Cookie lesbar, aber nur für dieses Gerät
 * (httpOnly, nur der Pfad der Seite) — dieselbe Adresse, die die Kundin gerade
 * selbst eingetippt hat.
 */
export function bestellZugangsToken(email: string, jetzt: Date): string {
  const ablauf = Math.floor(jetzt.getTime() / 1000) + BESTELLUNGEN_ANSICHT_SEKUNDEN
  return `${Buffer.from(email, 'utf8').toString('base64url')}.${ablauf}.${hmac(`${ZWECK_COOKIE}:${email}:${ablauf}`)}`
}

export type BestellZugang = { art: 'gueltig'; email: string } | { art: 'abgelaufen' } | { art: 'keiner' }

/**
 * Liest den Cookie. Zuerst die Signatur, dann der Ablauf: Ein manipulierter
 * Cookie ist „keiner", auch wenn er abgelaufen wäre — nur ein echter,
 * abgelaufener Cookie bekommt den Hinweis „neu bestätigen". Die Frist gilt
 * beim Lesen, nicht über das Ablaufdatum des Browsers.
 */
export function leseBestellZugang(roh: string | undefined, jetzt: Date): BestellZugang {
  if (!roh) return { art: 'keiner' }
  const teile = roh.split('.')
  if (teile.length !== 3) return { art: 'keiner' }
  const [adresseKodiert, ablaufText, signatur] = teile
  if (!/^\d{1,12}$/.test(ablaufText)) return { art: 'keiner' }
  const email = Buffer.from(adresseKodiert, 'base64url').toString('utf8')
  if (!gleich(hmac(`${ZWECK_COOKIE}:${email}:${ablaufText}`), signatur)) return { art: 'keiner' }
  // Signiert heißt: vom Server so ausgegeben. Trotzdem nur eine Adresse in
  // genau der gespeicherten Form annehmen — die Abfrage bekommt nie etwas anderes.
  const geprueft = emailSchema().safeParse(email)
  if (!geprueft.success || geprueft.data !== email) return { art: 'keiner' }
  if (Number(ablaufText) * 1000 <= jetzt.getTime()) return { art: 'abgelaufen' }
  return { art: 'gueltig', email }
}
