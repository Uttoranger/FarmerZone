'use server'

import * as Sentry from '@sentry/nextjs'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createRateLimiter, getClientIp } from '@/lib/rate-limit'
import { EINMAL_LINK_ART, NICHT_ICH_JE_MINUTE, einmalTokenSchema } from '@/lib/geraete'
import { loeseEinmalLinkEin } from '@/server/geraete'

/*
 * Angemeldete Geräte abmelden und „Das war ich nicht" (Register E7,
 * Ergänzung Lauf 17; Nr. 114). Gelöscht werden nur Sitzungen des Kontos, dem
 * die Sitzung bzw. der Link gehört — der Besitz steht in der WHERE-Klausel,
 * nie in einem vorgelagerten if. Die Sitzung wird frisch gelesen (kein
 * Cookie-Cache, src/lib/auth.ts): Wer gerade abgemeldet wurde, kann hier
 * nichts mehr tun.
 */

const NEU_ANMELDEN = 'Bitte melde dich neu an.'
const NUR_KUNDINNEN = 'Das geht nur unter „Mein Konto".'

/**
 * Die Seite, die die Liste zeigt — nach der Rolle aus der Sitzung (Nr. 178):
 * Höfe „Konto und Sicherheit", Kundinnen „Mein Konto". Admin › Einstellungen
 * › Anmeldung lädt selbst neu (router.refresh im Baustein). Die Rolle wählt
 * nur die Seite; was gelöscht wird, bestimmt allein das Konto der Sitzung.
 */
function kontoSeite(rolle: unknown): string {
  return rolle === 'CUSTOMER' ? '/account/profile' : '/settings/account'
}

export type AbmeldenAntwort = { ok: true; abgemeldet: number } | { error: string }

const geraetAbmeldenSchema = z.object({ sitzungId: z.string().min(1).max(100) })

/**
 * Meldet ein Gerät ab — nur eine Sitzung des eigenen Kontos. Eine fremde oder
 * schon abgelaufene Kennung trifft keine Zeile (`abgemeldet: 0`), die Liste
 * lädt danach neu.
 */
export async function meldeGeraetAb(eingabe: unknown): Promise<AbmeldenAntwort> {
  const v = geraetAbmeldenSchema.safeParse(eingabe)
  if (!v.success) return { error: 'Dieses Gerät kennen wir nicht.' }
  const sitzung = await auth.api.getSession({ headers: await headers() })
  if (!sitzung?.user) return { error: NEU_ANMELDEN }

  const { count } = await prisma.session.deleteMany({ where: { id: v.data.sitzungId, userId: sitzung.user.id } })
  revalidatePath(kontoSeite(sitzung.user.role))
  return { ok: true, abgemeldet: count }
}

/** Meldet alle anderen Geräte ab — die eigene Sitzung bleibt. */
export async function meldeAlleAnderenAb(): Promise<AbmeldenAntwort> {
  const sitzung = await auth.api.getSession({ headers: await headers() })
  if (!sitzung?.user) return { error: NEU_ANMELDEN }

  const { count } = await prisma.session.deleteMany({
    where: { userId: sitzung.user.id, id: { not: sitzung.session.id } },
  })
  revalidatePath(kontoSeite(sitzung.user.role))
  return { ok: true, abgemeldet: count }
}

/**
 * „Überall abmelden" unter /account (Register S18; Nr. 178): ALLE Sitzungen
 * des eigenen Kontos, auch diese — danach ist die Kundin auch hier
 * abgemeldet und landet auf der Anmeldung (der Baustein führt hin). Nur für
 * Kundinnen: Ein Hof behält „Alle anderen abmelden", damit er am Gerät, an
 * dem er gerade arbeitet, angemeldet bleibt.
 */
export async function meldeUeberallAb(): Promise<AbmeldenAntwort> {
  const sitzung = await auth.api.getSession({ headers: await headers() })
  if (!sitzung?.user) return { error: NEU_ANMELDEN }
  if (sitzung.user.role !== 'CUSTOMER') return { error: NUR_KUNDINNEN }

  const { count } = await prisma.session.deleteMany({ where: { userId: sitzung.user.id } })
  return { ok: true, abgemeldet: count }
}

