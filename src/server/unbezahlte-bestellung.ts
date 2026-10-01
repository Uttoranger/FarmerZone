import { prisma } from '@/lib/prisma'

/**
 * Eine Bestellung beenden, die noch auf ihre Zahlung oder Bestätigung wartet,
 * und ihre Ware freigeben — EINE Stelle für alle, die das tun: der Webhook bei
 * `payment_intent.canceled` und die Aufräumrunde für liegen gebliebene
 * Bestellungen (K3).
 *
 * DIE BEDINGUNG IST DIE SPERRE (ARCHITECTURE.md §5): Storniert wird nur aus
 * PENDING_CONFIRMATION heraus, per `updateMany` mit Statusbedingung. Ist die
 * Bestellung inzwischen bezahlt, schon storniert oder ein zweites Ereignis
 * war schneller, trifft die Bedingung nichts (count 0) — dann wird auch kein
 * Bestand bewegt. Statuswechsel und Rückbuchung in EINER Transaktion: Ein
 * Fehler dazwischen lässt beides ungeschehen, und eine Wiederholung findet
 * die Bestellung unverändert vor.
 *
 * Gibt zurück, ob DIESER Aufruf storniert hat.
 */
export async function storniereUnbezahlteBestellung(orderId: string, grund: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.order.updateMany({
      where: { id: orderId, status: 'PENDING_CONFIRMATION' },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: grund },
    })
    if (count !== 1) return false

    const positionen = await tx.orderItem.findMany({
      where: { orderId },
      select: { productId: true, quantity: true },
    })
    for (const position of positionen) {
      await tx.product.update({
        where: { id: position.productId },
        data: { stock: { increment: position.quantity } },
      })
    }
    return true
  })
}
