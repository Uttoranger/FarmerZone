/**
 * Die Texte aller AGB-Fassungen nach Kennung (Register N45). Nur für Seiten
 * und Mail-Datei auf dem Server — die Kasse importiert agb-fassung.ts, nie
 * diese Datei, damit die AGB nicht in ihr Browserpaket geraten.
 */
import type { AgbKennung } from '@/lib/rechtstexte/agb-fassung'
import type { AgbFassungDaten } from '@/lib/rechtstexte/agb-bloecke'
import { AGB_0_9 } from '@/lib/rechtstexte/agb-0-9'
import { AGB_1_0 } from '@/lib/rechtstexte/agb'

export const AGB_TEXTE: Readonly<Record<AgbKennung, AgbFassungDaten>> = {
  '0.9': AGB_0_9,
  '1.0': AGB_1_0,
}
