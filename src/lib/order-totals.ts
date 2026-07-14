// Betragsberechnung des Checkouts — extrahiert aus /api/checkout, damit die
// Rundungslogik unit-testbar ist. Die Formeln sind 1:1 identisch zum
// bisherigen Inline-Code; Beträge sind Euro-Werte, Stripe bekommt Cents.

export type LineItem = { unitPrice: number; quantity: number }

export function calcTotalAmount(items: LineItem[]): number {
  return items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
}

// Plattformgebühr in Euro, auf ganze Cents gerundet
// (totalAmount × Prozent ergibt direkt Cents, daher / 100 am Ende)
export function calcPlatformFeeAmount(totalAmount: number, feePercent: number): number {
  return Math.round(totalAmount * feePercent) / 100
}

// Euro → Cents für Stripe (rundet Float-Artefakte wie 3.3000000000000003 weg)
export function eurosToCents(amount: number): number {
  return Math.round(amount * 100)
}
