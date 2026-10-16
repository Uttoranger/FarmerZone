/**
 * Erfundene Zeilen für die Tests der Jahresansicht (Nr. 100): Kostenposten und
 * Bestellungen in der Form, in der Prisma sie liefert, dazu eine Attrappe von
 * `prisma`, die das Fenster der Abfrage wirklich anwendet (Wiener Monatsgrenzen
 * wirken also im Test). Keine Hof-, Kundinnen- oder Personendaten.
 */
import { Prisma } from '@prisma/client'
import { vi } from 'vitest'

/** Ab hier gilt online als echt — davor sind es Testzahlungen (Register Z4). */
export const STICHTAG = new Date('2025-06-01T00:00:00Z')
/** Der 15. Oktober 2026, 10:00 in Wien. */
export const JETZT = new Date('2026-10-15T08:00:00Z')

/**
 * Ein Betrag aus der CSV („1284,50", „-0,10") als ganze Cent — über die
 * Ziffern, nie `Number(…) * 100` (CODING_STANDARDS „Geld“). Alles andere
 * ist ein Fehler im Test, kein Betrag.
 */
export function csvCent(text: string): number {
  const teile = /^(-?)(\d+),(\d{2})$/.exec(text)
  if (!teile) throw new Error(`Kein CSV-Betrag: ${text}`)
  const [, minus, euro, cent] = teile
  return (minus ? -1 : 1) * (Number(euro) * 100 + Number(cent))
}

export const POSTEN = [
  { id: 'p1', name: 'Hosting Beispiel', kategorie: 'HOSTING', betrag: new Prisma.Decimal('18.50'), rhythmus: 'MONATLICH', ab: new Date(Date.UTC(2025, 2, 1)), bis: null, notiz: null },
  // 100 € im Jahr, ab September 2025: 833 Cent im Monat, die ersten vier Monate des Abo-Jahres 834 — über den Jahreswechsel hinweg.
  { id: 'p2', name: 'Domain Beispiel', kategorie: 'DOMAIN', betrag: new Prisma.Decimal('100.00'), rhythmus: 'JAEHRLICH', ab: new Date(Date.UTC(2025, 8, 1)), bis: null, notiz: null },
  { id: 'p3', name: 'Marke Beispiel', kategorie: 'SONSTIGES', betrag: new Prisma.Decimal('280.00'), rhythmus: 'EINMALIG', ab: new Date(Date.UTC(2026, 4, 1)), bis: null, notiz: null },
  // Beendet: kostet nur Jänner bis Juni 2026 (bis zählt einschließlich).
  { id: 'p4', name: 'Werkzeug Beispiel', kategorie: 'WERKZEUGE', betrag: new Prisma.Decimal('5.00'), rhythmus: 'MONATLICH', ab: new Date(Date.UTC(2026, 0, 1)), bis: new Date(Date.UTC(2026, 5, 1)), notiz: null },
]

type Zeile = {
  createdAt: Date
  status: string
  paymentMethod: string
  paymentStatus: string
  serviceFeeCents: number
  serviceFeeRefundedAt: Date | null
  platformFeeAmount: Prisma.Decimal
}

function bestellung(createdAt: string, ueber: Partial<Zeile> = {}): Zeile {
  return {
    createdAt: new Date(createdAt),
    status: 'PICKED_UP',
    paymentMethod: 'ONLINE',
    paymentStatus: 'PAID',
    serviceFeeCents: 150,
    serviceFeeRefundedAt: null,
    platformFeeAmount: new Prisma.Decimal(0),
    ...ueber,
  }
}

/** `anzahl` Bestellungen am 10. des Monats, 10:00 UTC. */
function monatsBestellungen(jahr: number, monat: number, anzahl: number, gebuehr: number): Zeile[] {
  const tag = `${jahr}-${String(monat).padStart(2, '0')}-10T10:00:00Z`
  return Array.from({ length: anzahl }, () => bestellung(tag, { serviceFeeCents: gebuehr }))
}

export const BESTELLUNGEN: Zeile[] = [
  // Eine Testzahlung (online vor dem Stichtag): zählt nirgends.
  bestellung('2025-05-15T10:00:00Z', { serviceFeeCents: 999 }),
  ...[6, 7, 8, 9, 10, 11].flatMap((m) => monatsBestellungen(2025, m, m - 4, 120)),
  // 31.12.2025, 23:30 Wien = 22:30 UTC: noch Dezember 2025 …
  bestellung('2025-12-31T22:30:00Z', { serviceFeeCents: 111 }),
  // … 1.1.2026, 00:30 Wien = 23:30 UTC am Vortag: schon Jänner 2026.
  bestellung('2025-12-31T23:30:00Z', { serviceFeeCents: 222 }),
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap((m) => monatsBestellungen(2026, m, m + 2, 140 + m)),
  // 30.9.2026, 23:30 Wien = 21:30 UTC: September; 1.10., 00:30 Wien = 22:30 UTC: Oktober.
  bestellung('2026-09-30T21:30:00Z', { serviceFeeCents: 333 }),
  bestellung('2026-09-30T22:30:00Z', { serviceFeeCents: 444 }),
  ...monatsBestellungen(2026, 10, 12, 150),
  // Storniert und Gebühr erstattet: zählen nicht.
  bestellung('2026-03-12T10:00:00Z', { status: 'CANCELLED' }),
  bestellung('2026-04-12T10:00:00Z', { status: 'NOT_PICKED_UP', serviceFeeRefundedAt: new Date('2026-04-14T10:00:00Z') }),
]

type Fenster = { where?: { createdAt?: { gte?: Date; lt?: Date } } }

export const prismaAttrappe = {
  kostenposten: { findMany: vi.fn(async () => POSTEN) },
  order: {
    findFirst: vi.fn(async () => {
      const erste = [...BESTELLUNGEN].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0]
      return erste ? { createdAt: erste.createdAt } : null
    }),
    findMany: vi.fn(async (abfrage: Fenster) => {
      const fenster = abfrage.where?.createdAt
      return BESTELLUNGEN.filter(
        (b) => (!fenster?.gte || b.createdAt >= fenster.gte) && (!fenster?.lt || b.createdAt < fenster.lt)
      )
    }),
  },
}
