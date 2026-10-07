import { z } from 'zod'
import type { AnzeigeBereich } from '@/lib/taxonomie'
import { UMFELD_KM, type UmfeldKm } from '@/lib/umfeld'
import { REGION_HREF } from '@/lib/bauern-navigation'

/**
 * Umkreis, Bereich und Ansicht des Reiters „Preise vergleichen" (intern:
 * Umfeld) in der URL (`/region?km=25&bereich=futter&ansicht=karte`, seit
 * Nr. 22c; vorher /analytics/umfeld, das dorthin umleitet), damit Reload und
 * Zurück funktionieren — auch von der Hofseite zurück in die Karte (Konzept
 * Umfeld §4).
 *
 * Die URL ist eine Systemgrenze: Was nicht passt, wird VERWORFEN, nie ein
 * Fehler — dann gelten die Standards (25 km, der Bereich mit den meisten
 * eigenen Produkten, Liste). Ein Standort steht hier nie: Mittelpunkt ist
 * immer der eigene Hof, und den kennt der Server aus der Sitzung.
 */

export const UMFELD_STANDARD_KM: UmfeldKm = 25

export type UmfeldAnsichtWahl = 'liste' | 'karte'

export type UmfeldFilter = {
  km: UmfeldKm
  /** null = nicht gewählt; die Seite nimmt dann den Bereich mit den meisten eigenen Produkten. */
  bereich: AnzeigeBereich | null
  ansicht: UmfeldAnsichtWahl
}

const kmSchema = z.coerce.number().pipe(z.literal([...UMFELD_KM]))
const bereichSchema = z.enum(['hofladen', 'futter'])
const ansichtSchema = z.enum(['liste', 'karte'])

/** Nexts searchParams: ein Wert, mehrere oder keiner. Mehrere zählen nicht — der erste gilt. */
type Roh = string | string[] | null | undefined

function erster(wert: Roh): string | undefined {
  return (Array.isArray(wert) ? wert[0] : wert) ?? undefined
}

/** Nur die Ansicht — für den Umschalter, der sie im Browser liest. */
export function leseUmfeldAnsicht(wert: Roh): UmfeldAnsichtWahl {
  const ansicht = ansichtSchema.safeParse(erster(wert))
  return ansicht.success ? ansicht.data : 'liste'
}

export function leseUmfeldFilter(params: { km?: Roh; bereich?: Roh; ansicht?: Roh }): UmfeldFilter {
  const km = kmSchema.safeParse(erster(params.km))
  const bereich = bereichSchema.safeParse(erster(params.bereich))
  return {
    km: km.success ? km.data : UMFELD_STANDARD_KM,
    bereich: bereich.success ? (bereich.data === 'futter' ? 'FUTTERMITTEL' : 'LEBENSMITTEL') : null,
    ansicht: leseUmfeldAnsicht(params.ansicht),
  }
}

/**
 * Der Link auf den Reiter mit genau diesem Umkreis, Bereich und dieser
 * Ansicht. Umkreis und Bereich immer ausgeschrieben, die Ansicht nur, wenn es
 * die Karte ist — die Liste ist die Voreinstellung. „Preise vergleichen" ist
 * der erste Reiter von /region und braucht deshalb kein `reiter=`.
 */
export function umfeldLink(filter: { km: UmfeldKm; bereich: AnzeigeBereich; ansicht?: UmfeldAnsichtWahl }): string {
  const bereich = filter.bereich === 'FUTTERMITTEL' ? 'futter' : 'hofladen'
  const ansicht = filter.ansicht === 'karte' ? '&ansicht=karte' : ''
  return `${REGION_HREF}?km=${filter.km}&bereich=${bereich}${ansicht}`
}

/**
 * Wohin /analytics/umfeld umleitet (Nr. 22c, Gate 8 „alte URL leitet um"):
 * /region mit genau den Angaben, die das Schema annimmt — Umkreis, Bereich,
 * Karte. Was nicht passt, fällt weg (wie beim Lesen), damit ein alter Link
 * nie etwas Fremdes in die neue Adresse trägt; ohne gültige Angabe bleibt es
 * beim nackten /region.
 */
export function umfeldUmleitung(params: { km?: Roh; bereich?: Roh; ansicht?: Roh }): string {
  const teile: string[] = []
  const km = kmSchema.safeParse(erster(params.km))
  const bereich = bereichSchema.safeParse(erster(params.bereich))
  if (km.success) teile.push(`km=${km.data}`)
  if (bereich.success) teile.push(`bereich=${bereich.data}`)
  if (leseUmfeldAnsicht(params.ansicht) === 'karte') teile.push('ansicht=karte')
  return teile.length ? `${REGION_HREF}?${teile.join('&')}` : REGION_HREF
}