/** `passkey`: ein Admin mit Passkey (Register N20) — für ihn gibt es keinen Link für ein neues Passwort, die Seite sagt „Melde dich mit deinem Passkey wieder an". */
export type NichtIchAntwort = { ok: true; passwortMail: boolean; passkey?: true } | { error: 'ungueltig' | 'zu-viele' }

// Je IP, wie alle Speicher-Grenzen nur in Produktion und je Instanz
// (ARCHITECTURE §3 „Öffentliche Server Action").
const nichtIchJeIp = createRateLimiter({ max: NICHT_ICH_JE_MINUTE, windowMs: 60_000 })

const nichtIchSchema = z.object({ token: einmalTokenSchema })

/**
 * „Das war ich nicht" (Knopf auf /sicherheit/nicht-ich, POST) — OHNE
 * Anmeldung: Der Link aus der Mail ist der Ausweis (7 Tage, einmal). Löst ihn
 * in einem bedingten Schreiben ein und meldet ALLE Geräte des Kontos ab, dem
 * der Link gehört — beides in EINER Transaktion; danach ein Link für ein
 * neues Passwort (Better Auth, auf dem Server; die Mail geht nach der
 * Antwort). Ungültig, benutzt oder abgelaufen: ein neutraler Satz, nichts
 * passiert.
 */
export async function meldeAllesAbNichtIch(eingabe: unknown): Promise<NichtIchAntwort> {
  const v = nichtIchSchema.safeParse(eingabe)
  if (!v.success) return { error: 'ungueltig' }
  if (process.env.NODE_ENV === 'production' && !nichtIchJeIp.check(getClientIp(await headers()))) return { error: 'zu-viele' }

  // Einlösen und Abmelden stehen und fallen zusammen: Scheitert das Löschen,
  // bleibt der Link gültig und ein zweiter Druck klappt — sonst wäre er
  // verbraucht und die fremden Geräte blieben angemeldet. Der Fehler geht hoch
  // (Sentry), die Karte sagt „Das hat nicht geklappt".
  const link = await prisma.$transaction(async (tx) => {
    const treffer = await loeseEinmalLinkEin(v.data.token, EINMAL_LINK_ART.nichtIch, new Date(), tx)
    if (treffer) await tx.session.deleteMany({ where: { userId: treffer.userId } })
    return treffer
  })
  if (!link) return { error: 'ungueltig' }
  // Kein revalidatePath: Es lüde die Seite /sicherheit/nicht-ich neu, und die
  // fände den Link schon verbraucht. /settings/account liest ohnehin frisch.

  // Die Adresse frisch aus der Datenbank, nie aus der Anfrage.
  const konto = await prisma.user.findUnique({
    where: { id: link.userId },
    select: { email: true, isAdmin: true, _count: { select: { passkeys: true } } },
  })
  if (!konto) return { ok: true, passwortMail: false }
  // Admin mit Passkey (N20, Nr. 115): „Passwort vergessen" schickt ihm nichts
  // — also gar nicht erst anstoßen; er meldet sich mit dem Passkey wieder an.
  if (konto.isAdmin && konto._count.passkeys > 0) return { ok: true, passwortMail: false, passkey: true }
  try {
    await auth.api.requestPasswordReset({ body: { email: konto.email, redirectTo: '/reset-password' } })
    return { ok: true, passwortMail: true }
  } catch (err) {
    // Die Geräte sind abgemeldet, der Link ist verbraucht — die Seite sagt
    // „Passwort vergessen" statt „Mail ist unterwegs". Nur die Art des Fehlers.
    const meldung = new Error('Link für ein neues Passwort nicht angestoßen')
    meldung.name = err instanceof Error ? err.name : 'Unbekannt'
    Sentry.captureException(meldung, { tags: { aufgabe: 'nicht-ich' } })
    return { ok: true, passwortMail: false }
  }
}
