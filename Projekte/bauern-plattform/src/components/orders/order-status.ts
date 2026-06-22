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

export function statusColor(status: string): string {
  switch (status) {
    case 'PENDING_CONFIRMATION': return 'bg-amber-100 text-amber-800'
    case 'PAID': return 'bg-blue-100 text-blue-800'
    case 'CONFIRMED': return 'bg-blue-100 text-blue-800'
    case 'IN_PREPARATION': return 'bg-purple-100 text-purple-800'
    case 'READY': return 'bg-green-100 text-green-800'
    case 'PICKED_UP': return 'bg-slate-100 text-slate-600'
    case 'CANCELLED': return 'bg-red-100 text-red-700'
    case 'NOT_PICKED_UP': return 'bg-red-100 text-red-700'
    default: return 'bg-slate-100 text-slate-600'
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
