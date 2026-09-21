export function statusLabel(status: string): string {
  switch (status) {
    case 'PENDING_CONFIRMATION': return 'Wartet auf Kunden-Bestätigung'
    case 'PAID': return 'Bezahlt'
    case 'CONFIRMED': return 'Bestätigt'
    case 'IN_PREPARATION': return 'In Vorbereitung'
    case 'READY': return 'Abholbereit'
    case 'PICKED_UP': return 'Abgeholt'
    case 'CANCELLED': return 'Storniert'
    case 'NOT_PICKED_UP': return 'Nicht abgeholt'
    default: return status
  }
}

// Referenz-19-Farbwelt: Neu/wartet = Orange auf #FBEEE3 ·
// In Arbeit/Bezahlt = Grün auf #E8F0E2 · Erledigt/neutral = #9AA08F auf #F0EDE5
//
// Die Tag-Werte bleiben unverändert; jede Marke trägt zusätzlich eine
// dark:-Entsprechung — gleiche Konvention wie src/lib/bestellstatus.ts.
export function statusColor(status: string): string {
  switch (status) {
    case 'PENDING_CONFIRMATION': return 'bg-[#FBEEE3] text-[#E8854A] dark:bg-accent/12 dark:text-accent-hover'
    case 'PAID': return 'bg-[#E8F0E2] text-[#2D5F3F] dark:bg-primary/15 dark:text-brand-text'
    case 'CONFIRMED': return 'bg-[#FBEEE3] text-[#E8854A] dark:bg-accent/12 dark:text-accent-hover'
    case 'IN_PREPARATION': return 'bg-[#E8F0E2] text-[#2D5F3F] dark:bg-primary/15 dark:text-brand-text'
    case 'READY': return 'bg-[#F0EDE5] text-[#9AA08F] dark:bg-muted dark:text-muted-foreground'
    case 'PICKED_UP': return 'bg-[#F0EDE5] text-[#9AA08F] dark:bg-muted dark:text-muted-foreground'
    case 'CANCELLED': return 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300'
    case 'NOT_PICKED_UP': return 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300'
    default: return 'bg-[#F0EDE5] text-[#9AA08F] dark:bg-muted dark:text-muted-foreground'
  }
}

export function paymentLabel(method: string): string {
  switch (method) {
    case 'ONLINE': return 'Online (Stripe)'
    case 'ONSITE_CASH': return 'Bar bei Abholung'
    case 'ONSITE_CARD': return 'Karte bei Abholung'
    default: return method
  }
}

// Hinweis zu IN_PREPARATION („In Vorbereitung"): Der Status wird überall
// GELESEN — Beschriftung und Farbe oben, ACTIVE_STATUSES hier, die Abholbereit-
// Schaltfläche in order-card.tsx/order-actions.tsx, OPEN_STATUSES in den
// Queries und die Rückschritt-Whitelist in actions/orders.ts —, aber kein
// Codepfad SETZT ihn je. Bestellungen springen direkt von PAID/CONFIRMED auf
// READY. Der Status bleibt bewusst erhalten (Enum und Anzeige unverändert),
// damit Altbestände korrekt dargestellt werden und ein späterer
// Kommissionier-Schritt ihn ohne Migration verwenden kann.
export const ACTIVE_STATUSES = [
  'PENDING_CONFIRMATION', 'PAID', 'CONFIRMED', 'IN_PREPARATION', 'READY',
] as const

export const DONE_STATUSES = ['PICKED_UP', 'CANCELLED', 'NOT_PICKED_UP'] as const
