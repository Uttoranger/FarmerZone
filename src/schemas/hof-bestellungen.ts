import { z } from 'zod'
import { STORNO_GRUND_MAX, ZU_LANG } from '@/lib/eingabegrenzen'

/**
 * Bestellungen des Hofs (/orders, Nachtlauf Nr. 19): Filter in der Adresse und
 * die Eingaben der Aktionen. Die Adresse ist Fremddaten — ein unbekannter
 * Filter fällt still auf „offen", nie ein Fehler.
 */
export const HOF_BESTELL_FILTER_WERTE = ['offen', 'heute', 'packen', 'gepackt', 'erledigt', 'alle'] as const

export type HofBestellFilter = (typeof HOF_BESTELL_FILTER_WERTE)[number]

const filterSchema = z.enum(HOF_BESTELL_FILTER_WERTE).catch('offen')

/** Der Filter aus `?filter=` (bei mehrfachem Parameter zählt der erste). */
export function hofBestellFilterAus(wert: string | string[] | undefined): HofBestellFilter {
  return filterSchema.parse(Array.isArray(wert) ? wert[0] : wert)
}

/** IDs aus Prisma (cuid) — nur Länge und Zeichen, Besitz prüft die Servergrenze. */
const kennung = z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/)

export const artikelFehltEingabeSchema = z.object({ orderId: kennung, itemId: kennung })

export const stornoEingabeSchema = z.object({
  orderId: kennung,
  grund: z.string().trim().max(STORNO_GRUND_MAX, ZU_LANG.stornoGrund).optional(),
})
