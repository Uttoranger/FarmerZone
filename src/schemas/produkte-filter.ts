import { z } from 'zod'
import { PRODUKTNAME_MAX } from '@/lib/eingabegrenzen'

/**
 * Filter und Suche der Produkttabelle in der Adresse (`/products?filter=futter&suche=heu`,
 * Nachtlauf Nr. 18). Die Adresse ist Fremddaten: Ein unbekannter Filter fällt
 * still auf „alle", eine zu lange Suche auf leer — ein alter oder
 * verstümmelter Link zeigt die Liste, nie einen Fehler.
 */
export const PRODUKTE_FILTER_WERTE = ['alle', 'lebensmittel', 'futter', 'brennmaterial', 'entwuerfe'] as const

export type ProdukteFilter = (typeof PRODUKTE_FILTER_WERTE)[number]

export const produkteAnsichtSchema = z.object({
  filter: z.enum(PRODUKTE_FILTER_WERTE).catch('alle'),
  suche: z.string().trim().max(PRODUKTNAME_MAX).catch(''),
})

export type ProdukteAnsicht = z.infer<typeof produkteAnsichtSchema>

/** Filter und Suche aus den Parametern der Adresse. */
export function produkteAnsichtAus(parameter: { get(name: string): string | null }): ProdukteAnsicht {
  return produkteAnsichtSchema.parse({
    filter: parameter.get('filter') ?? undefined,
    suche: parameter.get('suche') ?? '',
  })
}
