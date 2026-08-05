'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * Admin-Recht IMMER frisch aus der Datenbank lesen, nie aus der Session:
 * `isAdmin` steckt bewusst nicht in den Better-Auth-additionalFields, damit
 * ein zurückgenommenes Recht sofort greift und nicht bis zum Ablauf des
 * Session-Cookies weiterwirkt.
 *
 * Diese Prüfung sitzt in JEDER Action — nicht nur in der Seite. Eine Seite
 * schützt die Ansicht, eine Action schützt die Wirkung.
 */
async function requireAdmin(): Promise<{ ok: true } | { error: string }> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return { error: 'Nicht angemeldet.' }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  })
  if (!user?.isAdmin) return { error: 'Kein Zugriff.' }

  return { ok: true }
}

function revalidateAll(slug: string) {
  revalidatePath('/admin')
  revalidatePath(`/${slug}`)
}

/** Hof freischalten: ab jetzt öffentlich sichtbar und bestellbar. */
export async function approveFarmAction(farmId: string): Promise<{ error?: string }> {
  const guard = await requireAdmin()
  if ('error' in guard) return { error: guard.error }

  const farm = await prisma.farm.findUnique({ where: { id: farmId }, select: { slug: true } })
  if (!farm) return { error: 'Hof nicht gefunden.' }

  await prisma.farm.update({ where: { id: farmId }, data: { approvedAt: new Date() } })
  revalidateAll(farm.slug)
  return {}
}

/**
 * Freigabe zurücknehmen: die Hofseite verschwindet wieder, Bestellungen werden
 * abgelehnt. Es wird NICHTS gelöscht — der Bauer behält Zugang zu allen Daten.
 */
export async function revokeFarmApprovalAction(farmId: string): Promise<{ error?: string }> {
  const guard = await requireAdmin()
  if ('error' in guard) return { error: guard.error }

  const farm = await prisma.farm.findUnique({ where: { id: farmId }, select: { slug: true } })
  if (!farm) return { error: 'Hof nicht gefunden.' }

  await prisma.farm.update({ where: { id: farmId }, data: { approvedAt: null } })
  revalidateAll(farm.slug)
  return {}
}
