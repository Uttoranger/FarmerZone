import { z } from 'zod'
import { EMAIL_MAX } from '@/lib/eingabegrenzen'

/**
 * Filter, Suche und Sortierung der Kundenliste in der Adresse
 * (`/customers?filter=lange&suche=anna&sortierung=umsatz`, Nachtlauf Nr. 22a).
 * Die Adresse ist Fremddaten: Unbekanntes fällt still auf den Standard, eine
 * Suche länger als eine E-Mail-Adresse auf leer — ein alter oder verstümmelter
 * Link zeigt die Liste, nie einen Fehler.
 */
export const KUNDEN_FILTER_WERTE = ['alle', 'stammkunden', 'aktiv', 'lange', 'neu'] as const
export type KundenFilter = (typeof KUNDEN_FILTER_WERTE)[number]

export const KUNDEN_SORTIERUNG_WERTE = ['bestellungen', 'umsatz', 'zuletzt', 'name', 'neueste'] as const
export type KundenSortierung = (typeof KUNDEN_SORTIERUNG_WERTE)[number]

export const kundenAnsichtSchema = z.object({
  filter: z.enum(KUNDEN_FILTER_WERTE).catch('alle'),
  suche: z.string().trim().max(EMAIL_MAX).catch(''),
  sortierung: z.enum(KUNDEN_SORTIERUNG_WERTE).catch('bestellungen'),
})

export type KundenAnsicht = z.infer<typeof kundenAnsichtSchema>

/** Filter, Suche und Sortierung aus den Parametern der Adresse. */
export function kundenAnsichtAus(parameter: { get(name: string): string | null }): KundenAnsicht {
  return kundenAnsichtSchema.parse({
    filter: parameter.get('filter') ?? undefined,
    suche: parameter.get('suche') ?? '',
    sortierung: parameter.get('sortierung') ?? undefined,
  })
}
