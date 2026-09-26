import { z } from 'zod'
import type { AnzeigeBereich } from '@/lib/taxonomie'
import { UM_KM_VALUES, type UmKm } from '@/schemas/hoefe-filter'

/**
 * Umkreis und Bereich des Reiters „Umfeld" in der URL
 * (`/analytics/umfeld?km=25&bereich=futter`), damit Reload und Zurück
 * funktionieren (Konzept Umfeld §4).
 *
 * Die URL ist eine Systemgrenze: Was nicht passt, wird VERWORFEN, nie ein
 * Fehler — dann gelten die Standards (25 km, der Bereich mit den meisten
 * eigenen Produkten). Ein Standort steht hier nie: Mittelpunkt ist immer der
 * eigene Hof, und den kennt der Server aus der Sitzung.
 */

export const UMFELD_STANDARD_KM: UmKm = 25

export type UmfeldFilter = {
  km: UmKm
  /** null = nicht gewählt; die Seite nimmt dann den Bereich mit den meisten eigenen Produkten. */
  bereich: AnzeigeBereich | null
}

const kmSchema = z.coerce.number().pipe(z.literal([...UM_KM_VALUES]))
const bereichSchema = z.enum(['hofladen', 'futter'])

/** Nexts searchParams: ein Wert, mehrere oder keiner. Mehrere zählen nicht — der erste gilt. */
type Roh = string | string[] | undefined

function erster(wert: Roh): string | undefined {
  return Array.isArray(wert) ? wert[0] : wert
}

export function leseUmfeldFilter(params: { km?: Roh; bereich?: Roh }): UmfeldFilter {
  const km = kmSchema.safeParse(erster(params.km))
  const bereich = bereichSchema.safeParse(erster(params.bereich))
  return {
    km: km.success ? km.data : UMFELD_STANDARD_KM,
    bereich: bereich.success ? (bereich.data === 'futter' ? 'FUTTERMITTEL' : 'LEBENSMITTEL') : null,
  }
}

/** Der Link auf den Reiter mit genau diesem Umkreis und Bereich — beide immer ausgeschrieben. */
export function umfeldLink(filter: { km: UmKm; bereich: AnzeigeBereich }): string {
  return `/analytics/umfeld?km=${filter.km}&bereich=${filter.bereich === 'FUTTERMITTEL' ? 'futter' : 'hofladen'}`
}
