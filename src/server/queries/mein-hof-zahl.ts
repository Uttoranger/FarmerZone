import { prisma } from '@/lib/prisma'

/**
 * Die Zahl hinter dem Reiter „Beiträge" (ab lg) im Kopf von Mein Hof — jeder
 * eigene Beitrag, auch Entwürfe und vergangene: Der Reiter sagt, was hinter
 * ihm liegt, nicht was Kundinnen sehen. (Produkte hat seit dem Umbau von
 * Mein Hof seinen eigenen Platz in der Leiste und keinen Reiter mehr.)
 */
export async function zaehleBeitraege(farmId: string): Promise<number> {
  return prisma.statusPost.count({ where: { farmId } })
}
