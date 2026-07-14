// Umsatzgrenze für Einnahmen aus Be- & Verarbeitung im land- und
// forstwirtschaftlichen Nebenerwerb.
// Quelle: Landwirtschaftskammer Oberösterreich, Stand 2025: 55.000 € brutto/Jahr.
// Zählweise in der Karte ist vereinfacht (Jahresumsatz der Plattform) —
// keine Steuerberatung.
export const PROCESSING_REVENUE_LIMIT = 55_000

// Fortschritt (0–100 %, gedeckelt) und verbleibender Spielraum (nie negativ)
export function limitProgress(ytdRevenue: number, limit: number = PROCESSING_REVENUE_LIMIT) {
  const pct = Math.min(100, (ytdRevenue / limit) * 100)
  const remaining = Math.max(0, limit - ytdRevenue)
  return { pct, remaining }
}
