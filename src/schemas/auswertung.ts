import { z } from 'zod'
import type { Periode } from '@/lib/umsatz'

/**
 * Zeitraum des Reiters „Umsatz" in der URL (`/analytics?periode=monat&zurueck=1`),
 * damit Neuladen, Zurück und Teilen denselben Zeitraum zeigen.
 *
 * Die URL ist eine Systemgrenze: Was nicht passt, wird VERWORFEN, nie ein
 * Fehler — dann gilt die laufende Woche. `zurueck` ist höchstens zehn Jahre.
 */
export const AUSWERTUNG_MAX_ZURUECK = 520

const periodeSchema = z.enum(['woche', 'monat', 'jahr'])
const zurueckSchema = z.coerce.number().int().min(0).max(AUSWERTUNG_MAX_ZURUECK)

type Roh = string | string[] | undefined

function erster(wert: Roh): string | undefined {
  return Array.isArray(wert) ? wert[0] : wert
}

export function leseAuswertungZeitraum(parameter: { periode?: Roh; zurueck?: Roh }): { periode: Periode; zurueck: number } {
  const periode = periodeSchema.safeParse(erster(parameter.periode))
  const zurueck = zurueckSchema.safeParse(erster(parameter.zurueck))
  return { periode: periode.success ? periode.data : 'woche', zurueck: zurueck.success ? zurueck.data : 0 }
}

/** Die Adresse eines Zeitraums — ohne die Standardwerte, damit die laufende Woche schlicht /analytics bleibt. */
export function auswertungHref(periode: Periode, zurueck: number): string {
  const teile: string[] = []
  if (periode !== 'woche') teile.push(`periode=${periode}`)
  if (zurueck > 0) teile.push(`zurueck=${zurueck}`)
  return teile.length ? `/analytics?${teile.join('&')}` : '/analytics'
}
