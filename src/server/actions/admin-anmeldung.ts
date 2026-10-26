'use server'

import { randomInt } from 'crypto'
import * as Sentry from '@sentry/nextjs'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import { nachDerAntwort } from '@/lib/nach-der-antwort'
import { createRateLimiter } from '@/lib/rate-limit'
import { DB_BREMSEN } from '@/lib/bremse-datenbank'
import { einmalLinkZweck, geraetName } from '@/lib/geraete'
import {
  ADMIN_AKTION_FEHLER,
  ADMIN_ANMELDEN_FEHLER,
  ADMIN_PFAD,
  ANMELDEART,
  EINRICHTEN_SITZUNG_MINUTEN,
  EINRICHTEN_TEXT,
  EINRICHTUNGSCODE_ART,
  EINRICHTUNGSCODE_GUELTIG_MINUTEN,
  EINRICHTUNGSCODE_STELLEN,
  REGISTRIERUNG_GESPERRT,
  adminPasskeyWo,
  einrichtenOffen,
  istAdminPasskey,
  type AdminSicherheitAnlass,
} from '@/lib/admin-anmeldung'
import { ersatzcodeHash, erzeugeErsatzcodes } from '@/lib/ersatzcodes'
import { einmalTokenHash, loeseEinmalLinkEin } from '@/server/geraete'
import { adminBremseVoll } from '@/server/admin-bremse'
import { verlangeAdminAktion, verlangeFrischeBestaetigung } from '@/server/admin-wache'

/*
 * Die Actions der Admin-Anmeldung (Register N20, Ergänzung Lauf 18; Nr. 115):
 * E-Mail-Code der Einrichtung schicken und prüfen, Ersatzcodes erstellen,
 * Passkey entfernen und die frische Bestätigung vor „Passkey hinzufügen".
 * Einrichten selbst läuft über Better Auth (/passkey/*, Fälle a–c in
 * src/lib/auth.ts). Die Actions der Pflichtseite gehen ohne Passkey
 * (`ohnePasskey`), alles andere frisch bestätigt. Gelöscht werden nur eigene
 * Zeilen: ersetzte Ersatzcodes und eigene Passkeys, nie der letzte.
 */

const MINUTE_MS = 60_000
const EINRICHTEN_PFADE = [ADMIN_PFAD.einrichten, ADMIN_PFAD.anmeldung] as const

function neuLaden(): void {
  for (const pfad of EINRICHTEN_PFADE) revalidatePath(pfad)
}

/** Die eigene Sitzung samt Anmeldeart, frisch gelesen — nach der Wache. */
async function eigeneSitzung(): Promise<{ userId: string; sitzungId: string; angemeldetAm: Date; anmeldeart: string | null } | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null
  return { userId: session.user.id, sitzungId: session.session.id, angemeldetAm: session.session.createdAt, anmeldeart: session.session.anmeldeart ?? null }
}

/** Die Einrichtung mit E-Mail-Code geht nur für den ersten Passkey, in einer Sitzung mit Passwort (höchstens 15 Minuten) und im 24-Stunden-Fenster. */
function einrichtenMitCodeErlaubt(sitzung: { angemeldetAm: Date; anmeldeart: string | null }, adminSeit: Date | null, passkeys: number, jetzt: Date): boolean {
  const alter = jetzt.getTime() - sitzung.angemeldetAm.getTime()
  return passkeys === 0 && sitzung.anmeldeart === ANMELDEART.passwort && alter >= 0 && alter <= EINRICHTEN_SITZUNG_MINUTEN * MINUTE_MS && einrichtenOffen(adminSeit, jetzt)
}

/** Der Text, über den der Code gehasht wird: Zweck (mit Sitzung), Konto und Code (Freigabe §21 Punkt 3). */
function codeText(zweck: string, userId: string, code: string): string {
  return `${zweck}|${userId}|${code}`
}

/** Mail an das eigene Konto nach der Antwort; wirft nie, Fehler nur mit Art nach Sentry. */
function schickeSicherheitsMail(userId: string, anlass: AdminSicherheitAnlass, userAgent: string | null, zeitpunkt: Date, code?: string): void {
  nachDerAntwort(async () => {
    try {
      const konto = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
      if (!konto) return
      const { sendAdminSicherheitEmail } = await import('@/lib/email')
      const ergebnis = await sendAdminSicherheitEmail(konto.email, anlass, { geraet: geraetName(userAgent), zeitpunkt, code })
      if (ergebnis.error && process.env.RESEND_API_KEY) {
        Sentry.captureMessage('Mail „Admin-Sicherheit" nicht verschickt', { level: 'error', tags: { aufgabe: 'admin-sicherheit', anlass, grund: 'resend_fehler' } })
      }
      // Der Code steht nie im Log, auch lokal nicht (Freigabe §2): Ohne
      // RESEND_API_KEY schreibt sendRaw nur Betreff und Empfänger.
    } catch (err) {
      const meldung = new Error('Mail „Admin-Sicherheit" nicht verschickt')
      meldung.name = err instanceof Error ? err.name : 'Unbekannt'
      Sentry.captureException(meldung, { tags: { aufgabe: 'admin-sicherheit', anlass, grund: 'nachlauf_fehler' } })
    }
  })
}

