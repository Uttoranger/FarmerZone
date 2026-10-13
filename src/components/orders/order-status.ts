import type { MarkeArt } from '@/lib/marke-art'

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

// Die Bedeutung jedes Status aus Sicht des Hofs (Register G5): tun = wartet
// auf die Kundin bzw. auf dich · läuft = bezahlt, in Arbeit · erledigt =
// abholbereit oder abgeholt (für den Hof getane Arbeit) · abgebrochen. Die
// Farbe dazu kommt nur aus dem Baustein Marke; die Kundin liest dieselben
// Status anders (src/lib/bestellstatus.ts).
export function statusArt(status: string): MarkeArt {
  switch (status) {
    case 'PENDING_CONFIRMATION': return 'tun'
    case 'PAID': return 'laeuft'
    case 'CONFIRMED': return 'tun'
    case 'IN_PREPARATION': return 'laeuft'
    case 'READY': return 'erledigt'
    case 'PICKED_UP': return 'erledigt'
    case 'CANCELLED': return 'abgebrochen'
    case 'NOT_PICKED_UP': return 'abgebrochen'
    default: return 'erledigt'
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
// GELESEN — Beschriftung und Bedeutung oben, ACTIVE_STATUSES hier, die Abholbereit-
// Schaltfläche (bestellAktionen in src/lib/hof-bestellungen.ts), OPEN_STATUSES in den
// Queries und die Rückschritt-Whitelist in actions/orders.ts —, aber kein
// Codepfad SETZT ihn je. Bestellungen springen direkt von PAID/CONFIRMED auf
// READY. Der Status bleibt bewusst erhalten (Enum und Anzeige unverändert),
// damit Altbestände korrekt dargestellt werden und ein späterer
// Kommissionier-Schritt ihn ohne Migration verwenden kann.
export const ACTIVE_STATUSES = [
  'PENDING_CONFIRMATION', 'PAID', 'CONFIRMED', 'IN_PREPARATION', 'READY',
] as const

export const DONE_STATUSES = ['PICKED_UP', 'CANCELLED', 'NOT_PICKED_UP'] as const
