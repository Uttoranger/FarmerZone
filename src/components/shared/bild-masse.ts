'use client'

import { useState, type SyntheticEvent } from 'react'
import { leseBildmasse, type TitelbildMasse } from '@/lib/titelbild'

/**
 * Die Maße des Bilds `quelle`, sobald der Browser es geladen hat (`beimLaden`
 * ans Bild hängen). Gespeichert sind sie nicht (siehe lib/titelbild.ts).
 * Maße eines früheren Fotos gelten nicht fürs neue — Mein Hof ersetzt das
 * Foto, ohne die Seite neu zu laden.
 *
 * Seit Nr. 108 ein eigener Baustein: Titelbild der Hofseite, Bild-Baustein und
 * Mein Hof › Titelbild messen alle hiermit — er gehört keinem von ihnen.
 */
export function useBildmasse(quelle: string | null): {
  masse: TitelbildMasse | null
  beimLaden: (ereignis: SyntheticEvent<HTMLImageElement>) => void
} {
  const [gelesen, setGelesen] = useState<{ quelle: string; masse: TitelbildMasse } | null>(null)
  const masse = gelesen?.quelle === quelle ? gelesen.masse : null

  function beimLaden(ereignis: SyntheticEvent<HTMLImageElement>): void {
    const gemessen = leseBildmasse(ereignis.currentTarget)
    if (quelle !== null && gemessen !== null) setGelesen({ quelle, masse: gemessen })
  }

  return { masse, beimLaden }
}