// Je Konto drei Codes in zehn Minuten — wie alle Speicher-Grenzen nur in
// Produktion und je Instanz; die Mail geht ohnehin nur an die eigene Adresse.
const codeVersandJeKonto = createRateLimiter({ max: 3, windowMs: 10 * MINUTE_MS })

export type AktionsAntwort = { ok: true } | { error: string }

/**
 * Schickt den E-Mail-Code der Einrichtung (6 Ziffern, 10 Minuten) an die
 * eigene Adresse — nur für den ersten Passkey in einer frischen Sitzung mit
 * Passwort. Gespeichert wird nur der HMAC (EinmalLink, Zweck mit der
 * Sitzung); frühere Codes dieser Sitzung laufen sofort ab.
 */
export async function schickeEinrichtungscode(): Promise<AktionsAntwort> {
  const wache = await verlangeAdminAktion({ ohnePasskey: true })
  if ('error' in wache) return wache
  const sitzung = await eigeneSitzung()
  if (!sitzung) return { error: 'Nicht angemeldet.' }
  const jetzt = new Date()
  const konto = await prisma.user.findUnique({ where: { id: sitzung.userId }, select: { adminSeit: true } })
  const adminSeit = konto?.adminSeit ?? null
  // Nur Passkeys aus der Admin-Einrichtung zählen (Nr. 179): Ein Hof-Passkey von vorher ersetzt den ersten nicht.
  const passkeys = await prisma.passkey.count({ where: { userId: sitzung.userId, ...adminPasskeyWo(adminSeit) } })
  if (!einrichtenMitCodeErlaubt(sitzung, adminSeit, passkeys, jetzt)) return { error: REGISTRIERUNG_GESPERRT }
  if (process.env.NODE_ENV === 'production' && !codeVersandJeKonto.check(sitzung.userId)) return { error: ADMIN_ANMELDEN_FEHLER.zuViele }

  const zweck = einmalLinkZweck(EINRICHTUNGSCODE_ART, sitzung.sitzungId)
  const code = String(randomInt(0, 10 ** EINRICHTUNGSCODE_STELLEN)).padStart(EINRICHTUNGSCODE_STELLEN, '0')
  await prisma.$transaction([
    prisma.einmalLink.updateMany({ where: { userId: sitzung.userId, zweck, benutztAm: null }, data: { ablaufAm: jetzt } }),
    prisma.einmalLink.create({
      data: {
        userId: sitzung.userId,
        zweck,
        tokenHash: einmalTokenHash(codeText(zweck, sitzung.userId, code)),
        ablaufAm: new Date(jetzt.getTime() + EINRICHTUNGSCODE_GUELTIG_MINUTEN * MINUTE_MS),
      },
    }),
  ])
  schickeSicherheitsMail(sitzung.userId, 'einrichtungscode', (await headers()).get('user-agent'), jetzt, code)
  neuLaden()
  return { ok: true }
}

const einrichtungscodeSchema = z.object({ code: z.string().trim().regex(/^\d{6}$/) })

/**
 * Prüft den E-Mail-Code der Einrichtung — gebremst je Konto (5 je Stunde,
 * fail-closed) und genau einmal gültig (bedingtes Schreiben). Erst danach
 * lässt hooks.before den ersten Passkey zu (Fall a).
 */
export async function pruefeEinrichtungscode(eingabe: unknown): Promise<AktionsAntwort> {
  const v = einrichtungscodeSchema.safeParse(eingabe)
  if (!v.success) return { error: EINRICHTEN_TEXT.codeFalsch }
  const wache = await verlangeAdminAktion({ ohnePasskey: true })
  if ('error' in wache) return wache
  const sitzung = await eigeneSitzung()
  if (!sitzung) return { error: 'Nicht angemeldet.' }
  if (await adminBremseVoll(DB_BREMSEN.adminEinrichtungscode, sitzung.userId)) return { error: ADMIN_ANMELDEN_FEHLER.zuViele }

  const zweck = einmalLinkZweck(EINRICHTUNGSCODE_ART, sitzung.sitzungId)
  const treffer = await loeseEinmalLinkEin(codeText(zweck, sitzung.userId, v.data.code), EINRICHTUNGSCODE_ART, new Date())
  if (!treffer || treffer.userId !== sitzung.userId || treffer.zweck !== zweck) return { error: EINRICHTEN_TEXT.codeFalsch }
  neuLaden()
  return { ok: true }
}

