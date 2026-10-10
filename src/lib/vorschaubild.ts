/**
 * Das Vorschaubild, das Messenger und soziale Netze beim Teilen eines Links
 * zeigen (Open Graph). Rein und ohne Datenbank prüfbar (tests/vorschaubild.test.ts).
 *
 * Die Startseite hat ein eigenes Bild (public/og/startseite.jpg, 1200 × 630 —
 * das Standardformat der großen Vorschau). Eine Hofseite zeigt seit Nr. 21
 * ihr Teilen-Bild (Gate 7: „Dasselbe Bild ist Open-Graph-Vorschau der
 * Hofseite"): Hofname, was es diese Woche gibt, nächste Abholung — erzeugt
 * von der Route `/[farmSlug]/opengraph-image` (src/lib/teilen-bild.ts).
 *
 * BEWUSST keine Datei `opengraph-image.*` im app-Ordner: Nach Nexts
 * Dateikonvention würde sie für alle Seiten darunter gelten (Produktseite,
 * Kasse, Bestätigung). Die Bild-Route liegt deshalb als `route.tsx` in einem
 * Ordner gleichen Namens. Die Pfade sind relativ — aufgelöst werden sie über
 * `metadataBase` im Root-Layout (metadatenBasis unten).
 */
import { titelbildFoto } from '@/lib/mein-hof'
import { teilenBildPfad } from '@/lib/teilen-kanal'
import { TEILEN_BILD_MASSE } from '@/lib/teilen-bild'

export type Vorschaubild = { url: string; width?: number; height?: number; alt: string }

export const STARTSEITE_VORSCHAUBILD = {
  url: '/og/startseite.jpg',
  width: 1200,
  height: 630,
  alt: 'FarmerZone — Lebensmittel und Futter direkt vom Hof',
} as const satisfies Vorschaubild

/**
 * Die Basis für relative Bildpfade in den Metadaten (`metadataBase`): nur eine
 * bekannte, gültige Adresse der App. Sonst undefined — dann nimmt Next seine
 * eigene Vercel-Adresse, statt dass das Vorschaubild auf localhost zeigt.
 * Ein `new URL` ohne Schutz würfe bei einer Adresse ohne Schema, und ein Wurf
 * im Root-Layout brächte jede Seite auf 500.
 */
export function metadatenBasis(appUrl: string | null): URL | undefined {
  if (!appUrl) return undefined
  try {
    return new URL(appUrl)
  } catch {
    // Keine gültige Adresse (etwa ohne https://): lieber keine Basis als eine Seite, die nicht lädt.
    return undefined
  }
}

/**
 * Das Vorschaubild einer Hofseite: ihr Teilen-Bild im Format 1:1. `version`
 * ist die Prüfsumme des Inhalts (`teilenBildVersion`) — sie macht die Adresse
 * neu, sobald sich das Bild ändert; ohne sie (Bild nicht ladbar) das Bild der
 * Startseite, damit ein geteilter Hof-Link nie ohne Bild ankommt.
 */
export function hofVorschaubild(hof: { name: string; slug: string }, version: string | null): Vorschaubild {
  if (version === null) return STARTSEITE_VORSCHAUBILD
  return {
    url: teilenBildPfad(hof.slug, { version }),
    ...TEILEN_BILD_MASSE.quadrat,
    alt: `${hof.name} – frisch diese Woche`,
  }
}

/**
 * Das Titelbild eines Hofs als Vorschaubild (nur ein echtes Foto), sonst das
 * der Startseite — für Seiten unter dem Hof, die kein eigenes Bild haben
 * (Produktseite ohne Produktfoto). Bis Nr. 20 war das auch das Bild der Hofseite.
 */
export function hofTitelbildVorschau(hof: { name: string; bannerType: string; bannerUrl: string | null }): Vorschaubild {
  const titelbild = titelbildFoto(hof)
  return titelbild ? { url: titelbild, alt: hof.name } : STARTSEITE_VORSCHAUBILD
}
