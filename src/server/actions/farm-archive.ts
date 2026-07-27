'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getOpenOrdersCount } from '@/server/queries/orders'

async function getAuthFarm() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null
  return prisma.farm.findUnique({
    where: { ownerId: session.user.id },
    select: { id: true, slug: true, archivedAt: true },
  })
}

export type ArchiveResult = { error?: string; openOrders?: number }

/**
 * Hof stilllegen. Löscht NICHTS — setzt nur archivedAt.
 *
 * Guard: nur möglich, wenn keine offene Bestellung mehr existiert. Sonst
 * bliebe eine Kundin mit einer Bestellung zurück, deren Hofseite nicht mehr
 * erreichbar ist. „Offen" ist bewusst dieselbe Definition wie im Bestell-Badge
 * der Navigation — getOpenOrdersCount/OPEN_STATUSES, keine zweite Wahrheit.
 * Die Zahl offener Bestellungen kommt für den Hinweis mit zurück.
 */
export async function archiveFarm(): Promise<ArchiveResult> {
  const farm = await getAuthFarm()
  if (!farm) return { error: 'Nicht angemeldet' }
  if (farm.archivedAt) return {}

  const openOrders = await getOpenOrdersCount(farm.id)
  if (openOrders > 0) return { openOrders }

  await prisma.farm.update({
    where: { id: farm.id },
    data: { archivedAt: new Date() },
  })

  revalidatePath('/settings/account')
  revalidatePath('/', 'layout')
  revalidatePath(`/${farm.slug}`)
  return {}
}

/** Hof wieder aktivieren — archivedAt zurück auf null. isPaused bleibt unberührt. */
export async function reactivateFarm(): Promise<ArchiveResult> {
  const farm = await getAuthFarm()
  if (!farm) return { error: 'Nicht angemeldet' }

  await prisma.farm.update({
    where: { id: farm.id },
    data: { archivedAt: null },
  })

  revalidatePath('/settings/account')
  revalidatePath('/', 'layout')
  revalidatePath(`/${farm.slug}`)
  return {}
}