export type ErsatzcodesAntwort = { ok: true; codes: string[] } | { error: string }

/**
 * Erstellt 10 neue Ersatzcodes (frisch bestätigt): Die unbenutzten alten
 * werden gelöscht — benutzte bleiben als Zeitpunkt stehen, denn nach einem
 * Ersatzcode ist ein neuer Passkey Pflicht. Die Codes gehen genau einmal an
 * die Oberfläche; in der Datenbank steht nur ihr HMAC.
 */
export async function erstelleErsatzcodes(): Promise<ErsatzcodesAntwort> {
  const frisch = await verlangeFrischeBestaetigung({ ohnePasskey: true })
  if ('error' in frisch) return frisch
  const konto = await prisma.user.findUnique({ where: { id: frisch.userId }, select: { adminSeit: true } })
  const passkeys = await prisma.passkey.count({ where: { userId: frisch.userId, ...adminPasskeyWo(konto?.adminSeit ?? null) } })
  if (passkeys === 0) return { error: ADMIN_AKTION_FEHLER.pflicht }

  const codes = erzeugeErsatzcodes()
  const hashes = await Promise.all(codes.map((code) => ersatzcodeHash(env.BETTER_AUTH_SECRET, frisch.userId, code)))
  await prisma.$transaction([
    prisma.adminErsatzcode.deleteMany({ where: { userId: frisch.userId, benutztAm: null } }),
    prisma.adminErsatzcode.createMany({ data: hashes.map((codeHash) => ({ userId: frisch.userId, codeHash })) }),
  ])
  neuLaden()
  return { ok: true, codes }
}

const passkeyEntfernenSchema = z.object({ id: z.string().min(1).max(200) })

/**
 * Entfernt einen eigenen Passkey (frisch bestätigt), nie den letzten aus der
 * Admin-Einrichtung (Nr. 179: ein Hof-Passkey von vor dem Recht zählt nicht
 * mit und darf immer gehen). Zwei Tabs, die gleichzeitig je einen der letzten
 * zwei entfernen, dürfen nicht beide durchkommen: Die Kontozeile wird in der
 * Transaktion per echtem UPDATE gesperrt, erst dann gezählt und gelöscht
 * (CODING_STANDARDS §4).
 */
export async function entfernePasskey(eingabe: unknown): Promise<AktionsAntwort> {
  const frisch = await verlangeFrischeBestaetigung()
  if ('error' in frisch) return frisch
  const v = passkeyEntfernenSchema.safeParse(eingabe)
  if (!v.success) return { error: ADMIN_AKTION_FEHLER.passkeyFehlt }

  const userId = frisch.userId
  const ergebnis = await prisma.$transaction(async (tx) => {
    const { adminSeit } = await tx.user.update({ where: { id: userId }, data: { updatedAt: new Date() }, select: { adminSeit: true } })
    const ziel = await tx.passkey.findFirst({ where: { id: v.data.id, userId }, select: { createdAt: true } })
    if (!ziel) return 'fehlt' as const
    const anzahl = await tx.passkey.count({ where: { userId, ...adminPasskeyWo(adminSeit) } })
    if (istAdminPasskey(ziel.createdAt, adminSeit) && anzahl <= 1) return 'letzter' as const
    const { count } = await tx.passkey.deleteMany({ where: { id: v.data.id, userId } })
    return count === 1 ? ('entfernt' as const) : ('fehlt' as const)
  })
  if (ergebnis === 'letzter') return { error: ADMIN_AKTION_FEHLER.letzterPasskey }
  if (ergebnis === 'fehlt') return { error: ADMIN_AKTION_FEHLER.passkeyFehlt }
  schickeSicherheitsMail(userId, 'passkey-entfernt', (await headers()).get('user-agent'), new Date())
  neuLaden()
  return { ok: true }
}

/**
 * Vor „+ Passkey hinzufügen": Ist die Sitzung frisch bestätigt? Sonst
 * `{ error: 'frisch' }` — useFrischBestaetigt öffnet den Dialog, danach legt
 * der Browser den Passkey an (Fall c in src/lib/auth.ts).
 */
export async function pruefeFrischFuerPasskey(): Promise<AktionsAntwort> {
  const frisch = await verlangeFrischeBestaetigung()
  if ('error' in frisch) return frisch
  return { ok: true }
}
