/**
 * Das Vorschaubild, das Messenger und soziale Netze beim Teilen eines Links
 * zeigen (Open Graph). Rein und ohne Datenbank prüfbar (tests/vorschaubild.test.ts).
 *
 * Die Startseite hat ein eigenes Bild (public/og/startseite.jpg, 1200 × 630 —
 * das Standardformat der großen Vorschau). Eine Hofseite zeigt ihr Titelbild;
 * ohne Titelbild dasselbe Bild wie die Startseite, damit ein geteilter
 * Hof-Link nie ohne Bild ankommt.
 *
 * BEWUSST keine Datei `opengraph-image.*` im app-Ordner: Nach Nexts
 * Dateikonvention würde sie für alle Seiten darunter gelten und die
 * Titelbilder der Hofseiten überschreiben. Die Pfade sind relativ — aufgelöst
 * werden sie über `metadataBase` im Root-Layout.
 */
import { titelbildFoto } from '@/lib/mein-hof'

export type Vorschaubild = { url: string; width?: number; height?: number; alt: string }

export const STARTSEITE_VORSCHAUBILD = {
  url: '/og/startseite.jpg',
  width: 1200,
  height: 630,
  alt: 'FarmerZone — Lebensmittel und Futter direkt vom Hof',
} as const satisfies Vorschaubild

/** Das Vorschaubild einer Hofseite: ihr Titelbild (nur ein echtes Foto), sonst das der Startseite. */
export function hofVorschaubild(hof: { name: string; bannerType: string; bannerUrl: string | null }): Vorschaubild {
  const titelbild = titelbildFoto(hof)
  return titelbild ? { url: titelbild, alt: hof.name } : STARTSEITE_VORSCHAUBILD
}
