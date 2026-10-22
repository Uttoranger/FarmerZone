'use server'

import { headers } from 'next/headers'
import { revalidatePath, updateTag } from 'next/cache'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getOpenOrdersCount } from '@/server/queries/orders'
import { GRUENDUNGSPLAETZE_SPERRE } from '@/lib/gruendungshof'
import { HOEFE_CACHE_TAG } from '@/lib/hofuebersicht'

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
  // Die Hofliste (/hoefe, Startseite) zeigt nur Höfe, die nicht stillgelegt sind — aus ihrem Zwischenspeicher.
  updateTag(HOEFE_CACHE_TAG)
  return {}
}

/**
 * Hof wieder aktivieren — archivedAt zurück auf null. isPaused bleibt unberührt.
 *
 * SPERRE (Register K2, Änderung Nr. 116): Vor dem Festschreiben bringt das
 * Wieder-Aktivieren den Hof mit seinem alten Rang zurück in die Vergabe der
 * Gründungsplätze — deshalb unter GRUENDUNGSPLAETZE_SPERRE, in einer
 * Transaktion, wie Freischalten und Ausnehmen: kein anderer Weg vergibt
 * gleichzeitig. Am Platz ändert sich nichts — ein festgeschriebener Platz
 * bleibt beim Stilllegen am Hof, und niemand anderes verliert ihn dadurch.
 */
export async function reactivateFarm(): Promise<ArchiveResult> {
  const farm = await getAuthFarm()
  if (!farm) return { error: 'Nicht angemeldet' }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${GRUENDUNGSPLAETZE_SPERRE})`
    await tx.farm.update({
      where: { id: farm.id },
      data: { archivedAt: null },
    })
  })

  revalidatePath('/settings/account')
  revalidatePath('/', 'layout')
  revalidatePath(`/${farm.slug}`)
  // Die Hofliste (/hoefe, Startseite) zeigt nur Höfe, die nicht stillgelegt sind — aus ihrem Zwischenspeicher.
  updateTag(HOEFE_CACHE_TAG)
  return {}
}
