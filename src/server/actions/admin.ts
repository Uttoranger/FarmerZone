'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { istAdmin } from '@/server/queries/admin'

export type AdminResult = { error?: string }

/**
 * Die Actions prüfen das Betreiber-Recht SELBST und verlassen sich nicht auf
 * die Seite. Eine Server-Action ist ein eigener Endpunkt — wer ihre ID kennt,
 * ruft sie ohne Umweg über /admin auf.
 */
async function requireAdmin(): Promise<{ ok: true } | { error: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: 'Nicht angemeldet' }
  if (!(await istAdmin(session.user.id))) return { error: 'Keine Berechtigung' }
  return { ok: true }
}

function revalidate(slug: string) {
  revalidatePath('/admin')
  revalidatePath('/', 'layout')
  revalidatePath(`/${slug}`)
}

/** Hof freischalten — ab jetzt öffentlich sichtbar und bestellbar. */
export async function freischaltenAction(farmId: string): Promise<AdminResult> {
  const erlaubnis = await requireAdmin()
  if ('error' in erlaubnis) return erlaubnis

  const farm = await prisma.farm.findUnique({ where: { id: farmId }, select: { slug: true, approvedAt: true } })
  if (!farm) return { error: 'Hof nicht gefunden' }
  if (farm.approvedAt) return {}

  await prisma.farm.update({ where: { id: farmId }, data: { approvedAt: new Date() } })
  revalidate(farm.slug)
  return {}
}

/**
 * Freigabe zurücknehmen — der Hof ist wieder öffentlich unsichtbar.
 * Es wird nichts gelöscht; der Bauer behält Zugriff auf alle seine Daten.
 */
export async function freigabeZuruecknehmenAction(farmId: string): Promise<AdminResult> {
  const erlaubnis = await requireAdmin()
  if ('error' in erlaubnis) return erlaubnis

  const farm = await prisma.farm.findUnique({ where: { id: farmId }, select: { slug: true } })
  if (!farm) return { error: 'Hof nicht gefunden' }

  await prisma.farm.update({ where: { id: farmId }, data: { approvedAt: null } })
  revalidate(farm.slug)
  return {}
}
