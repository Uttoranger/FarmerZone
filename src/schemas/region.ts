import { z } from 'zod'
import { BEREICH_KATEGORIEN } from '@/lib/taxonomie'
import { UMFELD_KM, type UmfeldKm } from '@/lib/umfeld'
import { REGION_HREF } from '@/lib/bauern-navigation'
import { UMFELD_STANDARD_KM } from '@/schemas/umfeld-filter'

/**
 * Die Adresse von /region (Nachtlauf Nr. 22c, Gate 8): welcher Reiter offen
 * ist und — im Reiter „Futter kaufen" — Umkreis, Futterart und Menge.
 * „Preise vergleichen" behält seine Angaben aus `umfeld-filter.ts` (km,
 * bereich, ansicht); beide Reiter teilen nur den Umkreis.
 *
 * Die URL ist eine Systemgrenze: Was nicht passt, wird VERWORFEN, nie ein
 * Fehler — dann gelten die Standards (Preise vergleichen, 25 km, alle Arten,
 * alle Mengen). Ein Standort steht hier nie: Mittelpunkt ist immer der
 * eigene Hof aus der Sitzung.
 */

export const REGION_REITER_VALUES = ['preise', 'futter'] as const
export type RegionReiter = (typeof REGION_REITER_VALUES)[number]

/** Die Futterarten, nach denen „Futter kaufen" filtert — die wählbaren Kategorien des Bereichs (ohne Altlast). */
export const FUTTER_ART_VALUES = BEREICH_KATEGORIEN.FUTTERMITTEL
export type FutterArt = (typeof FUTTER_ART_VALUES)[number]

/** Kleinmengen (bis 25 kg je Gebinde) oder Ballen & mehr — dieselbe Grenze wie auf /hoefe. */
export const FUTTER_MENGE_VALUES = ['klein', 'gross'] as const
export type FutterMenge = (typeof FUTTER_MENGE_VALUES)[number]

export type FutterKaufenFilter = {
  km: UmfeldKm
  /** null = alle Arten. */
  art: FutterArt | null
  /** null = alle Mengen. */
  menge: FutterMenge | null
}

const reiterSchema = z.enum(REGION_REITER_VALUES)
const kmSchema = z.coerce.number().pipe(z.literal([...UMFELD_KM]))
const artSchema = z.enum(FUTTER_ART_VALUES)
const mengeSchema = z.enum(FUTTER_MENGE_VALUES)

/** Nexts searchParams: ein Wert, mehrere oder keiner. Mehrere zählen nicht — der erste gilt. */
type Roh = string | string[] | null | undefined

function erster(wert: Roh): string | undefined {
  return (Array.isArray(wert) ? wert[0] : wert) ?? undefined
}

/** Der offene Reiter; ohne oder mit Unsinn „Preise vergleichen". */
export function leseRegionReiter(wert: Roh): RegionReiter {
  const reiter = reiterSchema.safeParse(erster(wert))
  return reiter.success ? reiter.data : 'preise'
}

export function leseFutterKaufenFilter(params: { km?: Roh; art?: Roh; menge?: Roh }): FutterKaufenFilter {
  const km = kmSchema.safeParse(erster(params.km))
  const art = artSchema.safeParse(erster(params.art))
  const menge = mengeSchema.safeParse(erster(params.menge))
  return {
    km: km.success ? km.data : UMFELD_STANDARD_KM,
    art: art.success ? art.data : null,
    menge: menge.success ? menge.data : null,
  }
}

/** Der Link in „Futter kaufen" mit genau diesem Umkreis, dieser Art und Menge (Standards ausgelassen). */
export function futterKaufenLink(filter: FutterKaufenFilter): string {
  const teile = ['reiter=futter', `km=${filter.km}`]
  if (filter.art) teile.push(`art=${filter.art}`)
  if (filter.menge) teile.push(`menge=${filter.menge}`)
  return `${REGION_HREF}?${teile.join('&')}`
}

/**
 * Der Link auf einen Reiter — der Umkreis geht mit, damit „25 km" beim
 * Wechsel stehen bleibt; alles andere gehört nur zu seinem Reiter.
 */
export function regionReiterLink(reiter: RegionReiter, km: UmfeldKm): string {
  return reiter === 'futter' ? futterKaufenLink({ km, art: null, menge: null }) : `${REGION_HREF}?km=${km}`
}
