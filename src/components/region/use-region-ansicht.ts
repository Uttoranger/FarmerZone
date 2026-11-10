'use client'

import { useMindestbreite } from '@/lib/use-mindestbreite'
import { REGION_WEB_AB } from '@/components/region/region-spalten'

/** Welche Teile gerade stehen: im Web beide, darunter die gewählte Ansicht. */
export function useRegionAnsicht(wahl: 'liste' | 'karte'): { web: boolean; zeigeKarte: boolean; zeigeListe: boolean; nurUmkreis: boolean } {
  const web = useMindestbreite(REGION_WEB_AB)
  const karte = wahl === 'karte'
  return { web, zeigeKarte: web || karte, zeigeListe: web || !karte, nurUmkreis: !web && karte }
}
