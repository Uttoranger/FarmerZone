import { z } from 'zod'
import { EMAIL_MAX } from '@/lib/eingabegrenzen'

/**
 * Filter, Suche, Sortierung und Richtung der Kundenliste in der Adresse
 * (`/customers?filter=lange&suche=anna&sortierung=umsatz&richtung=auf`, Nachtlauf Nr. 22a).
 * Die Adresse ist Fremddaten: Unbekanntes fällt still auf den Standard, eine
 * Suche länger als eine E-Mail-Adresse auf leer — ein alter oder verstümmelter
 * Link zeigt die Liste, nie einen Fehler.
 */
export const KUNDEN_FILTER_WERTE = ['alle', 'stammkunden', 'aktiv', 'lange', 'neu'] as const
export type KundenFilter = (typeof KUNDEN_FILTER_WERTE)[number]

export const KUNDEN_SORTIERUNG_WERTE = ['bestellungen', 'umsatz', 'zuletzt', 'name', 'neueste'] as const
export type KundenSortierung = (typeof KUNDEN_SORTIERUNG_WERTE)[number]

/** Die Richtung der Sortierung: aufsteigend (A–Z, wenigste zuerst) oder absteigend. */
export const KUNDEN_RICHTUNG_WERTE = ['auf', 'ab'] as const
export type KundenRichtung = (typeof KUNDEN_RICHTUNG_WERTE)[number]

/**
 * Die Richtung, wenn die Adresse keine nennt — wie die alte Tabelle: der Name
 * von A bis Z, alles andere das Größte bzw. Jüngste zuerst.
 */
export const STANDARD_RICHTUNG: Record<KundenSortierung, KundenRichtung> = {
  bestellungen: 'ab',
  umsatz: 'ab',
  zuletzt: 'ab',
  name: 'auf',
  neueste: 'ab',
}

export const kundenAnsichtSchema = z.object({
  filter: z.enum(KUNDEN_FILTER_WERTE).catch('alle'),
  suche: z.string().trim().max(EMAIL_MAX).catch(''),
  sortierung: z.enum(KUNDEN_SORTIERUNG_WERTE).catch('bestellungen'),
  // Fehlt oder unbekannt → die Standardrichtung der Sortierung (kundenAnsichtAus).
  richtung: z.enum(KUNDEN_RICHTUNG_WERTE).optional().catch(undefined),
})

export type KundenAnsicht = Omit<z.infer<typeof kundenAnsichtSchema>, 'richtung'> & { richtung: KundenRichtung }

/** Filter, Suche, Sortierung und Richtung aus den Parametern der Adresse. */
export function kundenAnsichtAus(parameter: { get(name: string): string | null }): KundenAnsicht {
  const ansicht = kundenAnsichtSchema.parse({
    filter: parameter.get('filter') ?? undefined,
    suche: parameter.get('suche') ?? '',
    sortierung: parameter.get('sortierung') ?? undefined,
    richtung: parameter.get('richtung') ?? undefined,
  })
  return { ...ansicht, richtung: ansicht.richtung ?? STANDARD_RICHTUNG[ansicht.sortierung] }
}
