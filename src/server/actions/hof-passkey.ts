'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { FRISCH_FEHLER, hofFrisch } from '@/lib/admin-anmeldung'
import { HOF_PASSKEY_TEXT, PASSKEY_NAME_MAX } from '@/lib/hof-passkey'

/*
 * Passkeys der Höfe verwalten (Register E7, Ergänzung; Nr. 179) — der eigene,
 * geprüfte Weg statt /passkey/delete-passkey und /passkey/update-passkey (die
 * bleiben in disabledPaths, src/lib/auth.ts). Nur ein Hof (Rolle FARMER) ohne
 * Admin-Recht: Ein Admin mit Hof verwaltet seine Passkeys nach N20 in
 * src/server/actions/admin-anmeldung.ts. Gelöscht und umbenannt werden nur
 * eigene Zeilen (userId in der WHERE). Entfernen und die Prüfung vor dem
 * Einrichten verlangen eine frische Sitzung (hofFrisch); Umbenennen ändert
 * nur den Namen in der Liste und braucht keine.
 */

export type HofPasskeyAntwort = { ok: true } | { error: string }

type HofSitzung = { userId: string; frisch: boolean }

/** Die eigene Sitzung eines Hofs ohne Admin-Recht — Rolle und Recht frisch aus der Datenbank. */
async function hofSitzung(): Promise<HofSitzung | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null
  const konto = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true, isAdmin: true } })
  if (konto?.role !== 'FARMER' || konto.isAdmin) return null
  const frisch = hofFrisch(
    { angemeldetAm: session.session.createdAt, anmeldeart: session.session.anmeldeart ?? null, passkeyAm: session.session.passkeyAm ?? null },
    new Date()
  )
  return { userId: session.user.id, frisch }
}

/**
 * Vor „Auf diesem Handy einrichten": Ist die Sitzung frisch? Sonst `frisch`
 * (FRISCH_FEHLER, wie bei Admins: useFrischBestaetigt öffnet den Dialog) — die
 * Karte bietet Bestätigen mit Passkey bzw. Neu-Anmelden an. Verbindlich
 * prüft danach hooks.before in src/lib/auth.ts (registrierungsFall).
 */
export async function pruefeFrischFuerHofPasskey(): Promise<HofPasskeyAntwort> {
  const sitzung = await hofSitzung()
  if (!sitzung) return { error: HOF_PASSKEY_TEXT.nichtErlaubt }
  return sitzung.frisch ? { ok: true } : { error: FRISCH_FEHLER }
}

const idSchema = z.string().min(1).max(200)
const entfernenSchema = z.object({ id: idSchema })

/** Entfernt einen eigenen Passkey (frisch). Auch den letzten: Das Passwort bleibt als Ersatz. */
export async function entferneHofPasskey(eingabe: unknown): Promise<HofPasskeyAntwort> {
  const sitzung = await hofSitzung()
  if (!sitzung) return { error: HOF_PASSKEY_TEXT.nichtErlaubt }
  const v = entfernenSchema.safeParse(eingabe)
  if (!v.success) return { error: HOF_PASSKEY_TEXT.fehlt }
  if (!sitzung.frisch) return { error: FRISCH_FEHLER }
  const { count } = await prisma.passkey.deleteMany({ where: { id: v.data.id, userId: sitzung.userId } })
  if (count !== 1) return { error: HOF_PASSKEY_TEXT.fehlt }
  revalidatePath('/settings/account')
  return { ok: true }
}

const umbenennenSchema = z.object({ id: idSchema, name: z.string().trim().min(1, HOF_PASSKEY_TEXT.nameLeer).max(PASSKEY_NAME_MAX, HOF_PASSKEY_TEXT.nameZuLang) })

/** Gibt einem eigenen Passkey einen Namen — ohne /passkey/update-passkey freizuschalten. */
export async function benenneHofPasskeyUm(eingabe: unknown): Promise<HofPasskeyAntwort> {
  const sitzung = await hofSitzung()
  if (!sitzung) return { error: HOF_PASSKEY_TEXT.nichtErlaubt }
  const v = umbenennenSchema.safeParse(eingabe)
  // Ein falscher Name bekommt seinen Satz, eine kaputte Kennung den allgemeinen.
  if (!v.success) return { error: v.error.issues.find((f) => f.path[0] === 'name')?.message ?? HOF_PASSKEY_TEXT.fehlt }
  const { count } = await prisma.passkey.updateMany({ where: { id: v.data.id, userId: sitzung.userId }, data: { name: v.data.name } })
  if (count !== 1) return { error: HOF_PASSKEY_TEXT.fehlt }
  revalidatePath('/settings/account')
  return { ok: true }
}
