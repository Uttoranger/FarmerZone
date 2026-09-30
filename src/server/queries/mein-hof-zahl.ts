import { prisma } from '@/lib/prisma'

/**
 * Die Zahl hinter dem Reiter „Produkte" im Kopf von Mein Hof — auf der
 * Hofseite und bei den Beiträgen, wo die Produktliste nicht geladen wird.
 * Auf /products zählt die Seite die geladene Liste selbst. Gezählt wird
 * jedes eigene Produkt, auch ausgeblendete: Der Reiter sagt, was hinter ihm
 * liegt, nicht was Kundinnen sehen.
 */
export async function zaehleProdukte(farmId: string): Promise<number> {
  return prisma.product.count({ where: { farmId } })
}

/** Die Zahl hinter dem Reiter „Beiträge" (ab lg) — jeder eigene Beitrag, auch Entwürfe und vergangene: Der Reiter sagt, was hinter ihm liegt. */
export async function zaehleBeitraege(farmId: string): Promise<number> {
  return prisma.statusPost.count({ where: { farmId } })
}
