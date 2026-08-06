'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  FARM_REJECT_APPROVED_MESSAGE,
  FARM_REJECT_HAS_DATA_MESSAGE,
  FARM_REJECT_OWNER_HAS_ORDERS_MESSAGE,
  FARM_REJECT_OWNER_IS_ADMIN_MESSAGE,
} from '@/lib/farm-approval'

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

/**
 * Ablehnen und löschen: entfernt einen WARTENDEN Hof samt Inhaber-Konto.
 * Gegen die Karteileichen, die Bot-Anmeldungen hinterlassen.
 *
 * Abgrenzung zu revokeFarmApprovalAction: Zurücknehmen macht unsichtbar und
 * löscht nichts. Diese Aktion ist endgültig — deshalb hängen vier Guards davor.
 *
 * Warum überhaupt Guards und nicht einfach `farm.delete`: Die Fremdschlüssel
 * geben das Löschen nicht her (belegt in prisma/migrations/0_init/migration.sql).
 *   Order.farmId       → ON DELETE RESTRICT (:440)  ein Hof mit Bestellungen
 *                        lässt sich gar nicht löschen, die DB bricht ab.
 *   OrderItem.productId→ ON DELETE RESTRICT (:449)  dasselbe für die Produkte,
 *                        die per Cascade am Hof hängen.
 *   Order.customerId   → ON DELETE SET NULL (:443)  das Löschen des Users würde
 *                        die Kundenzuordnung fremder Bestellungen STILL kappen.
 * Die ersten beiden wären ein lauter Fehler, der dritte ein leiser Datenverlust.
 * Also wird vorher geprüft statt hinterher aufgeräumt.
 *
 * Reihenfolge beim Löschen ist Pflicht: erst der Hof, dann der User —
 * Farm.ownerId steht ebenfalls auf RESTRICT (:431). Alles Übrige hängt an
 * Cascades und geht von selbst mit: Produkte, Abholzeiten, Fotos, Werte,
 * Status-Beiträge, Abos (am Hof) sowie Sessions und Accounts (am User).
 */
export async function rejectFarmAction(farmId: string): Promise<{ error?: string }> {
  const guard = await requireAdmin()
  if ('error' in guard) return { error: guard.error }

  const farm = await prisma.farm.findUnique({
    where: { id: farmId },
    select: {
      slug: true,
      approvedAt: true,
      ownerId: true,
      owner: { select: { isAdmin: true } },
      products: { select: { id: true } },
      _count: { select: { orders: true, manualSales: true } },
    },
  })
  if (!farm) return { error: 'Hof nicht gefunden.' }

  // 1. Nur wartende Höfe. Ein freigeschalteter Hof ist ein laufender Betrieb —
  //    für den gibt es das Zurücknehmen, nicht das Löschen.
  if (farm.approvedAt !== null) return { error: FARM_REJECT_APPROVED_MESSAGE }

  // 2. Niemals das Betreiber-Konto. Ein Betreiber darf selbst einen Hof führen
  //    (siehe isAdmin in prisma/schema.prisma) — ein Fehlgriff hier wäre teuer.
  if (farm.owner.isAdmin) return { error: FARM_REJECT_OWNER_IS_ADMIN_MESSAGE }

  // 3. Keine Geschäftsdaten am Hof. Ein wartender Hof KANN welche haben: eine
  //    zurückgenommene Freigabe setzt approvedAt wieder auf null, die
  //    Bestellungen aus der freigeschalteten Zeit bleiben.
  if (farm._count.orders > 0 || farm._count.manualSales > 0) {
    return { error: FARM_REJECT_HAS_DATA_MESSAGE }
  }
  const produktIds = farm.products.map((p) => p.id)
  if (produktIds.length > 0) {
    const positionen = await prisma.orderItem.count({ where: { productId: { in: produktIds } } })
    if (positionen > 0) return { error: FARM_REJECT_HAS_DATA_MESSAGE }
  }

  // 4. Keine Bestellungen am Inhaber-Konto — sonst kappt SET NULL still die
  //    Kundenzuordnung von Bestellungen, die diesen Hof gar nichts angehen.
  const eigeneBestellungen = await prisma.order.count({ where: { customerId: farm.ownerId } })
  if (eigeneBestellungen > 0) return { error: FARM_REJECT_OWNER_HAS_ORDERS_MESSAGE }

  // StockReservation hat als einzige Tabelle KEINEN Fremdschlüssel auf Product
  // (prisma/schema.prisma:387–397: productId ist ein blankes String-Feld).
  // Ohne dieses deleteMany blieben verwaiste Reservierungen liegen.
  await prisma.$transaction([
    prisma.stockReservation.deleteMany({ where: { productId: { in: produktIds } } }),
    prisma.farm.delete({ where: { id: farmId } }),
    prisma.user.delete({ where: { id: farm.ownerId } }),
  ])

  revalidateAll(farm.slug)
  return {}
}
