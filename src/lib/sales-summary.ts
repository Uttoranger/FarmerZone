// Verkauf 2: Summen-Definitionen + vereinte Verkaufsliste (pure Logik).
// Geld-Definitionen konsistent zum Abgrenzungs-Hinweis im Eintrag-Dialog —
// keine Doppelzählung:
//   Online bezahlt = ABGEHOLTE Bestellungen mit Stripe-Zahlung
//                    (Unterscheidung über stripePaymentIntentId)
//   Bar kassiert   = ABGEHOLTE Vor-Ort-Bestellungen + ALLE Direktverkäufe
// Nicht abgeholte Bestellungen zählen nirgends (Geld ist erst beim
// Abholen wirklich geflossen bzw. sicher).

export type SummableOrder = {
  id: string
  orderNumber: string
  customerName: string
  status: string
  totalAmount: number
  stripePaymentIntentId: string | null
  pickedUpAt: Date | null
}

export type SummableSale = {
  id: string
  totalAmount: number
  saleDate: Date
}

export function isOnlinePaidOrder(o: Pick<SummableOrder, 'status' | 'stripePaymentIntentId'>): boolean {
  return o.status === 'PICKED_UP' && !!o.stripePaymentIntentId
}

export function isBarPickupOrder(o: Pick<SummableOrder, 'status' | 'stripePaymentIntentId'>): boolean {
  return o.status === 'PICKED_UP' && !o.stripePaymentIntentId
}

export function sumOnlinePaid(orders: SummableOrder[]): number {
  return orders.filter(isOnlinePaidOrder).reduce((s, o) => s + o.totalAmount, 0)
}

export function sumBarKassiert(orders: SummableOrder[], sales: SummableSale[]): number {
  return (
    orders.filter(isBarPickupOrder).reduce((s, o) => s + o.totalAmount, 0) +
    sales.reduce((s, x) => s + x.totalAmount, 0)
  )
}

// Anker-Zahl: alles zusammen (Online + Bar) — per Definition überschneidungsfrei
export function sumWeekTotal(orders: SummableOrder[], sales: SummableSale[]): number {
  return sumOnlinePaid(orders) + sumBarKassiert(orders, sales)
}

// ── Vereinte "Letzte Verkäufe"-Liste ────────────────────────────────────────

export type SalesFeedOrder = SummableOrder & { itemsLabel: string }

export type SalesFeedEntry<TSale extends SummableSale = SummableSale> =
  | { kind: 'order'; when: Date; order: SalesFeedOrder }
  | { kind: 'manual'; when: Date; sale: TSale }

// EINE zeitlich sortierte Liste aus beiden Quellen: abgeholte Bestellungen
// (Zeitpunkt = pickedUpAt) und Direktverkäufe (Zeitpunkt = saleDate)
export function mergeSalesFeed<TSale extends SummableSale>(
  orders: SalesFeedOrder[],
  sales: TSale[],
  limit = 10
): SalesFeedEntry<TSale>[] {
  const entries: SalesFeedEntry<TSale>[] = [
    ...orders
      .filter((o) => o.status === 'PICKED_UP' && o.pickedUpAt)
      .map((o) => ({ kind: 'order' as const, when: o.pickedUpAt!, order: o })),
    ...sales.map((s) => ({ kind: 'manual' as const, when: s.saleDate, sale: s })),
  ]
  return entries.sort((a, b) => b.when.getTime() - a.when.getTime()).slice(0, limit)
}
