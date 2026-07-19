// Bestellpositions-Zeile mit Mengen-Einheit (Nachlese 5 Punkt 6):
// "1× Heumilch frisch (1 l)" · "2× Kartoffeln (5 kg)" · "3× Eier (Stk.)".
// Die Einheit steht NICHT auf der OrderItem-Zeile (kein Schema-Change —
// Snapshot-Spalte ist Parkliste), sondern wird zur Anzeige vom Produkt
// gejoint. Produkt gelöscht oder ohne Einheit → Darstellung wie bisher
// ("1× Name"), kein Crash.

// Schreibweise exakt wie im Checkout (checkout-form.tsx UNIT_LABELS)
export const ORDER_UNIT_LABELS: Record<string, string> = {
  STUECK: 'Stk.',
  KG: 'kg',
  G: 'g',
  LITER: 'l',
  ML: 'ml',
  M3: 'm³',
  PAKET: 'Pak.',
}

export type OrderLineProduct = {
  unit?: string | null
  // kommt je nach Quelle als number oder Prisma-Decimal an
  unitSize?: number | { toString(): string } | null
} | null

export function unitSuffix(product?: OrderLineProduct): string | null {
  if (!product?.unit) return null
  const label = ORDER_UNIT_LABELS[product.unit] ?? product.unit
  const size = product.unitSize == null ? null : Number(product.unitSize.toString())
  return size ? `${size} ${label}` : label
}

export function formatOrderLine(
  item: { quantity: number; productName: string },
  product?: OrderLineProduct
): string {
  const suffix = unitSuffix(product)
  return `${item.quantity}× ${item.productName}${suffix ? ` (${suffix})` : ''}`
}
