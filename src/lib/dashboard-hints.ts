// Bedingungen für die Dashboard-Hinweiskarten (Sprint 19) — pure Funktionen,
// damit die Schwellen testbar sind. Karten erscheinen nur, wenn zutreffend.

// Entspricht der bestehenden Low-Stock-Schwelle der Hof-Seite (LOW_STOCK = 5
// in product-grid.tsx — dort bewusst nicht angefasst, /farm-page ist außerhalb
// des Sprint-19-Scopes)
export const LOW_STOCK_THRESHOLD = 5

// Status-Erinnerung ab 6 Tagen — passt zum Frequenzschutz „max. 1 E-Mail/Woche"
export const STATUS_REMINDER_DAYS = 6

export type LowStockProduct = { name: string; stock: number }

// null = keine Karte; sonst Anzeige-Text "Nur noch 3: Brennholz Buche"
// bzw. bei mehreren "Nur noch wenig da: Eier (2), Brennholz Buche (3)"
export function buildLowStockHint(
  products: LowStockProduct[],
  threshold: number = LOW_STOCK_THRESHOLD
): string | null {
  const low = products.filter((p) => p.stock <= threshold)
  if (low.length === 0) return null
  if (low.length === 1) return `Nur noch ${low[0].stock}: ${low[0].name}`
  return `Nur noch wenig da: ${low.map((p) => `${p.name} (${p.stock})`).join(', ')}`
}

// null = keine Karte (letzter Status ist frisch genug);
// 'never' = noch nie ein Status; Zahl = Tage seit dem letzten Status (≥ Schwelle)
export function statusReminder(
  lastPublishedAt: Date | string | null,
  now: Date = new Date(),
  thresholdDays: number = STATUS_REMINDER_DAYS
): number | 'never' | null {
  if (!lastPublishedAt) return 'never'
  const last = new Date(lastPublishedAt)
  const days = Math.floor((now.getTime() - last.getTime()) / (24 * 60 * 60 * 1000))
  return days >= thresholdDays ? days : null
}

// "Kunden gesamt" = eindeutige Kunden-E-Mails über alle Bestellungen
export function countUniqueCustomers(rows: { customerEmail: string }[]): number {
  return new Set(rows.map((r) => r.customerEmail.toLowerCase())).size
}
