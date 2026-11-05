import type { OrderStatus } from '@prisma/client'

/**
 * Offen = alles, was nicht abgeholt, storniert oder verfallen (nicht abgeholt) ist —
 * auch „Bestätigung offen“ (Register N41 e). Die EINE Liste für die Zahl an
 * „Bestellungen“ in Unterleiste und Seitenleiste der HofShell (getOpenOrdersCount,
 * src/server/queries/orders.ts reicht sie als OPEN_STATUSES weiter) und für Kopf und
 * Chip „Noch offen · n“ auf /orders (src/lib/hof-bestellungen.ts).
 *
 * Bewusst ohne Prisma zur Laufzeit (nur der Typ, beim Übersetzen gelöscht): Die Liste
 * erreicht über hof-bestellungen.ts auch Client-Bauteile; aus der Abfrage-Datei
 * importiert, zöge sie Prisma in deren Bündel.
 */
export const OPEN_STATUSES = ['PENDING_CONFIRMATION', 'PAID', 'CONFIRMED', 'IN_PREPARATION', 'READY'] as const satisfies readonly OrderStatus[]

/** Ein Status, der als offen zählt. */
export type OffenerStatus = (typeof OPEN_STATUSES)[number]
