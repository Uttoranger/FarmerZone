export function statusLabel(status: string): string {
  switch (status) {
    case 'PENDING_CONFIRMATION': return 'Wartet auf Bestätigung'
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
export function statusColor(status: string): string {
  switch (status) {
    case 'PENDING_CONFIRMATION': return 'bg-[#FBEEE3] text-[#E8854A]'
    case 'PAID': return 'bg-[#E8F0E2] text-[#2D5F3F]'
    case 'CONFIRMED': return 'bg-[#FBEEE3] text-[#E8854A]'
    case 'IN_PREPARATION': return 'bg-[#E8F0E2] text-[#2D5F3F]'
    case 'READY': return 'bg-[#F0EDE5] text-[#9AA08F]'
    case 'PICKED_UP': return 'bg-[#F0EDE5] text-[#9AA08F]'
    case 'CANCELLED': return 'bg-red-100 text-red-700'
    case 'NOT_PICKED_UP': return 'bg-red-100 text-red-700'
    default: return 'bg-[#F0EDE5] text-[#9AA08F]'
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

export const ACTIVE_STATUSES = [
  'PENDING_CONFIRMATION', 'PAID', 'CONFIRMED', 'IN_PREPARATION', 'READY',
] as const

export const DONE_STATUSES = ['PICKED_UP', 'CANCELLED', 'NOT_PICKED_UP'] as const
