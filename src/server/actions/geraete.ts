'use server'

import * as Sentry from '@sentry/nextjs'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { EINMAL_LINK_ART, einmalTokenSchema } from '@/lib/geraete'
import { loeseEinmalLinkEin } from '@/server/geraete'

/*
 * Angemeldete Geräte abmelden und „Das war ich nicht" (Register E7,
 * Ergänzung Lauf 17; Nr. 114). Gelöscht werden nur Sitzungen des Kontos, dem
 * die Sitzung bzw. der Link gehört — der Besitz steht in der WHERE-Klausel,
 * nie in einem vorgelagerten if. Die Sitzung wird frisch gelesen (kein
 * Cookie-Cache, src/lib/auth.ts): Wer gerade abgemeldet wurde, kann hier
 * nichts mehr tun.
 */

const KONTO_HREF = '/settings/account'
const NEU_ANMELDEN = 'Bitte melde dich neu an.'

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
  revalidatePath(KONTO_HREF)
  return { ok: true, abgemeldet: count }
}

/** Meldet alle anderen Geräte ab — die eigene Sitzung bleibt. */
export async function meldeAlleAnderenAb(): Promise<AbmeldenAntwort> {
  const sitzung = await auth.api.getSession({ headers: await headers() })
  if (!sitzung?.user) return { error: NEU_ANMELDEN }

  const { count } = await prisma.session.deleteMany({
    where: { userId: sitzung.user.id, id: { not: sitzung.session.id } },
  })
  revalidatePath(KONTO_HREF)
  return { ok: true, abgemeldet: count }
}

export type NichtIchAntwort = { ok: true; passwortMail: boolean } | { error: 'ungueltig' }

const nichtIchSchema = z.object({ token: einmalTokenSchema })

/**
 * „Das war ich nicht" (Knopf auf /sicherheit/nicht-ich, POST) — OHNE
 * Anmeldung: Der Link aus der Mail ist der Ausweis (7 Tage, einmal). Löst ihn
 * in einem bedingten Schreiben ein, meldet ALLE Geräte des Kontos ab, dem der
 * Link gehört, und schickt einen Link für ein neues Passwort (Better Auth,
 * auf dem Server; die Mail geht nach der Antwort). Ungültig, benutzt oder
 * abgelaufen: ein neutraler Satz, nichts passiert.
 */
export async function meldeAllesAbNichtIch(eingabe: unknown): Promise<NichtIchAntwort> {
  const v = nichtIchSchema.safeParse(eingabe)
  if (!v.success) return { error: 'ungueltig' }
  const link = await loeseEinmalLinkEin(v.data.token, EINMAL_LINK_ART.nichtIch, new Date())
  if (!link) return { error: 'ungueltig' }

  await prisma.session.deleteMany({ where: { userId: link.userId } })
  revalidatePath(KONTO_HREF)

  // Die Adresse frisch aus der Datenbank, nie aus der Anfrage.
  const konto = await prisma.user.findUnique({ where: { id: link.userId }, select: { email: true } })
  if (!konto) return { ok: true, passwortMail: false }
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
